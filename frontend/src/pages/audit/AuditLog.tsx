import { useQuery } from "@tanstack/react-query";

import { api } from "../../services/apiClient";

interface AuditEntry {
  id: string;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export default function AuditLog() {
  const { data, isLoading } = useQuery({ queryKey: ["audit-log"], queryFn: () => api.get<AuditEntry[]>("/audit-log") });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left border-b text-slate-500">
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4">Loading...</td></tr>}
            {(data ?? []).map((e) => (
              <tr key={e.id} className="border-b last:border-b-0">
                <td className="px-4 py-2">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">{e.actor_email}</td>
                <td className="px-4 py-2 capitalize">{e.action}</td>
                <td className="px-4 py-2">{e.entity_type} ({e.entity_id.slice(0, 8)})</td>
              </tr>
            ))}
            {!isLoading && (data ?? []).length === 0 && (
              <tr><td className="px-4 py-4 text-slate-500" colSpan={4}>No audit entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
