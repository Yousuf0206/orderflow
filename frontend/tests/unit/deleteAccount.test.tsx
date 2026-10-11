import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DeleteAccount from "../../src/pages/settings/DeleteAccount";

/** Account deletion (spec 007 FR-012): explicit for owners, never one tap. */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function mockApi(preview: unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/deletion-preview")) return json(preview);
    if (url.endsWith("/auth/account") && init?.method === "DELETE") {
      return json({ deleted_at: "2026-10-12T00:00:00Z", purge_after: "2026-11-11T00:00:00Z" });
    }
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/settings/account"]}>
        <Routes>
          <Route path="/settings/account" element={<DeleteAccount />} />
          <Route path="/login" element={<p>login page</p>} />
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

describe("delete account", () => {
  it("a member is told their organization carries on, and deletes after acknowledging", async () => {
    const fetchMock = mockApi({
      role_effect: "member",
      organizations_deleted: [],
      organizations_left: [{ id: "o1", name: "Acme Steel" }],
      purge_after_days: 30,
    });
    renderPage();
    expect(await screen.findByTestId("orgs-left")).toHaveTextContent("Acme Steel");
    expect(screen.getAllByText(/30 days/).length).toBeGreaterThan(0);

    const button = screen.getByRole("button", { name: /delete my account/i });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
    expect(localStorage.getItem("orderflow_tokens")).toBeNull();
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(JSON.parse(String(del?.[1]?.body))).toEqual({ confirm_organization_names: [] });
  });

  it("an owner must type the organization name before the button works", async () => {
    const fetchMock = mockApi({
      role_effect: "owner",
      organizations_deleted: [{ id: "o1", name: "Acme Steel", member_count: 4 }],
      organizations_left: [],
      purge_after_days: 30,
    });
    renderPage();
    expect(await screen.findByTestId("orgs-deleted")).toHaveTextContent(/4 members will lose access/);

    fireEvent.click(screen.getByRole("checkbox"));
    const button = screen.getByRole("button", { name: /delete my account/i });
    fireEvent.change(screen.getByLabelText(/type "acme steel"/i), { target: { value: "Acme" } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type "acme steel"/i), { target: { value: "Acme Steel" } });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(JSON.parse(String(del?.[1]?.body))).toEqual({ confirm_organization_names: ["Acme Steel"] });
  });
});
