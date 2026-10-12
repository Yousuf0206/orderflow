import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Native routing (spec 007 R5/R6): no landing, pricing or billing in the app. */

vi.mock("../../src/platform", async (orig) => ({
  ...(await orig<typeof import("../../src/platform")>()),
  isNative: () => true,
}));
vi.mock("../../src/pages/dashboard/Dashboard", () => ({ default: () => <p>dashboard page</p> }));
vi.mock("../../src/pages/auth/Login", () => ({ default: () => <p>login page</p> }));
vi.mock("../../src/pages/marketing/Landing", () => ({ default: () => <p>landing page</p> }));
vi.mock("../../src/pages/marketing/Pricing", () => ({ default: () => <p>pricing page</p> }));
vi.mock("../../src/pages/billing/Billing", () => ({ default: () => <p>billing page</p> }));

import App from "../../src/App";

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function signIn() {
  localStorage.setItem("orderflow_tokens", JSON.stringify({ access_token: "a", refresh_token: "r" }));
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

describe("native routing", () => {
  it("opens on sign-in when signed out", () => {
    renderAt("/");
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("landing page")).not.toBeInTheDocument();
  });

  it("opens on the dashboard when signed in", () => {
    signIn();
    renderAt("/");
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });

  it("does not route pricing", () => {
    renderAt("/pricing");
    expect(screen.queryByText("pricing page")).not.toBeInTheDocument();
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("does not route billing or show it in the menu", () => {
    signIn();
    renderAt("/billing");
    expect(screen.queryByText("billing page")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /billing/i })).not.toBeInTheDocument();
  });
});
