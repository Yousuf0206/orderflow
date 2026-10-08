import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Billing from "../../src/pages/billing/Billing";
import Landing from "../../src/pages/marketing/Landing";
import Pricing from "../../src/pages/marketing/Pricing";

/**
 * No reachable control may start a purchase while paid plans are gated off.
 * These cover the UI half; the endpoints are covered by the backend's
 * test_paid_plans_gate.py, because a hidden button still leaves a path
 * reachable by direct request.
 */

const GATED_PLANS = { paid_plans_enabled: false, trial_length_days: 14, plans: [] };

const TRIAL_BILLING = {
  plan_tier: "trial",
  trial_ends_at: "2026-10-22T09:14:00Z",
  is_read_only_locked: false,
  max_users: 3,
  max_active_pos: 25,
  current_users: 2,
  current_active_pos: 7,
  trial_length_days: 14,
  paid_plans_enabled: false,
  has_billing_account: false,
};

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

describe("pricing page while paid plans are gated", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(GATED_PLANS));
  });

  it("states the trial, the no-card promise, and that paid plans are coming", async () => {
    renderPage(<Pricing />);
    await waitFor(() => expect(screen.getByText(/14-day free trial/i)).toBeInTheDocument());
    expect(screen.getByText(/no credit card/i)).toBeInTheDocument();
    expect(screen.getByText(/paid plans coming soon/i)).toBeInTheDocument();
  });

  it("shows no tier name and no price", async () => {
    renderPage(<Pricing />);
    await waitFor(() => expect(screen.getByText(/paid plans coming soon/i)).toBeInTheDocument());

    // Matched as headings rather than loose text: "business" also appears in
    // the page's own prose about who the product is for.
    for (const tier of [/^starter$/i, /^business$/i, /^pro$/i]) {
      expect(screen.queryByRole("heading", { name: tier })).not.toBeInTheDocument();
    }
    const text = document.body.textContent ?? "";
    for (const price of ["$29", "$79", "$199"]) {
      expect(text).not.toContain(price);
    }
  });

  it("offers no control that would begin a purchase", async () => {
    renderPage(<Pricing />);
    await waitFor(() => expect(screen.getByText(/paid plans coming soon/i)).toBeInTheDocument());

    for (const button of screen.queryAllByRole("button")) {
      expect(button.textContent ?? "").not.toMatch(/choose|buy|subscribe|upgrade/i);
    }
  });

  it("keeps the legal links reachable", async () => {
    renderPage(<Pricing />);
    await waitFor(() => expect(screen.getByText(/terms of service/i)).toBeInTheDocument());
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
  });
});

describe("landing page while paid plans are gated", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(GATED_PLANS));
  });

  it("offers no link that would begin a purchase", async () => {
    renderPage(<Landing />);
    await waitFor(() => expect(screen.getAllByRole("link").length).toBeGreaterThan(0));

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/checkout|upgrade|subscribe|billing/i);
      expect(link.textContent ?? "").not.toMatch(/buy|subscribe|upgrade/i);
    }
    for (const button of screen.queryAllByRole("button")) {
      expect(button.textContent ?? "").not.toMatch(/choose|buy|subscribe|upgrade/i);
    }
  });

  it("names no plan tier and no price", async () => {
    renderPage(<Landing />);
    await waitFor(() => expect(screen.getAllByRole("link").length).toBeGreaterThan(0));

    const text = document.body.textContent ?? "";
    for (const price of ["$29", "$79", "$199", "/month", "per month"]) {
      expect(text).not.toContain(price);
    }
  });

  it("points its one primary invitation at the trial", async () => {
    renderPage(<Landing />);
    const trialLinks = await screen.findAllByRole("link", { name: /start (your )?free trial/i });
    for (const link of trialLinks) {
      expect(link.getAttribute("href")).toBe("/signup");
    }
  });
});

describe("billing page on a trial organization", () => {
  it("shows the plan, the trial end date, and real usage against real limits", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(TRIAL_BILLING));
    renderPage(<Billing />);

    await waitFor(() => expect(screen.getByText("2 of 3")).toBeInTheDocument());
    expect(screen.getByText(/current plan/i)).toBeInTheDocument();
    expect(screen.getByText(/trial ends/i)).toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByText("7 of 25")).toBeInTheDocument();
  });

  it("offers no upgrade and no billing management", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(TRIAL_BILLING));
    renderPage(<Billing />);

    await waitFor(() => expect(screen.getByText("2 of 3")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /choose|upgrade|subscribe/i })).not.toBeInTheDocument();
    // A trial org has no payment account, so this could never succeed for it.
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it("never shows a server environment variable to a user", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(TRIAL_BILLING));
    const { container } = renderPage(<Billing />);

    await waitFor(() => expect(screen.getByText("2 of 3")).toBeInTheDocument());
    expect(container.textContent ?? "").not.toMatch(/STRIPE_SECRET_KEY|stripe/i);
  });

  it("explains an ended trial without telling the user to upgrade", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ ...TRIAL_BILLING, is_read_only_locked: true }),
    );
    renderPage(<Billing />);

    await waitFor(() => expect(screen.getByText(/your trial has ended/i)).toBeInTheDocument());

    // The main thing an expired-trial user reads must not be a dead instruction.
    const banner = screen.getByText(/your trial has ended/i).closest("div");
    expect(banner?.textContent ?? "").not.toMatch(/upgrade/i);
    // And it should say their data is still there.
    expect(banner?.textContent ?? "").toMatch(/still here|viewing|exporting/i);
  });

  it("tells a non-owner why, rather than showing a generic failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ detail: "Owner role required" }, 403),
    );
    renderPage(<Billing />);

    await waitFor(() =>
      expect(screen.getByText(/only organization owners/i)).toBeInTheDocument(),
    );
  });

  it("shows an error with retry if billing cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({}, 500));
    renderPage(<Billing />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
