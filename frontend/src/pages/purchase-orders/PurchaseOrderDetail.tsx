import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, PackageOpen, Truck, Wallet } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import { FormField, Input } from "../../components/ui/Field";
import PageHeader from "../../components/ui/PageHeader";
import QueryState from "../../components/ui/QueryState";
import { PermissionsUnconfirmed, RoleRequired } from "../../components/ui/RoleNotice";
import { KpiSkeletonRow, Skeleton, TableSkeleton } from "../../components/ui/Skeleton";
import StatCard from "../../components/ui/StatCard";
import { usePermissions } from "../../hooks/usePermissions";
import { api, describeApiError } from "../../services/apiClient";

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
  const permissions = usePermissions();
  const [form, setForm] = useState({ dispatch_date: new Date().toISOString().slice(0, 10), qty: "", vehicle_ref: "", remarks: "" });
  const [warning, setWarning] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    data: po,
    isLoading: poLoading,
    isError: poIsError,
    error: poError,
    refetch: refetchPo,
  } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
    enabled: !!id,
  });
  const {
    data: dispatches,
    isLoading: dispatchesLoading,
    isError: dispatchesIsError,
    error: dispatchesError,
    refetch: refetchDispatches,
  } = useQuery({
    queryKey: ["dispatches", id],
    queryFn: () => api.get<Dispatch[]>(`/purchase-orders/${id}/dispatches`),
    enabled: !!id,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submitDispatch(confirm: boolean) {
    setSaving(true);
    setSubmitError(null);
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
    } catch (err) {
      // Without this the dispatch just vanished: the spinner stopped, the form
      // kept its values, and nothing said whether the dispatch was recorded.
      setSubmitError(describeApiError(err, "We couldn't record that dispatch. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <QueryState
      isLoading={poLoading}
      isError={poIsError}
      error={poError}
      data={po}
      refetch={refetchPo}
      errorFallback="We couldn't load this purchase order. It may have been removed, or the connection dropped."
      loading={
        <div className="space-y-6">
          <PageHeader title="Purchase order" />
          <KpiSkeletonRow count={3} />
          <Skeleton className="h-64" />
        </div>
      }
    >
      {(po) => (
    // po-page is the hero shot: the whole screen, so a visitor sees software
    // rather than a thin strip of numbers. po-summary inside it is the tight
    // crop. Both are listed in contracts/image-assets.md.
    <div className="space-y-6" data-capture="po-page">
      {/* data-capture marks the region the landing-page screenshot script
          crops (specs/003-landing-page-upgrade/contracts/image-assets.md).
          Keep it on a wrapper rather than on the grid, so the hero shot
          includes the PO number, material, unit and due date. */}
      <div data-capture="po-summary" className="space-y-6">
        <PageHeader title={po.po_number} description={`${po.material} · ${po.unit} · Due ${po.due_date}`} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Ordered" value={numberFmt.format(po.ordered_qty)} icon={PackageOpen} />
          <StatCard label="Dispatched" value={numberFmt.format(po.total_dispatched)} icon={Truck} tone="success" />
          <StatCard label="Remaining" value={numberFmt.format(po.remaining_balance)} icon={Wallet} tone="warning" />
        </div>
      </div>

      {/* The form is rendered only for a role the server will accept.
          Previously every Viewer filled it in and was refused by
          dispatches.py, with nothing wrong with what they had typed -- which
          reads as a broken product rather than a permission boundary. */}
      <Card data-testid="dispatch-card">
        <CardHeader>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Record a Dispatch</h2>
        </CardHeader>
        {permissions.unknown ? (
          <PermissionsUnconfirmed onRetry={permissions.retry} />
        ) : !permissions.canRecordDispatch ? (
          <RoleRequired action="Recording dispatches" role="Staff" />
        ) : (
        <div className="space-y-4 p-5">
          {submitError && (
            <p
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
            >
              {submitError}
            </p>
          )}
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
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 sm:w-auto"
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
            {/* Full width on a phone, and last in document flow so an
                on-screen keyboard over a field above does not cover it. */}
            <Button type="submit" disabled={saving} block className="sm:col-span-2">
              {saving ? "Saving..." : "Add Dispatch"}
            </Button>
          </form>
        </div>
        )}
      </Card>

      <div data-capture="dispatch-history">
      <Card className="overflow-x-auto">
        <CardHeader>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Dispatch History</h2>
        </CardHeader>
        {/* Its own QueryState: when this fetch failed, `dispatches ?? []` used to
            render "No dispatches recorded yet" -- telling a trader the order has
            no dispatches when in fact we never found out. */}
        <QueryState
          isLoading={dispatchesLoading}
          isError={dispatchesIsError}
          error={dispatchesError}
          data={dispatches}
          refetch={refetchDispatches}
          errorFallback="We couldn't load the dispatch history for this order."
          loading={<TableSkeleton rows={4} cols={4} />}
          isEmpty={(rows) => rows.length === 0}
          empty={
            <EmptyState
              icon={PackageCheck}
              title="No dispatches recorded yet"
              description="Dispatches you record above will appear here."
            />
          }
        >
          {(rows) => (
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
              {rows.map((d) => (
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
        </QueryState>
      </Card>
      </div>
    </div>
      )}
    </QueryState>
  );
}
