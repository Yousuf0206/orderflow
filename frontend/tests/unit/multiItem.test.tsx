import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PurchaseOrderDetail from "../../src/pages/purchase-orders/PurchaseOrderDetail";
import PurchaseOrderForm from "../../src/pages/purchase-orders/PurchaseOrderForm";
import { makePO } from "./poFixture";

/**
 * Multi-item purchase orders in the UI (spec 006): a line editor on create,
 * one quantity box per line on dispatch, and remaining shown per line.
 */

const MULTI = makePO({
  po_number: "PO-M1",
  lines: [
    { id: "l1", line_no: 1, material: "Steel bar", unit: "tonne", ordered_qty: 50, dispatched_qty: 0, remaining_qty: 50 },
    { id: "l2", line_no: 2, material: "Cement", unit: "bag", ordered_qty: 200, dispatched_qty: 0, remaining_qty: 200 },
    { id: "l3", line_no: 3, material: "Sand", unit: "truck", ordered_qty: 10, dispatched_qty: 0, remaining_qty: 10 },
  ],
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ME = {
  user: { id: "u1", email: "owner@example.com" },
  organization: { id: "o1", name: "Org" },
  role: "owner",
  is_super_admin: false,
};

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function mockApi(handler: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/me")) return json(ME);
    return handler(url, init) ?? json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodiesSentTo(fetchMock: ReturnType<typeof mockApi>, fragment: string, method = "POST") {
  return fetchMock.mock.calls
    .filter(([u, init]) => String(u).includes(fragment) && init?.method === method)
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function renderAt(path: string, route: string, ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
          <Route path="/purchase-orders/:id" element={<p>detail page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem("orderflow_tokens", JSON.stringify({ access_token: "t", refresh_token: "r" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("create form line editor", () => {
  function renderForm(handler: Handler = () => undefined) {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/parties") && (init?.method ?? "GET") === "GET") return json([{ id: "p1", party_name: "Party" }]);
      return handler(url, init);
    });
    renderAt("/purchase-orders/new", "/purchase-orders/new", <PurchaseOrderForm />);
    return fetchMock;
  }

  it("starts with one item whose remove button is disabled", async () => {
    renderForm();
    const remove = await screen.findByRole("button", { name: /remove item 1/i });
    expect(remove).toBeDisabled();
  });

  it("adds and removes items, keeping at least one", async () => {
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /add line/i }));
    expect(screen.getAllByTestId("po-line")).toHaveLength(2);

    const remove1 = screen.getByRole("button", { name: /remove item 1/i });
    expect(remove1).toBeEnabled();
    fireEvent.click(remove1);
    expect(screen.getAllByTestId("po-line")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /remove item 1/i })).toBeDisabled();
  });

  it("sends every item as lines[] and never a top-level material", async () => {
    const fetchMock = renderForm((url, init) =>
      url.endsWith("/purchase-orders") && init?.method === "POST" ? json({ id: "new-po" }, 201) : undefined,
    );
    await screen.findByRole("option", { name: "Party" });

    fireEvent.change(screen.getByLabelText(/party/i), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText(/po number/i), { target: { value: "PO-9" } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2099-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: /add line/i }));

    const [first, second] = screen.getAllByTestId("po-line");
    for (const [block, material, qty, unit] of [
      [first, "Steel", "50", "tonne"],
      [second, "Cement", "200", "bag"],
    ] as const) {
      fireEvent.change(within(block).getByLabelText(/material/i), { target: { value: material } });
      fireEvent.change(within(block).getByLabelText(/ordered qty/i), { target: { value: qty } });
      fireEvent.change(within(block).getByLabelText(/^unit/i), { target: { value: unit } });
    }
    fireEvent.click(screen.getByRole("button", { name: /create purchase order/i }));

    await waitFor(() => expect(screen.getByText("detail page")).toBeInTheDocument());
    const [body] = bodiesSentTo(fetchMock, "/purchase-orders");
    expect(body.material).toBeUndefined();
    expect(body.lines).toEqual([
      { material: "Steel", ordered_qty: 50, unit: "tonne" },
      { material: "Cement", ordered_qty: 200, unit: "bag" },
    ]);
  });

  it("shows a server line error on that item's field", async () => {
    renderForm((url, init) =>
      url.endsWith("/purchase-orders") && init?.method === "POST"
        ? json(
            { detail: [{ loc: ["body", "lines", 1, "ordered_qty"], msg: "Input should be greater than 0" }] },
            422,
          )
        : undefined,
    );
    await screen.findByRole("option", { name: "Party" });
    fireEvent.change(screen.getByLabelText(/party/i), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText(/po number/i), { target: { value: "PO-9" } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2099-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: /add line/i }));
    for (const block of screen.getAllByTestId("po-line")) {
      fireEvent.change(within(block).getByLabelText(/material/i), { target: { value: "X" } });
      fireEvent.change(within(block).getByLabelText(/ordered qty/i), { target: { value: "1" } });
      fireEvent.change(within(block).getByLabelText(/^unit/i), { target: { value: "bag" } });
    }
    fireEvent.click(screen.getByRole("button", { name: /create purchase order/i }));

    const second = (await screen.findAllByTestId("po-line"))[1];
    expect(await within(second).findByText(/greater than 0/i)).toBeInTheDocument();
    expect(within(screen.getAllByTestId("po-line")[0]).queryByText(/greater than 0/i)).not.toBeInTheDocument();
  });
});

describe("multi-line detail and dispatch", () => {
  function renderDetail(handler: Handler = () => undefined) {
    const fetchMock = mockApi((url, init) => {
      const custom = handler(url, init);
      if (custom) return custom;
      if (url.includes("/dispatches")) return json([]);
      if (url.includes("/purchase-orders/")) return json(MULTI);
      return undefined;
    });
    renderAt("/purchase-orders/po-1", "/purchase-orders/:id", <PurchaseOrderDetail />);
    return fetchMock;
  }

  it("lists every line with its own remaining", async () => {
    renderDetail();
    expect(await screen.findByText("3 items · Due 2026-11-01")).toBeInTheDocument();
    for (const material of ["Steel bar", "Cement", "Sand"]) {
      expect(screen.getAllByText(material).length).toBeGreaterThan(0);
    }
  });

  it("sends only the lines on this truck", async () => {
    const fetchMock = renderDetail((url, init) =>
      url.includes("/dispatches") && init?.method === "POST"
        ? json({ dispatch: { id: "d1", lines: [] }, warning: null, over_lines: [] }, 201)
        : undefined,
    );
    fireEvent.change(await screen.findByLabelText(/steel bar \(tonne\)/i), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/cement \(bag\)/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /add dispatch/i }));

    await waitFor(() => expect(bodiesSentTo(fetchMock, "/dispatches")).toHaveLength(1));
    const [body] = bodiesSentTo(fetchMock, "/dispatches");
    expect(body.lines).toEqual([
      { purchase_order_line_id: "l1", qty: 20 },
      { purchase_order_line_id: "l2", qty: 100 },
    ]);
    expect(body.qty).toBeUndefined();
  });

  it("refuses an empty truck without calling the server", async () => {
    const fetchMock = renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /add dispatch/i }));
    expect(await screen.findByText(/at least one item/i)).toBeInTheDocument();
    expect(bodiesSentTo(fetchMock, "/dispatches")).toHaveLength(0);
  });

  it("marks only the overflowing line and confirms on request", async () => {
    let calls = 0;
    const fetchMock = renderDetail((url, init) => {
      if (!(url.includes("/dispatches") && init?.method === "POST")) return undefined;
      calls += 1;
      return calls === 1
        ? json(
            {
              dispatch: null,
              warning: "Sand: 12 truck is more than the 10 truck still remaining. Confirm to record it anyway.",
              over_lines: [
                { purchase_order_line_id: "l3", material: "Sand", unit: "truck", remaining: 10, requested: 12 },
              ],
            },
            201,
          )
        : json({ dispatch: { id: "d1", lines: [] }, warning: null, over_lines: [] }, 201);
    });

    fireEvent.change(await screen.findByLabelText(/sand \(truck\)/i), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(/cement \(bag\)/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /add dispatch/i }));

    expect(await screen.findByText(/sand: 12 truck is more than/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sand \(truck\)/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/cement \(bag\)/i)).not.toHaveAttribute("aria-invalid");

    fireEvent.click(screen.getByRole("button", { name: /confirm anyway/i }));
    await waitFor(() => expect(bodiesSentTo(fetchMock, "/dispatches")).toHaveLength(2));
    expect(bodiesSentTo(fetchMock, "/dispatches")[1].confirm).toBe(true);
  });
});
