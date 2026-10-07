import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, PackageOpen, Truck, Wallet } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import { FormField, Input } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import { KpiSkeletonRow, Skeleton, TableSkeleton } from "../../components/ui/Skeleton";
import StatCard from "../../components/ui/StatCard";
import { api } from "../../services/apiClient";

interface PurchaseOrder {
  id: string;
  po_number: string;
  material: string;
  ordered_qty: number;
  unit: string;
  due_date: string;
  total_dispatched: number;
  remaining_balance: number;
  status: string;
}

interface Dispatch {
  id: string;
  dispatch_date: string;
  qty: number;
  vehicle_ref: string | null;
  remarks: string | null;
}

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ dispatch_date: new Date().toISOString().slice(0, 10), qty: "", vehicle_ref: "", remarks: "" });
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: po, isLoading: poLoading } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
    enabled: !!id,
  });
  const { data: dispatches, isLoading: dispatchesLoading } = useQuery({
    queryKey: ["dispatches", id],
    queryFn: () => api.get<Dispatch[]>(`/purchase-orders/${id}/dispatches`),
    enabled: !!id,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submitDispatch(confirm: boolean) {
    setSaving(true);
    try {
      const result = await api.post<{ dispatch: Dispatch | null; warning: string | null }>(
        `/purchase-orders/${id}/dispatches`,
        { ...form, qty: Number(form.qty), confirm },
      );
      if (result.warning && !result.dispatch) {
        setWarning(result.warning);
        return;
      }
      setWarning(null);
      setForm({ dispatch_date: new Date().toISOString().slice(0, 10), qty: "", vehicle_ref: "", remarks: "" });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["dispatches", id] });
    } finally {
      setSaving(false);
    }
  }

  if (poLoading || !po) {
    return (
      <div className="space-y-6">
        <PageHeader title="Loading purchase order…" />
        <KpiSkeletonRow count={3} />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={po.po_number} description={`${po.material} · ${po.unit} · Due ${po.due_date}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ordered" value={numberFmt.format(po.ordered_qty)} icon={PackageOpen} />
        <StatCard label="Dispatched" value={numberFmt.format(po.total_dispatched)} icon={Truck} tone="success" />
        <StatCard label="Remaining" value={numberFmt.format(po.remaining_balance)} icon={Wallet} tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Record a Dispatch</h2>
        </CardHeader>
        <div className="space-y-4 p-5">
          {warning && (
            <div
              role="alert"
              aria-live="assertive"
              className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <p>{warning}</p>
              <button
                type="button"
                onClick={() => submitDispatch(true)}
                className="inline-flex min-h-[2.25rem] items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                Confirm anyway
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitDispatch(false);
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <FormField label="Dispatch Date" required>
              <Input
                type="date"
                required
                value={form.dispatch_date}
                onChange={(e) => update("dispatch_date", e.target.value)}
              />
            </FormField>
            <FormField label="Qty" required>
              <Input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                required
                value={form.qty}
                onChange={(e) => update("qty", e.target.value)}
              />
            </FormField>
            <FormField label="Vehicle / Ref">
              <Input value={form.vehicle_ref} onChange={(e) => update("vehicle_ref", e.target.value)} />
            </FormField>
            <FormField label="Remarks">
              <Input value={form.remarks} onChange={(e) => update("remarks", e.target.value)} />
            </FormField>
            <Button type="submit" disabled={saving} className="sm:col-span-2">
              {saving ? "Saving..." : "Add Dispatch"}
            </Button>
          </form>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <CardHeader>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Dispatch History</h2>
        </CardHeader>
        {dispatchesLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (dispatches ?? []).length === 0 ? (
          <EmptyState icon={PackageCheck} title="No dispatches recorded yet" description="Dispatches you record above will appear here." />
        ) : (
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">Vehicle/Ref</th>
                <th className="px-5 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(dispatches ?? []).map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{d.dispatch_date}</td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{numberFmt.format(d.qty)}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{d.vehicle_ref ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{d.remarks ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
