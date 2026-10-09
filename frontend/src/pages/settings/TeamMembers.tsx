import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import AccessDenied from "../../components/ui/AccessDenied";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input, Select } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import QueryState from "../../components/ui/QueryState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { api, ApiError, describeApiError } from "../../services/apiClient";
import { getMe } from "../../services/auth";

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: string;
  accepted: boolean;
  invitation_email_sent_at: string | null;
}

type EmailOutcome = "sent" | "not_configured" | "failed";

interface InviteResult extends Member {
  email_outcome: EmailOutcome;
  invitation_link: string | null;
}

const ROLES = ["owner", "manager", "staff", "viewer"];

export default function TeamMembers() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 5 * 60 * 1000 });
  const isOwner = me?.role === "owner";
  const {
    data,
    isLoading,
    isError: membersFailed,
    error: membersError,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.get<Member[]>("/org/members"),
    // No retry, matching the app-wide default: a 403 here means "not allowed"
    // and never changes, and anything else now has a visible Retry control.
    retry: false,
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setInviting(true);
    try {
      // The response now says what happened to the email. It used to be
      // ignored, so this screen reported "invited" whether or not anything was
      // sent -- and with no mail service configured, nothing was.
      const invited = await api.post<InviteResult>("/org/members/invite", { email, role });
      setResult(invited);
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      // Shows the server's actual reason. The old message guessed -- "already
      // a member, or invalid role?" -- so hitting the user limit reported a
      // cause that wasn't true and gave no hint what would help.
      setError(describeApiError(err, "Could not send that invite. Please try again."));
    } finally {
      setInviting(false);
    }
  }

  // Both of these previously had no error handling at all: a refusal (the
  // last-owner guard, say) left the row unchanged with nothing said, which
  // reads as a dead button rather than a rule.
  async function changeRole(id: string, newRole: string) {
    setError(null);
    try {
      await api.patch(`/org/members/${id}`, { role: newRole });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      setError(describeApiError(err, "Could not change that member's role."));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.delete(`/org/members/${id}`);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      setError(describeApiError(err, "Could not remove that member."));
    }
  }

  async function resend(id: string) {
    setError(null);
    setResult(null);
    try {
      const again = await api.post<InviteResult>(`/org/members/${id}/resend`, {});
      setResult(again);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      setError(describeApiError(err, "Could not resend that invitation."));
    }
  }

  if (membersError instanceof ApiError && membersError.status === 403) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team" />
        <AccessDenied description="Only owners and managers can view team members." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Invite teammates and manage their access." />

      {isOwner && (
        <Card>
          <form onSubmit={invite} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            {error && (
              <p role="alert" className="sm:col-span-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </p>
            )}
            <FormField label="Email" required>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-36">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </FormField>
            <Button type="submit" disabled={inviting} block>
              {inviting ? "Inviting..." : "Invite"}
            </Button>
          </form>
          {result && <InviteOutcome result={result} />}
        </Card>
      )}

      <Card className="overflow-x-auto">
        {/* Converged onto the shared component: this screen was the only one
            handling an error at all, by its own hand-rolled route. */}
        <QueryState
          isLoading={isLoading}
          isError={membersFailed}
          error={membersError}
          data={data}
          refetch={refetchMembers}
          errorFallback="We couldn't load your team members."
          loading={<TableSkeleton rows={4} cols={4} />}
        >
          {(rows) => (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                {isOwner && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td className="px-5 py-3 text-slate-900 dark:text-white">{m.email}</td>
                  <td className="px-5 py-3">
                    {isOwner ? (
                      <Select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className="sm:w-32">
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="capitalize text-slate-600 dark:text-slate-300">{m.role}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        m.accepted
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                          : "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
                      }`}
                    >
                      {m.accepted
                        ? "Active"
                        : m.invitation_email_sent_at
                          ? "Pending · emailed"
                          : "Pending · not emailed"}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {!m.accepted && (
                          <button
                            onClick={() => resend(m.id)}
                            className="min-h-11 rounded-md px-2 text-xs font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-400"
                          >
                            Resend / get link
                          </button>
                        )}
                        <button
                          onClick={() => remove(m.id)}
                          className="min-h-11 rounded-md px-2 text-xs font-medium text-red-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

/**
 * What actually happened to the invitation email.
 *
 * Three outcomes, three different messages, because two of them mean nothing
 * arrived. This screen used to say "invited" for all three, so an owner on a
 * deployment with no mail service waited two days for a colleague who was
 * never contacted.
 */
function InviteOutcome({ result }: { result: InviteResult }) {
  const [copied, setCopied] = useState(false);

  if (result.email_outcome === "sent") {
    return (
      <p
        role="status"
        className="mx-5 mb-5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      >
        Invitation emailed to <span className="font-medium">{result.email}</span>.
      </p>
    );
  }

  const headline =
    result.email_outcome === "not_configured"
      ? `${result.email} was added, but no invitation email could be sent — this deployment has no mail service configured.`
      : `${result.email} was added, but the invitation email didn't go out.`;

  async function copy() {
    if (!result.invitation_link) return;
    try {
      await navigator.clipboard.writeText(result.invitation_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused. The link is on screen and
      // selectable, so there is still a way through.
      setCopied(false);
    }
  }

  return (
    <div
      role="status"
      className="mx-5 mb-5 space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <p>{headline}</p>
      {result.invitation_link && (
        <>
          <p>Send them this link and they can set a password and join:</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="block flex-1 break-all rounded border border-amber-300/60 bg-white/70 px-2 py-1 text-xs dark:border-amber-500/20 dark:bg-slate-900/60">
              {result.invitation_link}
            </code>
            <Button variant="secondary" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
