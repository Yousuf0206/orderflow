import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import { Card } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import QueryState from "../../components/ui/QueryState";
import PageHeader from "../../components/ui/PageHeader";
import { TableSkeleton } from "../../components/ui/Skeleton";
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
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => api.get<AuditEntry[]>("/audit-log"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="A record of actions taken across your organization." />
      <Card className="overflow-x-auto">
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          refetch={refetch}
          errorFallback="We couldn't load the audit log. Your records are unaffected."
          loading={<TableSkeleton rows={6} cols={4} />}
          isEmpty={(rows) => rows.length === 0}
          empty={
            <EmptyState
              icon={ScrollText}
              title="No audit entries yet"
              description="Actions taken in your organization will show up here."
            />
          }
        >
          {(rows) => (
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{e.actor_email}</td>
                  <td className="px-5 py-3 capitalize text-slate-900 dark:text-white">{e.action}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {e.entity_type} ({e.entity_id.slice(0, 8)})
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
