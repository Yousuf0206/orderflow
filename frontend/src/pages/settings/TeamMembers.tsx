import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import AccessDenied from "../../components/ui/AccessDenied";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField, Input, Select } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { api, ApiError } from "../../services/apiClient";
import { getMe } from "../../services/auth";

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: string;
  accepted: boolean;
}

const ROLES = ["owner", "manager", "staff", "viewer"];

export default function TeamMembers() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 5 * 60 * 1000 });
  const isOwner = me?.role === "owner";
  const { data, isLoading, error: membersError } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.get<Member[]>("/org/members"),
    retry: (failureCount, err) => !(err instanceof ApiError && err.status === 403) && failureCount < 3,
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await api.post("/org/members/invite", { email, role });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch {
      setError("Could not send invite (already a member, or invalid role?).");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(id: string, newRole: string) {
    await api.patch(`/org/members/${id}`, { role: newRole });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  async function remove(id: string) {
    await api.delete(`/org/members/${id}`);
    queryClient.invalidateQueries({ queryKey: ["members"] });
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
            <Button type="submit" disabled={inviting} className="w-full sm:w-auto">
              {inviting ? "Inviting..." : "Invite"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto">
        {isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
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
              {(data ?? []).map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td className="px-5 py-3 text-slate-900 dark:text-white">{m.email}</td>
                  <td className="px-5 py-3">
                    {isOwner ? (
                      <Select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className="min-h-0 py-1.5">
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
                      {m.accepted ? "Active" : "Pending"}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-5 py-3">
                      <button
                        onClick={() => remove(m.id)}
                        className="rounded-md px-2 py-1.5 text-xs font-medium text-red-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
