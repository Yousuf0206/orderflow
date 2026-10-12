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
import { api, describeApiError, NetworkError } from "../../services/apiClient";
import { getMe } from "../../services/auth";
import { needsCheck, type ScanDraft } from "../../services/scans";
import ScanDraftPanel from "./ScanDraftPanel";
import {
  type Dispatch,
  type DispatchCreateResponse,
  formatQty,
  type PurchaseOrder,
} from "../../services/purchaseOrders";

function blankHeader() {
  return { dispatch_date: new Date().toISOString().slice(0, 10), vehicle_ref: "", remarks: "" };
}

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const [header, setHeader] = useState(blankHeader);
  // Qty per line id. Blank or 0 means "not on this truck".
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<string | null>(null);
  const [overLineIds, setOverLineIds] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // True while re-reading the order after a save whose outcome is unknown.
  const [verifying, setVerifying] = useState(false);
  // A delivery-note scan filling this form (spec 008). Only a draft: the
  // form's own submit is still the one way a dispatch is recorded.
  const [draft, setDraft] = useState<ScanDraft | null>(null);
  const [rowLines, setRowLines] = useState<Record<number, string>>({});
  // Fields read with doubt, keyed "dispatch_date", "vehicle_ref", or a line id.
  const [toCheck, setToCheck] = useState<Set<string>>(new Set());
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 5 * 60 * 1000 });

  function applyDraft(d: ScanDraft) {
    const check = new Set<string>();
    if (needsCheck(d.document_date)) check.add("dispatch_date");
    if (needsCheck(d.vehicle_ref)) check.add("vehicle_ref");
    const next: Record<string, string> = {};
    for (const row of d.lines) {
      if (!row.matched_line_id) continue;
      next[row.matched_line_id] = row.qty.value ?? "";
      if (row.qty.confidence !== "high" || row.match_confidence === "low" || row.qty.value === null) {
        check.add(row.matched_line_id);
      }
    }
    setHeader({
      dispatch_date: d.document_date.value ?? blankHeader().dispatch_date,
      vehicle_ref: d.vehicle_ref.value ?? "",
      remarks: "",
    });
    setQtys(next);
    setToCheck(check);
    setRowLines({});
    setDraft(d);
    setWarning(null);
    setOverLineIds(new Set());
    setSubmitError(null);
  }

  /** The user placed an unmatched read row on a line of this order, or skipped it. */
  function assignRow(row: number, lineId: string) {
    const previous = rowLines[row];
    const value = draft?.lines[row]?.qty.value ?? "";
    setQtys((prev) => {
      const next = { ...prev };
      if (previous) delete next[previous];
      if (lineId) next[lineId] = value;
      return next;
    });
    setToCheck((prev) => {
      const next = new Set(prev);
      if (previous) next.delete(previous);
      if (lineId) next.add(lineId);
      return next;
    });
    setRowLines((prev) => ({ ...prev, [row]: lineId }));
  }

  function clearDraft() {
    setDraft(null);
    setRowLines({});
    setToCheck(new Set());
  }

  function discardDraft() {
    clearDraft();
    setHeader(blankHeader());
    setQtys({});
  }

  const checkHint = "Check this — read from the note";

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

  function updateHeader<K extends keyof ReturnType<typeof blankHeader>>(key: K, value: string) {
    setHeader((prev) => ({ ...prev, [key]: value }));
  }

  function updateQty(lineId: string, value: string) {
    setQtys((prev) => ({ ...prev, [lineId]: value }));
    setToCheck((prev) => {
      if (!prev.has(lineId)) return prev;
      const next = new Set(prev);
      next.delete(lineId);
      return next;
    });
    // Editing the figures invalidates a warning about the old ones.
    setWarning(null);
    setOverLineIds(new Set());
  }

  async function submitDispatch(confirm: boolean) {
    const lines = Object.entries(qtys)
      .map(([lineId, value]) => ({ purchase_order_line_id: lineId, qty: Number(value) }))
      .filter((l) => Number.isFinite(l.qty) && l.qty > 0);
    if (lines.length === 0) {
      setSubmitError("Enter a quantity for at least one item on this truck.");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const result = await api.post<DispatchCreateResponse>(`/purchase-orders/${id}/dispatches`, {
        dispatch_date: header.dispatch_date,
        vehicle_ref: header.vehicle_ref || null,
        remarks: header.remarks || null,
        lines,
        confirm,
        ...(draft ? { source_scan_id: draft.scan_id } : {}),
      });
      if (result.warning && !result.dispatch) {
        setWarning(result.warning);
        setOverLineIds(new Set(result.over_lines.map((o) => o.purchase_order_line_id)));
        return;
      }
      setWarning(null);
      setOverLineIds(new Set());
      setHeader(blankHeader());
      setQtys({});
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["dispatches", id] });
    } catch (err) {
      if (err instanceof NetworkError) {
        // The request may have reached the server before the connection
        // dropped, so "try again" could record the truck twice. Say we don't
        // know, and re-read the order before another submit is allowed.
        setSubmitError(
          "We couldn't confirm this dispatch was saved. Check the history below before recording it again.",
        );
        setVerifying(true);
        try {
          await Promise.all([refetchPo(), refetchDispatches()]);
        } finally {
          setVerifying(false);
        }
        return;
      }
      // Without this the dispatch just vanished: the spinner stopped, the form
      // kept its values, and nothing said whether the dispatch was recorded.
      setSubmitError(describeApiError(err, "We couldn't record that dispatch. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  // On a phone the on-screen keyboard covers the lower half of the screen.
  // Keep the field being typed in visible above it; the submit stays in flow
  // below the fields rather than pinned where the keyboard sits (research R2).
  function keepInView(e: React.FocusEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    window.setTimeout(() => el.scrollIntoView?.({ block: "center", behavior: "smooth" }), 250);
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
      {(po) => {
        const single = po.lines.length === 1 ? po.lines[0] : null;
        const openLines = po.lines.filter((line) => line.remaining_qty > 0);
        return (
    // po-page is the hero shot: the whole screen, so a visitor sees software
    // rather than a thin strip of numbers. po-summary inside it is the tight
    // crop. Both are listed in contracts/image-assets.md.
    <div className="space-y-6" data-capture="po-page">
      {/* data-capture marks the region the landing-page screenshot script
          crops (specs/003-landing-page-upgrade/contracts/image-assets.md).
          Keep it on a wrapper rather than on the grid, so the hero shot
          includes the PO number, material, unit and due date. */}
      <div data-capture="po-summary" className="space-y-6">
        <PageHeader
          title={po.po_number}
          description={
            single
              ? `${single.material} · ${single.unit} · Due ${po.due_date}`
              : `${po.item_count} items · Due ${po.due_date}`
          }
        />

        {single ? (
          // One line reads exactly as a single-material order always has, so
          // the landing screenshots of this screen stay true (Principle XIX).
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Ordered" value={formatQty(single.ordered_qty)} icon={PackageOpen} />
            <StatCard label="Dispatched" value={formatQty(single.dispatched_qty)} icon={Truck} tone="success" />
            <StatCard label="Remaining" value={formatQty(single.remaining_qty)} icon={Wallet} tone="warning" />
          </div>
        ) : (
          <Card className="overflow-x-auto" data-testid="po-lines">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="px-5 py-3">Material</th>
                  <th className="px-5 py-3">Unit</th>
                  <th className="px-5 py-3 text-right">Ordered</th>
                  <th className="px-5 py-3 text-right">Dispatched</th>
                  <th className="px-5 py-3 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{line.material}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{line.unit}</td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">
                      {formatQty(line.ordered_qty)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">
                      {formatQty(line.dispatched_qty)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-amber-700 dark:text-amber-400">
                      {formatQty(line.remaining_qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
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
          {me?.scan_enabled && openLines.length > 0 && (
            <ScanDraftPanel
              poId={po.id}
              openLines={openLines}
              draft={draft}
              onDraft={applyDraft}
              onAssign={assignRow}
              onDiscard={discardDraft}
            />
          )}
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
            <FormField
              label="Dispatch Date"
              required
              hint={toCheck.has("dispatch_date") ? checkHint : undefined}
            >
              <Input
                type="date"
                required
                value={header.dispatch_date}
                onChange={(e) => updateHeader("dispatch_date", e.target.value)}
              />
            </FormField>
            <FormField label="Vehicle / Ref" hint={toCheck.has("vehicle_ref") ? checkHint : undefined}>
              <Input value={header.vehicle_ref} onChange={(e) => updateHeader("vehicle_ref", e.target.value)} />
            </FormField>

            {/* One quantity box per item. Stacked one per row so it fits a
                390px phone without sideways scrolling (Principle XXII). */}
            <fieldset className="space-y-3 sm:col-span-2" data-testid="dispatch-lines">
              {po.lines.length > 1 && (
                <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Quantity on this truck <span className="font-normal text-slate-500">(leave blank if not loaded)</span>
                </legend>
              )}
              {po.lines.map((line) => (
                <FormField
                  key={line.id}
                  label={single ? "Qty" : `${line.material} (${line.unit})`}
                  hint={
                    toCheck.has(line.id)
                      ? `${checkHint} · ${formatQty(line.remaining_qty)} ${line.unit} remaining`
                      : `${formatQty(line.remaining_qty)} ${line.unit} remaining`
                  }
                  error={overLineIds.has(line.id) ? "More than remains on this item" : undefined}
                >
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={qtys[line.id] ?? ""}
                    onChange={(e) => updateQty(line.id, e.target.value)}
                    onFocus={keepInView}
                    aria-invalid={overLineIds.has(line.id) || undefined}
                  />
                </FormField>
              ))}
            </fieldset>

            <FormField label="Remarks">
              <Input value={header.remarks} onChange={(e) => updateHeader("remarks", e.target.value)} />
            </FormField>
            {/* Full width on a phone, and last in document flow so an
                on-screen keyboard over a field above does not cover it. */}
            <Button type="submit" disabled={saving || verifying} block className="sm:col-span-2">
              {verifying ? "Checking..." : saving ? "Saving..." : draft ? "Confirm dispatch" : "Add Dispatch"}
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
                <tr key={d.id} className="border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800">
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{d.dispatch_date}</td>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                    {single ? (
                      formatQty(d.lines[0]?.qty ?? 0)
                    ) : (
                      <ul className="space-y-0.5">
                        {d.lines.map((l) => (
                          <li key={l.purchase_order_line_id}>
                            {formatQty(l.qty)} {l.unit}{" "}
                            <span className="font-normal text-slate-500">{l.material}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
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
        );
      }}
    </QueryState>
  );
}
