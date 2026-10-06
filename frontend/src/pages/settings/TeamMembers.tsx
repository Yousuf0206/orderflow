import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../services/apiClient";

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
  const { data } = useQuery({ queryKey: ["members"], queryFn: () => api.get<Member[]>("/org/members") });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/org/members/invite", { email, role });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch {
      setError("Could not send invite (already a member, or invalid role?).");
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team</h1>
      <form onSubmit={invite} className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-2 items-end">
        {error && <p className="text-sm text-red-600 w-full">{error}</p>}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded px-3 py-2">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <button className="bg-slate-900 text-white rounded px-4 py-2 text-sm">Invite</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-left border-b text-slate-500">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((m) => (
              <tr key={m.id} className="border-b last:border-b-0">
                <td className="px-4 py-2">{m.email}</td>
                <td className="px-4 py-2">
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className="border rounded px-2 py-1">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">{m.accepted ? "Active" : "Pending"}</td>
                <td className="px-4 py-2">
                  <button onClick={() => remove(m.id)} className="text-red-600 text-xs">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
