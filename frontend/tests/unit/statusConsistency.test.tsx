import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PartyDetail from "../../src/pages/parties/PartyDetail";
import PurchaseOrdersList from "../../src/pages/purchase-orders/PurchaseOrdersList";
import { STATUS_META, getStatusMeta } from "../../src/components/ui/statusMeta";

/**
 * Spec FR-035: a status must read the same everywhere it appears.
 *
 * Compared across surfaces rather than inspected on one, because the failure
 * this guards against is precisely that two screens drift apart -- and reading
 * one screen cannot detect that.
 */

/** The statuses the backend's po_calc can produce. */
const BACKEND_STATUSES = ["on_track", "due_soon", "overdue", "fully_dispatched"];

const ORDER = {
  id: "po-1",
  po_number: "PO-2001",
  material: "TMT Steel Bars",
  remaining_balance: 600,
  status: "overdue",
  due_date: "2026-01-01",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockApi(status: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return json({
          user: { id: "u1", email: "owner@example.com" },
          organization: { id: "o1", name: "Org" },
          role: "owner",
          is_super_admin: false,
        });
      }
      if (url.includes("/parties/party-1")) {
        return json({
          party: { id: "party-1", party_code: "P-101", party_name: "Northgate", city: null },
          open_orders: [{ ...ORDER, status }],
        });
      }
      if (url.includes("/parties")) return json([]);
      if (url.includes("/purchase-orders")) return json([{ ...ORDER, status }]);
      return json({});
    }),
  );
}

function renderAt(path: string, element: ReactNode, routePath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem(
    "orderflow_tokens",
    JSON.stringify({ access_token: "t", refresh_token: "r" }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("status presentation", () => {
  it("covers exactly the statuses the backend produces", () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([...BACKEND_STATUSES].sort());
  });

  it("gives every status a distinct label", () => {
    const labels = BACKEND_STATUSES.map((s) => getStatusMeta(s).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(BACKEND_STATUSES)(
    "renders %s identically on the order list and the party screen",
    async (status) => {
      mockApi(status);
      const list = renderAt("/purchase-orders", <PurchaseOrdersList />, "/purchase-orders");
      await waitFor(() => expect(screen.getByText("PO-2001")).toBeInTheDocument());
      // Scoped to the table: the status filter's <option> list carries the
      // same words, and matching one of those would compare a dropdown entry
      // with a badge.
      const onList = within(screen.getByRole("table")).getByText(getStatusMeta(status).label);
      const listClass = onList.className;
      list.unmount();

      mockApi(status);
      const party = renderAt("/parties/party-1", <PartyDetail />, "/parties/:id");
      await waitFor(() => expect(screen.getByText("PO-2001")).toBeInTheDocument());
      const onParty = within(screen.getByRole("table")).getByText(getStatusMeta(status).label);

      expect(onParty.textContent).toBe(onList.textContent);
      expect(onParty.className).toBe(listClass);
      party.unmount();
    },
  );
});
