import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PurchaseOrderDetail from "../../src/pages/purchase-orders/PurchaseOrderDetail";
import { makePO } from "./poFixture";

/**
 * Delivery-note scan drafts (spec 008): the scan only fills the dispatch form;
 * nothing is recorded until Confirm dispatch, and every field can be fixed.
 */

const capture = vi.hoisted(() => ({ result: null as Blob | null | Error }));
vi.mock("../../src/platform/capture", () => ({
  CameraDeniedError: class CameraDeniedError extends Error {},
  capturePhoto: async () => {
    if (capture.result instanceof Error) throw capture.result;
    return capture.result;
  },
}));
vi.mock("../../src/utils/compressImage", () => ({ compressImage: async (b: Blob) => b }));

const PO = makePO({
  id: "po1",
  po_number: "PO-S1",
  lines: [
    { id: "l1", line_no: 1, material: "Steel bar 12mm", unit: "tonne", ordered_qty: 50, dispatched_qty: 0, remaining_qty: 50 },
    { id: "l2", line_no: 2, material: "Cement OPC-53", unit: "bag", ordered_qty: 200, dispatched_qty: 0, remaining_qty: 200 },
    { id: "l3", line_no: 3, material: "Sand", unit: "truck", ordered_qty: 10, dispatched_qty: 0, remaining_qty: 10 },
  ],
});

const DRAFT = {
  scan_id: "scan1",
  document_date: { value: "2026-10-12", confidence: "high" },
  vehicle_ref: { value: "LES-1234", confidence: "low" },
  lines: [
    { raw_text: "OPC 53 Grade cement", qty: { value: "40", confidence: "high" }, unit: "bags",
      matched_line_id: "l2", match_confidence: "high" },
    { raw_text: "12mm steel", qty: { value: "5", confidence: "medium" }, unit: "MT",
      matched_line_id: "l1", match_confidence: "high" },
    { raw_text: "River sand", qty: { value: "2", confidence: "high" }, unit: null,
      matched_line_id: null, match_confidence: null },
  ],
  warnings: [],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function me(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "u1", email: "s@example.com" },
    organization: { id: "o1", name: "Org" },
    role: "staff",
    is_super_admin: false,
    scan_enabled: true,
    ...overrides,
  };
}

function mockApi({ meBody = me(), po = PO, parse = () => json(DRAFT) as Response } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/me")) return json(meBody);
    if (url.includes("/parse-document")) return parse();
    if (url.endsWith("/dispatches") && init?.method === "POST") {
      return json({ dispatch: { id: "d1", lines: [] }, warning: null, over_lines: [] }, 201);
    }
    if (url.endsWith("/dispatches")) return json([]);
    if (url.includes("/purchase-orders/po1")) return json(po);
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function dispatchPosts(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([u, init]) => String(u).endsWith("/dispatches") && init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/purchase-orders/po1"]}>
        <Routes>
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function qtyInput(label: RegExp) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

async function scan() {
  fireEvent.click(await screen.findByRole("button", { name: /scan delivery note/i }));
  return screen.findByTestId("scan-draft");
}

beforeEach(() => {
  localStorage.setItem("orderflow_tokens", JSON.stringify({ access_token: "t", refresh_token: "r" }));
  capture.result = new Blob(["x"], { type: "image/jpeg" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("scan draft", () => {
  it("fills the form without saving anything", async () => {
    const fetchMock = mockApi();
    renderPage();
    await scan();
    expect(qtyInput(/Cement OPC-53/).value).toBe("40");
    expect(qtyInput(/Steel bar 12mm/).value).toBe("5");
    expect(qtyInput(/Sand/).value).toBe("");
    expect((screen.getByLabelText(/vehicle/i) as HTMLInputElement).value).toBe("LES-1234");
    expect(dispatchPosts(fetchMock)).toHaveLength(0);
    expect(screen.getByRole("button", { name: /confirm dispatch/i })).toBeInTheDocument();
  });

  it("marks doubtful fields and lists unmatched rows", async () => {
    mockApi();
    renderPage();
    const panel = await scan();
    // vehicle (low) and steel qty (medium) are marked; cement (high) is not.
    expect(screen.getAllByText(/check this — read from the note/i)).toHaveLength(2);
    expect(within(panel).getByText(/unmatched — pick a line or skip/i)).toBeInTheDocument();
    expect(within(panel).getByText(/River sand/)).toBeInTheDocument();
  });

  it("lets an unmatched row be placed on a line, then confirms with the scan id", async () => {
    const fetchMock = mockApi();
    renderPage();
    await scan();
    fireEvent.change(within(screen.getByTestId("scan-unmatched")).getByRole("combobox"), { target: { value: "l3" } });
    expect(qtyInput(/Sand/).value).toBe("2");
    fireEvent.change(qtyInput(/Steel bar 12mm/), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm dispatch/i }));
    await waitFor(() => expect(dispatchPosts(fetchMock)).toHaveLength(1));
    const body = dispatchPosts(fetchMock)[0];
    expect(body.source_scan_id).toBe("scan1");
    expect(body.lines).toEqual([
      { purchase_order_line_id: "l2", qty: 40 },
      { purchase_order_line_id: "l1", qty: 4 },
      { purchase_order_line_id: "l3", qty: 2 },
    ]);
  });

  it("discarding clears the form and sends nothing", async () => {
    const fetchMock = mockApi();
    renderPage();
    await scan();
    fireEvent.click(screen.getByRole("button", { name: /discard scan/i }));
    expect(qtyInput(/Cement OPC-53/).value).toBe("");
    expect(screen.getByRole("button", { name: /add dispatch/i })).toBeInTheDocument();
    expect(dispatchPosts(fetchMock)).toHaveLength(0);
  });

  it.each([
    ["unreadable", 422, /couldn't read this note/i],
    ["daily_scan_limit", 429, /used today's scans/i],
    ["reader_timeout", 504, /took too long. nothing was saved/i],
  ])("%s shows a plain message and no draft", async (detail, status, message) => {
    const fetchMock = mockApi({ parse: () => json({ detail }, status) });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /scan delivery note/i }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByTestId("scan-draft")).not.toBeInTheDocument();
    expect(dispatchPosts(fetchMock)).toHaveLength(0);
  });

  it("a matched row can be removed or moved to another line", async () => {
    const fetchMock = mockApi();
    renderPage();
    await scan();
    const [cement, steel] = within(screen.getByTestId("scan-matched")).getAllByRole("combobox");
    fireEvent.change(cement, { target: { value: "" } });
    expect(qtyInput(/Cement OPC-53/).value).toBe("");
    fireEvent.change(steel, { target: { value: "l3" } });
    expect(qtyInput(/Steel bar 12mm/).value).toBe("");
    expect(qtyInput(/Sand/).value).toBe("5");
    fireEvent.click(screen.getByRole("button", { name: /confirm dispatch/i }));
    await waitFor(() => expect(dispatchPosts(fetchMock)).toHaveLength(1));
    expect(dispatchPosts(fetchMock)[0].lines).toEqual([{ purchase_order_line_id: "l3", qty: 5 }]);
  });

  it("an unreadable note offers Retake and Type it instead", async () => {
    const fetchMock = mockApi({ parse: () => json({ detail: "unreadable" }, 422) });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /scan delivery note/i }));
    fireEvent.click(await screen.findByRole("button", { name: /type it instead/i }));
    expect(screen.queryByText(/couldn't read this note/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /scan delivery note/i }));
    fireEvent.click(await screen.findByRole("button", { name: /retake/i }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("parse-document"))).toHaveLength(3),
    );
  });

  it("a cancelled photo does nothing", async () => {
    capture.result = null;
    const fetchMock = mockApi();
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /scan delivery note/i }));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("parse-document"))).toBe(false);
  });
});

describe("scan button visibility", () => {
  it("hidden when scanning is off", async () => {
    mockApi({ meBody: me({ scan_enabled: false }) });
    renderPage();
    await screen.findByRole("button", { name: /add dispatch/i });
    expect(screen.queryByRole("button", { name: /scan delivery note/i })).not.toBeInTheDocument();
  });

  it("hidden for viewers", async () => {
    mockApi({ meBody: me({ role: "viewer" }) });
    renderPage();
    await screen.findByText("PO-S1");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: /scan delivery note/i })).not.toBeInTheDocument();
  });

  it("hidden when nothing is left to dispatch", async () => {
    const done = makePO({
      id: "po1",
      po_number: "PO-S1",
      lines: [{ id: "l1", line_no: 1, material: "Sand", unit: "truck", ordered_qty: 10, dispatched_qty: 10, remaining_qty: 0 }],
    });
    mockApi({ po: done });
    renderPage();
    await screen.findByRole("button", { name: /add dispatch/i });
    expect(screen.queryByRole("button", { name: /scan delivery note/i })).not.toBeInTheDocument();
  });
});
