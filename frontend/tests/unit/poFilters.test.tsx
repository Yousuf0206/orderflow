import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PurchaseOrdersList from "../../src/pages/purchase-orders/PurchaseOrdersList";

/**
 * Filters live in the URL, and a filtered empty list must not claim the
 * organization is empty.
 */

const PARTIES = [
  { id: "party-1", party_code: "P-101", party_name: "Northgate Steel" },
  { id: "party-2", party_code: "P-102", party_name: "Civic Cement" },
];

const ORDERS = [
  {
    id: "po-1",
    po_number: "PO-2001",
    material: "TMT Steel Bars",
    remaining_balance: 600,
    status: "on_track",
    due_date: "2026-11-01",
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let requestedUrls: string[] = [];

function mockApi({ orders = ORDERS }: { orders?: typeof ORDERS } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("/auth/me")) {
        return json({
          user: { id: "u1", email: "owner@example.com" },
          organization: { id: "o1", name: "Org" },
          role: "owner",
          is_super_admin: false,
        });
      }
      if (url.includes("/parties")) return json(PARTIES);
      if (url.includes("/purchase-orders")) return json(orders);
      return json({});
    }),
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
}

function renderList(initialEntry = "/purchase-orders") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/purchase-orders"
            element={
              <>
                <PurchaseOrdersList />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  requestedUrls = [];
  localStorage.setItem(
    "orderflow_tokens",
    JSON.stringify({ access_token: "t", refresh_token: "r" }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("purchase order filters", () => {
  it("reads its initial state from the URL", async () => {
    mockApi();
    renderList("/purchase-orders?status=overdue");

    await waitFor(() =>
      expect(requestedUrls.some((u) => u.includes("status=overdue"))).toBe(true),
    );
    expect(screen.getByLabelText("Filter by status")).toHaveValue("overdue");
  });

  it("puts a selected party into the URL, so it survives navigating away and back", async () => {
    mockApi();
    renderList();
    await screen.findByRole("option", { name: "Northgate Steel" });

    fireEvent.change(screen.getByLabelText("Filter by party"), { target: { value: "party-1" } });

    await waitFor(() =>
      expect(screen.getByTestId("search").textContent).toContain("party_id=party-1"),
    );
  });

  it("sends the search to the server rather than filtering rows in the browser", async () => {
    // A count the user can see must be a count the server produced.
    mockApi();
    renderList();
    await screen.findByRole("option", { name: "Northgate Steel" });

    fireEvent.change(screen.getByLabelText("Search PO number"), { target: { value: "2001" } });

    await waitFor(
      () => expect(requestedUrls.some((u) => u.includes("q=2001"))).toBe(true),
      { timeout: 3000 },
    );
  });

  it("clears one filter without clearing the others", async () => {
    mockApi();
    renderList("/purchase-orders?status=overdue&party_id=party-1");

    fireEvent.click(await screen.findByRole("button", { name: /clear Overdue filter/i }));

    await waitFor(() => {
      const search = screen.getByTestId("search").textContent ?? "";
      expect(search).not.toContain("status=overdue");
      expect(search).toContain("party_id=party-1");
    });
  });

  it("says no orders match the filters, not that there are none at all", async () => {
    // "No purchase orders yet" means the organization is empty. Showing it to
    // a trader with 180 orders and a filter applied reads as data loss.
    mockApi({ orders: [] });
    renderList("/purchase-orders?status=overdue");

    expect(await screen.findByText(/no orders match these filters/i)).toBeInTheDocument();
    expect(screen.queryByText(/no purchase orders yet/i)).not.toBeInTheDocument();
  });

  it("says there are none at all when nothing is filtered", async () => {
    mockApi({ orders: [] });
    renderList();

    expect(await screen.findByText(/no purchase orders yet/i)).toBeInTheDocument();
  });
});
