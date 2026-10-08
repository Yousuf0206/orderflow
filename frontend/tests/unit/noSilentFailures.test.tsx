import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Notifications from "../../src/components/Notifications";
import AuditLog from "../../src/pages/audit/AuditLog";
import Reports from "../../src/pages/reports/Reports";

/**
 * The screens outside the core loop. The recurring bug in all of them was the
 * same: a failed fetch fell through to an empty state, so the UI asserted
 * something confident and false -- "no entries", "all caught up" -- about data
 * it had never actually retrieved.
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderPage(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
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

describe("audit log", () => {
  it("does not claim there are no entries when the fetch failed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({}, 500));
    renderPage(<AuditLog />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText(/no audit entries yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows a readable empty state when there genuinely are no entries", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json([]));
    renderPage(<AuditLog />);

    await waitFor(() => expect(screen.getByText(/no audit entries yet/i)).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("notifications", () => {
  it("does not say you're all caught up when it couldn't check", async () => {
    // The worst version of a false empty: this panel is the only place overdue
    // orders surface, so "all caught up" on a failed fetch is active
    // reassurance that nothing needs attention.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({}, 500));
    renderPage(<Notifications />);

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it("says you're all caught up when there really is nothing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json([]));
    renderPage(<Notifications />);

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument());
  });
});

describe("report export", () => {
  it("shows an error and downloads nothing when the export is refused", async () => {
    const createObjectURL = vi.fn(() => "blob:nope");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });

    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const href = String(url);
      if (href.includes("/export")) {
        return Promise.resolve(json({ detail: "You don't have access to exports." }, 403));
      }
      return Promise.resolve(json([{ party_name: "Acme", remaining_balance: 10 }]));
    });

    renderPage(<Reports />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /csv/i }));

    await waitFor(() =>
      expect(screen.getByText(/don't have access to exports/i)).toBeInTheDocument(),
    );

    // The real defect: a JSON error body used to be handed to createObjectURL
    // and saved as report.csv.
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("reports a network failure during export instead of failing silently", async () => {
    const createObjectURL = vi.fn(() => "blob:nope");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });

    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const href = String(url);
      if (href.includes("/export")) return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve(json([{ party_name: "Acme", remaining_balance: 10 }]));
    });

    renderPage(<Reports />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /csv/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("still offers all three export formats", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json([{ party_name: "Acme" }]));
    renderPage(<Reports />);

    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());

    // All three work server-side, so none should be hidden -- the fix was to
    // make failures visible, not to remove formats.
    for (const label of [/csv/i, /excel/i, /pdf/i]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});

describe("error and empty states at phone width", () => {
  /**
   * jsdom has no layout engine, so these assert the structural property that
   * prevents horizontal overflow rather than measuring it. The actual visual
   * check at a phone viewport is a manual step in quickstart.md (Principle
   * VIII) -- this only catches a regression that reintroduces a fixed width.
   */
  it("constrains its text and imposes no minimum width", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({}, 500));
    const { container } = renderPage(<AuditLog />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    const alert = screen.getByRole("alert");
    expect(alert.querySelector(".max-w-sm")).not.toBeNull();

    // A min-w-* inside the alert would force the page wider than the screen.
    expect(alert.querySelector('[class*="min-w-["]')).toBeNull();
    expect(container.querySelector('[class*="min-w-[6"]')).toBeNull();
  });
});
