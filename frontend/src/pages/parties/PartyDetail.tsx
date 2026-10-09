import { useQuery } from "@tanstack/react-query";
import { FileText, Inbox, Sheet } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import QueryState from "../../components/ui/QueryState";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/Badge";
import { api, describeApiError } from "../../services/apiClient";
import { downloadExport } from "../../services/download";

interface OpenOrder {
  id: string;
  po_number: string;
  material: string;
  remaining_balance: number;
  status: string;
  due_date: string;
}

interface PartyDetailData {
  party: { id: string; party_code: string; party_name: string; city: string | null };
  open_orders: OpenOrder[];
}

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export default function PartyDetail() {
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["party", id],
    queryFn: () => api.get<PartyDetailData>(`/parties/${id}`),
    enabled: !!id,
  });

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      data={data}
      refetch={refetch}
      errorFallback="We couldn't load this party. It may have been removed, or the connection dropped."
      loading={
        <div className="space-y-6">
          <PageHeader title="Party" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      {(party) => <PartyDetailView data={party} />}
    </QueryState>
  );
}

function PartyDetailView({ data }: { data: PartyDetailData }) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const hasOpenOrders = data.open_orders.length > 0;

  async function exportRemaining(format: "csv" | "pdf") {
    setExporting(format);
    setExportError(null);
    try {
      await downloadExport(
        `/parties/${data.party.id}/remaining/export?format=${format}`,
        `${data.party.party_code}-remaining.${format}`,
      );
    } catch (err) {
      // Says so rather than failing silently, and saves nothing it could not
      // verify -- a file named like data but containing an error is worse than
      // no file (FR-023).
      setExportError(
        describeApiError(err, "That export didn't download. Please try again."),
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    // data-capture marks the region the landing-page screenshot script crops
    // (specs/003-landing-page-upgrade/contracts/image-assets.md). It includes
    // the party header so the crop names the party whose orders are shown.
    <div className="space-y-6" data-capture="party-open-orders">
      <PageHeader
        title={data.party.party_name}
        description={`${data.party.party_code}${data.party.city ? ` · ${data.party.city}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            {/* Disabled rather than hidden when there is nothing pending, with
                the reason in the title: a file a trader forwards showing
                nothing outstanding, when the real answer is "we could not tell
                you", is worse than no file (FR-024). */}
            <Button
              variant="secondary"
              disabled={!hasOpenOrders || exporting !== null}
              title={hasOpenOrders ? undefined : "No open orders to export"}
              onClick={() => exportRemaining("csv")}
            >
              <Sheet size={15} />
              {exporting === "csv" ? "Exporting..." : "Export remaining"}
            </Button>
            <Button
              variant="secondary"
              disabled={!hasOpenOrders || exporting !== null}
              title={hasOpenOrders ? undefined : "No open orders to export"}
              onClick={() => exportRemaining("pdf")}
            >
              <FileText size={15} />
              {exporting === "pdf" ? "Preparing..." : "Printable summary"}
            </Button>
          </div>
        }
      />

      {exportError && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          {exportError}
        </p>
      )}
      <Card className="overflow-x-auto">
        {data.open_orders.length === 0 ? (
          <EmptyState icon={Inbox} title="No open orders for this party" />
        ) : (
          <table className="w-full min-w-[500px] text-sm">
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
              {data.open_orders.map((po) => (
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
      </Card>
    </div>
  );
}
