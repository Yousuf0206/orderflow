import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Inbox, Sheet } from "lucide-react";
import { useState } from "react";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import QueryState from "../../components/ui/QueryState";
import PageHeader from "../../components/ui/PageHeader";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { api, ApiError, describeApiError, getTokens } from "../../services/apiClient";

const REPORTS = [
  { key: "remaining-by-party", label: "Remaining by Party" },
  { key: "overdue-orders", label: "Overdue Orders" },
  { key: "dispatch-history", label: "Dispatch History" },
];

const EXPORT_FORMATS = [
  { format: "csv", label: "CSV", icon: Sheet },
  { format: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { format: "pdf", label: "PDF", icon: FileText },
] as const;

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function Reports() {
  const [selected, setSelected] = useState(REPORTS[0].key);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["report", selected],
    queryFn: () => api.get<Record<string, unknown>[]>(`/reports/${selected}`),
  });

  async function exportReport(format: (typeof EXPORT_FORMATS)[number]["format"]) {
    setExporting(format);
    setExportError(null);
    try {
      const tokens = getTokens();
      const url = `${API_BASE}/reports/${selected}/export?format=${format}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${tokens?.access_token}` } });

      // Checked before building the download. Without this, a 403 or 500
      // response body went straight into createObjectURL and landed in the
      // user's downloads as a file named report.csv containing a JSON error.
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new ApiError(resp.status, body);
      }

      const disposition = resp.headers.get("content-disposition") ?? "";
      const filenameMatch = /filename="?([^"]+)"?/.exec(disposition);
      const blob = await resp.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filenameMatch?.[1] ?? `${selected}.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      // Previously only a `finally`, so a network failure stopped the spinner
      // and raised an unhandled rejection -- the export simply never happened
      // and nothing said so.
      setExportError(describeApiError(err, "That export didn't download. Please try again."));
    } finally {
      setExporting(null);
    }
  }

  const columns = data && data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description="Standard reports, exportable to CSV, Excel, or PDF." />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {REPORTS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          {EXPORT_FORMATS.map(({ format, label, icon: Icon }) => (
            <Button
              key={format}
              variant="secondary"
              disabled={exporting !== null}
              onClick={() => exportReport(format)}
            >
              <Icon size={15} />
              {exporting === format ? "Exporting..." : label}
            </Button>
          ))}
        </div>
      </div>

      {exportError && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          {exportError}
        </p>
      )}

      <Card className="overflow-x-auto">
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          refetch={refetch}
          errorFallback="We couldn't load this report. Your records are unaffected."
          loading={<TableSkeleton />}
          isEmpty={(rows) => rows.length === 0}
          empty={<EmptyState icon={Inbox} title="No data for this report yet" />}
        >
          {(rows) => (
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
                {columns.map((c) => (
                  <th key={c} className="px-5 py-3">{c.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  {columns.map((c) => (
                    <td key={c} className="px-5 py-3 text-slate-700 dark:text-slate-200">{String(row[c])}</td>
                  ))}
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
