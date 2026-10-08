import { useQuery } from "@tanstack/react-query";
import { Package, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import QueryState from "../../components/ui/QueryState";
import PageHeader from "../../components/ui/PageHeader";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/Badge";
import { api } from "../../services/apiClient";

interface PurchaseOrder {
  id: string;
  po_number: string;
  material: string;
  remaining_balance: number;
  status: string;
  due_date: string;
}

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export default function PurchaseOrdersList() {
  const [status, setStatus] = useState("");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["purchase-orders", status],
    queryFn: () => api.get<PurchaseOrder[]>(`/purchase-orders${status ? `?status=${status}` : ""}`),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase Orders"
        description="Track ordered quantities, dispatches, and remaining balances in real time."
        action={
          <Link to="/purchase-orders/new">
            <Button>
              <Plus size={16} /> New Purchase Order
            </Button>
          </Link>
        }
      />

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-56"
      >
        <option value="">All statuses</option>
        <option value="on_track">On Track</option>
        <option value="due_soon">Due Soon</option>
        <option value="overdue">Overdue</option>
        <option value="fully_dispatched">Fully Dispatched</option>
      </select>

      <Card className="overflow-x-auto">
        {/* `data ?? []` used to show "No purchase orders yet" when the fetch
            had failed, which reads as "your orders are gone" rather than "we
            couldn't load them". */}
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          refetch={refetch}
          errorFallback="We couldn't load your purchase orders. Your data is safe — this is a display problem."
          loading={<TableSkeleton />}
          isEmpty={(rows) => rows.length === 0}
          empty={
            <EmptyState
              icon={Package}
              title={status ? "No purchase orders with that status" : "No purchase orders yet"}
              description={
                status
                  ? "Try a different status filter."
                  : "Create your first PO to start tracking dispatches and remaining balance."
              }
              action={
                status ? undefined : (
                  <Link to="/purchase-orders/new">
                    <Button>
                      <Plus size={16} /> New Purchase Order
                    </Button>
                  </Link>
                )
              }
            />
          }
        >
          {(rows) => (
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">PO Number</th>
                <th className="px-5 py-3">Material</th>
                <th className="px-5 py-3">Remaining</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-3">
                    <Link to={`/purchase-orders/${po.id}`} className="font-medium text-slate-900 hover:text-brand-600 hover:underline dark:text-white">
                      {po.po_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{po.material}</td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{numberFmt.format(po.remaining_balance)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{po.due_date}</td>
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
