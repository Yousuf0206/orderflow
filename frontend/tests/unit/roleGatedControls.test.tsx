import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PurchaseOrderDetail from "../../src/pages/purchase-orders/PurchaseOrderDetail";

/**
 * A control the server will refuse must not be on screen.
 *
 * The defect this covers: the dispatch form had no role check at all, so every
 * Viewer filled it in and was refused by the backend -- with nothing wrong
 * with what they had typed, which reads as a broken product rather than as a
 * permission boundary.
 */

const PO = {
  id: "po-1",
  po_number: "PO-2001",
  material: "TMT Steel Bars 12mm",
  ordered_qty: 1000,
  unit: "ton",
  due_date: "2026-11-01",
  total_dispatched: 400,
  remaining_balance: 600,
  status: "on_track",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockApi({ role, meFails = false }: { role: string | null; meFails?: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        if (meFails) return json({ detail: "boom" }, 500);
        return json({
          user: { id: "u1", email: "someone@example.com" },
          organization: { id: "o1", name: "Org" },
          role,
          is_super_admin: false,
        });
      }
      if (url.includes("/dispatches")) return json([]);
      if (url.includes("/purchase-orders/")) return json(PO);
      return json({});
    }),
  );
}

function renderDetail(ui: ReactNode = <PurchaseOrderDetail />) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/purchase-orders/po-1"]}>
        <Routes>
          <Route path="/purchase-orders/:id" element={ui} />
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

describe("dispatch form role gating", () => {
  it("shows a viewer an explanation instead of a form", async () => {
    mockApi({ role: "viewer" });
    renderDetail();

    await waitFor(() => expect(screen.getByText("PO-2001")).toBeInTheDocument());
    expect(await screen.findByText(/needs/i)).toHaveTextContent(/Staff/);
    expect(screen.queryByRole("button", { name: /add dispatch/i })).not.toBeInTheDocument();
  });

  it("shows staff the form", async () => {
    mockApi({ role: "staff" });
    renderDetail();

    expect(await screen.findByRole("button", { name: /add dispatch/i })).toBeInTheDocument();
  });

  it("shows an owner the form", async () => {
    mockApi({ role: "owner" });
    renderDetail();

    expect(await screen.findByRole("button", { name: /add dispatch/i })).toBeInTheDocument();
  });

  it("says permissions are unconfirmed rather than guessing when the role will not load", async () => {
    // Neither "you may" nor "you may not": a Viewer shown a working form and
    // an Owner told they lack access are both wrong.
    mockApi({ role: null, meFails: true });
    renderDetail();

    expect(await screen.findByText(/couldn't confirm your permissions/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add dispatch/i })).not.toBeInTheDocument();
  });

  it("still shows the remaining balance to a viewer", async () => {
    // Gating the form must not gate the figures. A Viewer exists to read them.
    mockApi({ role: "viewer" });
    renderDetail();

    const remaining = await screen.findByText("600");
    expect(remaining).toBeInTheDocument();
  });
});
