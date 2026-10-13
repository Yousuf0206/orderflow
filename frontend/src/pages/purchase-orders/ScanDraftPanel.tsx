import { Camera, ScanLine } from "lucide-react";
import { useState } from "react";

import Button from "../../components/ui/Button";
import { CameraDeniedError, capturePhoto } from "../../platform/capture";
import { ApiError, describeApiError, NetworkError } from "../../services/apiClient";
import { formatQty, type PurchaseOrderLine } from "../../services/purchaseOrders";
import { parseDocument, type ScanDraft } from "../../services/scans";
import { compressImage } from "../../utils/compressImage";

/**
 * Scan a delivery note into the dispatch form below (spec 008). This panel
 * only reads the note and shows what it couldn't place; the form is still the
 * one place a dispatch is recorded, and nothing is saved until the user
 * presses Confirm dispatch (constitution XXXVIII).
 */

const SCAN_ERRORS: Record<string, string> = {
  unreadable: "We couldn't read this note. Try again in better light, holding the phone flat over the note.",
  daily_scan_limit: "Your organization has used today's scans. You can still type the dispatch below.",
  image_too_large: "That photo is too large. Try again, or type the dispatch below.",
  unsupported_image: "That file isn't a photo we can read. Use a JPEG or PNG photo of the note.",
  reader_failed: "The note couldn't be read right now. Nothing was saved. Try again, or type it below.",
  reader_timeout: "Reading the note took too long. Nothing was saved. Try again, or type it below.",
  scanning_disabled: "Scanning is switched off right now. Type the dispatch below.",
};

function scanErrorMessage(err: unknown): string {
  if (err instanceof CameraDeniedError) {
    return "OrderFlow can't use the camera. Allow camera access in your phone's Settings, or choose a saved photo.";
  }
  if (err instanceof ApiError) {
    const detail = (err.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string" && SCAN_ERRORS[detail]) return SCAN_ERRORS[detail];
  }
  if (err instanceof NetworkError) {
    return `${describeApiError(err, "")} The note was not read and nothing was saved.`;
  }
  if (err instanceof Error && err.message === "unsupported_image") return SCAN_ERRORS.unsupported_image;
  return "The note couldn't be read. Nothing was saved. Try again, or type the dispatch below.";
}

export default function ScanDraftPanel({
  poId,
  openLines,
  draft,
  onDraft,
  onAssign,
  onDiscard,
}: {
  poId: string;
  openLines: PurchaseOrderLine[];
  draft: ScanDraft | null;
  onDraft: (draft: ScanDraft) => void;
  /** Row index of an unmatched read row -> a line of this order, or "" to skip it. */
  onAssign: (row: number, lineId: string) => void;
  onDiscard: () => void;
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Record<number, string>>({});

  async function scan() {
    setError(null);
    let photo: Blob | null;
    try {
      // Called first, inside the tap: browsers only open a file picker from
      // a user gesture.
      photo = await capturePhoto();
    } catch (err) {
      setError(scanErrorMessage(err));
      return;
    }
    if (!photo) return;
    setReading(true);
    try {
      const result = await parseDocument(poId, await compressImage(photo));
      setAssigned({});
      onDraft(result);
    } catch (err) {
      setError(scanErrorMessage(err));
    } finally {
      setReading(false);
    }
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <Button type="button" variant="secondary" block onClick={scan} disabled={reading}>
          <Camera size={16} aria-hidden="true" />
          {reading ? "Reading the note..." : "Scan delivery note"}
        </Button>
        {error && (
          <div role="alert" className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            <p>{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={scan} disabled={reading}>
                Retake
              </Button>
              <Button type="button" variant="ghost" onClick={() => setError(null)}>
                Type it instead
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const rows = draft.lines.map((row, index) => ({ row, index }));
  const unmatched = rows.filter(({ row }) => row.matched_line_id === null);
  const matched = rows.filter(({ row }) => row.matched_line_id !== null);
  // The line each row currently sits on: the user's choice, else the scan's match.
  const lineOf = (index: number) => (index in assigned ? assigned[index] : draft.lines[index].matched_line_id ?? "");
  const usedLineIds = new Set(rows.map(({ index }) => lineOf(index)).filter(Boolean));

  function rowSelect(index: number, emptyLabel: string) {
    return (
      <select
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        value={lineOf(index)}
        onChange={(e) => {
          setAssigned((prev) => ({ ...prev, [index]: e.target.value }));
          onAssign(index, e.target.value);
        }}
      >
        <option value="">{emptyLabel}</option>
        {openLines
          .filter((line) => !usedLineIds.has(line.id) || lineOf(index) === line.id)
          .map((line) => (
            <option key={line.id} value={line.id}>
              {line.material} ({line.unit})
            </option>
          ))}
      </select>
    );
  }

  function rowLabel(row: ScanDraft["lines"][number]) {
    return (
      <span className="block text-slate-600 dark:text-slate-300">
        “{row.raw_text}”
        {row.qty.value !== null && ` — ${formatQty(Number(row.qty.value))}${row.unit ? ` ${row.unit}` : ""}`}
      </span>
    );
  }

  return (
    <div
      data-testid="scan-draft"
      className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-sm dark:border-brand-500/30 dark:bg-brand-500/10"
    >
      <div className="flex items-start gap-2">
        <ScanLine size={18} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
        <p className="text-slate-700 dark:text-slate-200">
          Filled in from the photo. <strong>Check every figure</strong> before confirming — fields marked
          “Check this” were hard to read. Nothing is saved until you press Confirm dispatch.
        </p>
      </div>
      {draft.warnings.includes("unit_mismatch") && (
        <p className="text-amber-800 dark:text-amber-300">
          The note uses a different unit from this order on at least one item. Quantities were not converted —
          enter them in this order’s unit.
        </p>
      )}
      {draft.warnings.includes("handwritten") && (
        <p className="text-amber-800 dark:text-amber-300">
          Parts of this note are handwritten, so results may need more checking.
        </p>
      )}

      {unmatched.length > 0 && (
        <div className="space-y-2" data-testid="scan-unmatched">
          <p className="font-medium text-slate-700 dark:text-slate-200">Unmatched — pick a line or skip</p>
          {unmatched.map(({ row, index }) => (
            <label key={index} className="block space-y-1">
              {rowLabel(row)}
              {rowSelect(index, "Skip — not on this order")}
            </label>
          ))}
        </div>
      )}

      {matched.length > 0 && (
        <details className="space-y-2" data-testid="scan-matched">
          <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">
            Matched rows — change or remove
          </summary>
          {matched.map(({ row, index }) => (
            <label key={index} className="mt-2 block space-y-1">
              {rowLabel(row)}
              {rowSelect(index, "Remove — don't use this row")}
            </label>
          ))}
          <p className="text-slate-600 dark:text-slate-300">To add an item the scan missed, type its quantity below.</p>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={scan} disabled={reading}>
          {reading ? "Reading..." : "Retake"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDiscard}>
          Discard scan
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
