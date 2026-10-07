import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PartyDetail from "../../src/pages/parties/PartyDetail";
import PurchaseOrderDetail from "../../src/pages/purchase-orders/PurchaseOrderDetail";
import { REQUEST_TIMEOUT_MS } from "../../src/services/apiClient";

/**
 * The two screens the project constitution names by name. Both used to render
 * "Loading party…" / "Loading purchase order…" forever on failure, because
 * `isLoading || !data` is still true when a query has FAILED -- react-query
 * leaves data undefined with isLoading false.
 *
 * These assert the strings are gone and an actionable error takes their place.
 */

function withProviders(ui: ReactNode, path: string, route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.setItem(
    "orderflow_tokens",
    JSON.stringify({ access_token: "t", refresh_token: "r" }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("party detail failure states", () => {
  it("shows an error with retry instead of loading forever when the fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Party not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    withProviders(<PartyDetail />, "/parties/abc", "/parties/:id");

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    expect(screen.queryByText(/Loading party/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("surfaces the server's explanation rather than a status code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Party not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    withProviders(<PartyDetail />, "/parties/abc", "/parties/:id");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/party not found/i));
    expect(screen.getByRole("alert")).not.toHaveTextContent(/^404$/);
  });

  it("reaches a terminal error state when the request never settles", async () => {
    vi.useFakeTimers();
    try {
      // A fetch that never resolves: the case that hangs a screen even when
      // isError is handled correctly, because no error is ever produced.
      vi.spyOn(globalThis, "fetch").mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            (init as RequestInit | undefined)?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );

      withProviders(<PartyDetail />, "/parties/abc", "/parties/:id");

      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 100);
      vi.useRealTimers();

      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(screen.queryByText(/Loading party/i)).not.toBeInTheDocument();
      // Never the raw abort name.
      expect(screen.getByRole("alert")).not.toHaveTextContent(/abort/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves within the budget a screen is allowed to take", () => {
    // SC-005 allows 15s; with no automatic retry the worst case is one attempt.
    expect(REQUEST_TIMEOUT_MS).toBeLessThan(15_000);
  });
});

describe("purchase order detail failure states", () => {
  it("shows an error with retry instead of loading forever when the fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Purchase order not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    withProviders(<PurchaseOrderDetail />, "/purchase-orders/abc", "/purchase-orders/:id");

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));

    expect(screen.queryByText(/Loading purchase order/i)).not.toBeInTheDocument();
  });

  it("does not claim an order has no dispatches when the history fetch failed", async () => {
    // The order loads; its dispatch history does not. Rendering the empty state
    // here would tell a trader the order has nothing dispatched against it,
    // which is a different and much worse claim than "we couldn't load it".
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const href = String(url);
      if (href.includes("/dispatches")) {
        return Promise.resolve(new Response("{}", { status: 500, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "abc",
            po_number: "PO-1",
            material: "Steel",
            ordered_qty: 100,
            unit: "ton",
            due_date: "2027-01-01",
            total_dispatched: 30,
            remaining_balance: 70,
            status: "partial",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    });

    withProviders(<PurchaseOrderDetail />, "/purchase-orders/abc", "/purchase-orders/:id");

    await waitFor(() => expect(screen.getByText("PO-1")).toBeInTheDocument());

    // Not the empty state -- that would be a false claim about the order.
    expect(screen.queryByText(/No dispatches recorded yet/i)).not.toBeInTheDocument();

    // An honest error instead. A 500 is described by describeApiError's
    // server-fault wording rather than the screen's fallback, which is correct:
    // the more specific cause wins.
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((a) => /our end|couldn't load/i.test(a.textContent ?? ""))).toBe(true);
    });
  });
});
