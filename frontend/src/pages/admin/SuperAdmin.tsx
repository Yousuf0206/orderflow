import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pause, ShieldAlert } from "lucide-react";

import { Card } from "../../components/ui/Card";
import ErrorState from "../../components/ui/ErrorState";
import PageHeader from "../../components/ui/PageHeader";
import QueryState from "../../components/ui/QueryState";
import { KpiSkeletonRow, TableSkeleton } from "../../components/ui/Skeleton";
import StatCard from "../../components/ui/StatCard";
import { api, describeApiError } from "../../services/apiClient";

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
  const {
    data: orgs,
    isLoading: orgsLoading,
    isError: orgsFailed,
    error: orgsError,
    refetch: refetchOrgs,
  } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => api.get<OrgRow[]>("/admin/organizations"),
  });
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsFailed,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => api.get<Metrics>("/admin/metrics"),
  });

  async function toggleSuspend(org: OrgRow) {
    const action = org.is_suspended ? "reactivate" : "suspend";
    await api.post(`/admin/organizations/${org.id}/${action}`);
    queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Super Admin" description="Manage organizations across the platform." />

      {metricsFailed ? (
        <ErrorState
          description={describeApiError(metricsError, "We couldn't load platform metrics.")}
          onRetry={refetchMetrics}
        />
      ) : metricsLoading || !metrics ? (
        <KpiSkeletonRow count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Organizations" value={String(metrics.organization_count)} icon={Building2} />
          <StatCard label="Suspended" value={String(metrics.suspended_count)} icon={Pause} tone="danger" />
          <StatCard label="Total Active POs" value={String(metrics.total_active_pos)} icon={ShieldAlert} tone="warning" />
        </div>
      )}

      <Card className="overflow-x-auto">
        <QueryState
          isLoading={orgsLoading}
          isError={orgsFailed}
          error={orgsError}
          data={orgs}
          refetch={refetchOrgs}
          errorFallback="We couldn't load the organization list."
          loading={<TableSkeleton rows={5} cols={5} />}
          isEmpty={(rows) => rows.length === 0}
          empty={<p className="p-5 text-sm text-slate-500">No organizations yet.</p>}
        >
          {(rows) => (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">Organization</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Users</th>
                <th className="px-5 py-3">Active POs</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{o.name}</td>
                  <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">{o.plan_tier}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{o.user_count}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{o.active_po_count}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        o.is_suspended
                          ? "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                      }`}
                    >
                      {o.is_suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleSuspend(o)}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-300"
                    >
                      {o.is_suspended ? "Reactivate" : "Suspend"}
                    </button>
                  </td>
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
