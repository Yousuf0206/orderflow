import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Inbox, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardHeader } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import { KpiSkeletonRow, Skeleton } from "../../components/ui/Skeleton";
import StatCard from "../../components/ui/StatCard";
import PageHeader from "../../components/ui/PageHeader";
import { STATUS_META } from "../../components/ui/statusMeta";
import { api } from "../../services/apiClient";

interface DashboardData {
  total_remaining_balance: number;
  overdue_count: number;
  due_soon_count: number;
  on_track_count: number;
  fully_dispatched_count: number;
  total_po_count: number;
  party_summary: { party_id: string; party_name: string; remaining_balance: number }[];
}

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/dashboard"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Live overview of remaining balances and delivery status." />
        <KpiSkeletonRow />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72 lg:col-span-3" />
        </div>
      </div>
    );
  }

  const statusData = [
    { key: "on_track", value: data.on_track_count },
    { key: "due_soon", value: data.due_soon_count },
    { key: "overdue", value: data.overdue_count },
    { key: "fully_dispatched", value: data.fully_dispatched_count },
  ].filter((d) => d.value > 0);

  const partyChartData = data.party_summary.slice(0, 8).map((p) => ({
    name: p.party_name.length > 16 ? `${p.party_name.slice(0, 15)}…` : p.party_name,
    fullName: p.party_name,
    value: p.remaining_balance,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Live overview of remaining balances and delivery status." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Remaining Balance"
          value={numberFmt.format(data.total_remaining_balance)}
          icon={Wallet}
          hint={`${data.total_po_count} active purchase order${data.total_po_count === 1 ? "" : "s"}`}
        />
        <StatCard label="On Track" value={String(data.on_track_count)} icon={CheckCircle2} tone="success" />
        <StatCard label="Due Soon" value={String(data.due_soon_count)} icon={Clock} tone="warning" />
        <StatCard label="Overdue" value={String(data.overdue_count)} icon={AlertTriangle} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">PO Status Breakdown</h2>
          </CardHeader>
          <div className="p-5">
            {statusData.length === 0 ? (
              <EmptyState icon={Inbox} title="No purchase orders yet" description="Create your first PO to see status breakdown here." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="key"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.key} fill={STATUS_META[entry.key].chartColor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, item) => [
                        value,
                        STATUS_META[(item.payload as { key: string }).key]?.label ?? "",
                      ]}
                      contentStyle={{ borderRadius: 8, fontSize: 13 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {statusData.map((entry) => (
                    <li key={entry.key} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[entry.key].chartColor }} />
                      {STATUS_META[entry.key].label}
                      <span className="ml-auto font-medium text-slate-900 dark:text-white">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Remaining Balance by Party</h2>
          </CardHeader>
          <div className="p-5">
            {partyChartData.length === 0 ? (
              <EmptyState icon={Inbox} title="No open balances" description="Remaining balances by party will appear here once you have open purchase orders." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={partyChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" />
                  <Tooltip
                    formatter={(value) => numberFmt.format(Number(value))}
                    labelFormatter={(_label, payload) =>
                      (payload?.[0]?.payload as { fullName?: string } | undefined)?.fullName ?? ""
                    }
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Remaining by Party</h2>
        </CardHeader>
        {data.party_summary.length === 0 ? (
          <EmptyState icon={Inbox} title="No open balances yet" />
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.party_summary.map((row) => (
                <tr key={row.party_id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td className="px-5 py-2.5">
                    <Link to={`/parties/${row.party_id}`} className="text-slate-700 hover:text-brand-600 hover:underline dark:text-slate-200">
                      {row.party_name}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium text-slate-900 dark:text-white">
                    {numberFmt.format(row.remaining_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
