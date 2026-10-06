import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../services/apiClient";

interface OrgRow {
  id: string;
  name: string;
  plan_tier: string;
  is_suspended: boolean;
  user_count: number;
  active_po_count: number;
}

interface Metrics {
  organization_count: number;
  suspended_count: number;
  total_active_pos: number;
}

export default function SuperAdmin() {
  const queryClient = useQueryClient();
  const { data: orgs } = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.get<OrgRow[]>("/admin/organizations") });
  const { data: metrics } = useQuery({ queryKey: ["admin-metrics"], queryFn: () => api.get<Metrics>("/admin/metrics") });

  async function toggleSuspend(org: OrgRow) {
    const action = org.is_suspended ? "reactivate" : "suspend";
    await api.post(`/admin/organizations/${org.id}/${action}`);
    queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Super Admin</h1>
      {metrics && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Organizations</div>
            <div className="text-xl font-semibold">{metrics.organization_count}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Suspended</div>
            <div className="text-xl font-semibold">{metrics.suspended_count}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Total Active POs</div>
            <div className="text-xl font-semibold">{metrics.total_active_pos}</div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left border-b text-slate-500">
              <th className="px-4 py-2">Organization</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Users</th>
              <th className="px-4 py-2">Active POs</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o) => (
              <tr key={o.id} className="border-b last:border-b-0">
                <td className="px-4 py-2">{o.name}</td>
                <td className="px-4 py-2 capitalize">{o.plan_tier}</td>
                <td className="px-4 py-2">{o.user_count}</td>
                <td className="px-4 py-2">{o.active_po_count}</td>
                <td className="px-4 py-2">{o.is_suspended ? "Suspended" : "Active"}</td>
                <td className="px-4 py-2">
                  <button onClick={() => toggleSuspend(o)} className="text-xs underline">
                    {o.is_suspended ? "Reactivate" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
