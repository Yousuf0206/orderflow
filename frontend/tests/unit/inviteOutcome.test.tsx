import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TeamMembers from "../../src/pages/settings/TeamMembers";

/**
 * Three email outcomes, three messages.
 *
 * Two of them mean nothing arrived, and this screen used to report all three
 * the same way -- so an owner on a deployment with no mail service was told an
 * invitation had been sent, and waited two days for a colleague who was never
 * contacted.
 */

const LINK = "https://app.example.com/accept-invite?token=abc.def.ghi";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockApi(inviteResponse: Record<string, unknown>, members: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return json({
          user: { id: "u1", email: "owner@example.com" },
          organization: { id: "o1", name: "Org" },
          role: "owner",
          is_super_admin: false,
        });
      }
      if (url.includes("/org/members/invite") && init?.method === "POST") {
        return json(inviteResponse, 201);
      }
      if (url.includes("/org/members")) return json(members);
      return json({});
    }),
  );
}

function renderTeam() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submitInvite() {
  fireEvent.change(await screen.findByLabelText(/email/i), {
    target: { value: "colleague@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^invite$/i }));
}

const BASE = {
  id: "m1",
  user_id: "u2",
  email: "colleague@example.com",
  role: "staff",
  accepted: false,
};

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

describe("invitation outcome messaging", () => {
  it("names the address when the email actually went out", async () => {
    mockApi({
      ...BASE,
      invitation_email_sent_at: "2026-10-09T10:00:00Z",
      email_outcome: "sent",
      invitation_link: null,
    });
    renderTeam();
    await submitInvite();

    const status = await screen.findByText(/invitation emailed to/i);
    expect(status).toHaveTextContent("colleague@example.com");
    expect(screen.queryByRole("button", { name: /copy link/i })).not.toBeInTheDocument();
  });

  it("says no email could be sent, and offers the link, when mail is unconfigured", async () => {
    mockApi({
      ...BASE,
      invitation_email_sent_at: null,
      email_outcome: "not_configured",
      invitation_link: LINK,
    });
    renderTeam();
    await submitInvite();

    expect(await screen.findByText(/no invitation email could be sent/i)).toBeInTheDocument();
    expect(screen.getByText(LINK)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });

  it("says the email didn't go out, and offers the link, when sending failed", async () => {
    mockApi({
      ...BASE,
      invitation_email_sent_at: null,
      email_outcome: "failed",
      invitation_link: LINK,
    });
    renderTeam();
    await submitInvite();

    expect(await screen.findByText(/didn't go out/i)).toBeInTheDocument();
    expect(screen.getByText(LINK)).toBeInTheDocument();
  });

  it("never claims an email was sent when the outcome says otherwise", async () => {
    mockApi({
      ...BASE,
      invitation_email_sent_at: null,
      email_outcome: "not_configured",
      invitation_link: LINK,
    });
    renderTeam();
    await submitInvite();

    await screen.findByText(/no invitation email could be sent/i);
    expect(screen.queryByText(/invitation emailed to/i)).not.toBeInTheDocument();
  });

  it("distinguishes a pending member who was emailed from one who was not", async () => {
    mockApi({ ...BASE, invitation_email_sent_at: null, email_outcome: "sent" }, [
      { ...BASE, id: "m1", email: "emailed@example.com", invitation_email_sent_at: "2026-10-09T10:00:00Z" },
      { ...BASE, id: "m2", email: "not-emailed@example.com", invitation_email_sent_at: null },
    ]);
    renderTeam();

    await waitFor(() => expect(screen.getByText("emailed@example.com")).toBeInTheDocument());
    expect(screen.getByText("Pending · emailed")).toBeInTheDocument();
    expect(screen.getByText("Pending · not emailed")).toBeInTheDocument();
  });
});
