import { useQuery } from "@tanstack/react-query";
import { Package, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import QueryState from "../../components/ui/QueryState";
import PageHeader from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Field";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/Badge";
import { usePermissions } from "../../hooks/usePermissions";
import { api } from "../../services/apiClient";

interface PurchaseOrder {
  id: string;
  po_number: string;
  material: string;
  remaining_balance: number;
  status: string;
  due_date: string;
}

interface Party {
  id: string;
  party_code: string;
  party_name: string;
}

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const STATUS_OPTIONS = [
  { value: "on_track", label: "On Track" },
  { value: "due_soon", label: "Due Soon" },
  { value: "overdue", label: "Overdue" },
  { value: "fully_dispatched", label: "Fully Dispatched" },
];

export default function PurchaseOrdersList() {
  /**
   * Filters live in the URL, not in component state.
   *
   * Three requirements collapse into that one decision: they survive
   * navigating to an order and back (the browser restores the URL), the
   * dashboard's Overdue figure becomes an ordinary link to
   * ?status=overdue rather than cross-screen state passing, and a trader can
   * send a colleague a link to a filtered view -- which a spreadsheet cannot
   * do at all.
   */
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const partyId = params.get("party_id") ?? "";
  const search = params.get("q") ?? "";
  const permissions = usePermissions();

  // Typing goes into local state and lands in the URL after a pause, so the
  // address bar does not gain a history entry per keystroke.
  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => {
    if (searchDraft === search) return;
    const timer = setTimeout(() => setFilter("q", searchDraft), 300);
    return () => clearTimeout(timer);
  }, [searchDraft, search]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const { data: parties } = useQuery({
    queryKey: ["parties"],
    queryFn: () => api.get<Party[]>("/parties"),
    staleTime: 5 * 60 * 1000,
  });

  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (partyId) query.set("party_id", partyId);
  if (search) query.set("q", search);
  const queryString = query.toString();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["purchase-orders", status, partyId, search],
    queryFn: () =>
      api.get<PurchaseOrder[]>(`/purchase-orders${queryString ? `?${queryString}` : ""}`),
  });

  const hasFilters = Boolean(status || partyId || search);
  const partyName = parties?.find((p) => p.id === partyId)?.party_name;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase Orders"
        description="Track ordered quantities, dispatches, and remaining balances in real time."
        action={
          permissions.canManageOrders ? (
            <Link to="/purchase-orders/new">
              <Button>
                <Plus size={16} /> New Purchase Order
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          className="sm:w-48"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by party"
          value={partyId}
          onChange={(e) => setFilter("party_id", e.target.value)}
          className="sm:w-56"
        >
          <option value="">All parties</option>
          {(parties ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.party_name}
            </option>
          ))}
        </Select>

        <input
          type="search"
          aria-label="Search PO number"
          placeholder="Search PO number"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:w-56"
        />
      </div>

      {/* Each filter is clearable on its own, and what is active is visible --
          a narrowed list with no indication of why is indistinguishable from
          missing data. */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Filtered by</span>
          {status && (
            <FilterChip
              label={STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
              onClear={() => setFilter("status", "")}
            />
          )}
          {partyId && (
            <FilterChip label={partyName ?? "Selected party"} onClear={() => setFilter("party_id", "")} />
          )}
          {search && <FilterChip label={`"${search}"`} onClear={() => setFilter("q", "")} />}
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="min-h-11 font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400"
          >
            Clear all
          </button>
        </div>
      )}

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
            /* "No purchase orders yet" means the organization is empty. Showing
               it to a trader with 180 orders and an active filter reads as data
               loss, so a filtered no-match says so instead. */
            hasFilters ? (
              <EmptyState
                icon={Package}
                title="No orders match these filters"
                description="Try a different status, party, or PO number."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => setParams(new URLSearchParams(), { replace: true })}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Package}
                title="No purchase orders yet"
                description="Create your first PO to start tracking dispatches and remaining balance."
                action={
                  permissions.canManageOrders ? (
                    <Link to="/purchase-orders/new">
                      <Button>
                        <Plus size={16} /> New Purchase Order
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            )
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
                    <Link
                      to={`/purchase-orders/${po.id}`}
                      className="flex min-h-11 items-center font-medium text-slate-900 hover:text-brand-600 hover:underline dark:text-white"
                    >
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

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-slate-100 px-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label} filter`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <X size={14} />
      </button>
    </span>
  );
}
