// Delivery-note scan drafts (specs/008-scan-dispatch-draft/contracts/parse-document.md).
// A draft changes nothing; only the ordinary dispatch POST records a truck.
import { api } from "./apiClient";

export type Confidence = "high" | "medium" | "low";

export interface ScanField {
  value: string | null;
  confidence: Confidence;
}

export interface ScanDraftLine {
  raw_text: string;
  qty: ScanField;
  unit: string | null;
  matched_line_id: string | null;
  match_confidence: "high" | "low" | null;
}

export interface ScanDraft {
  scan_id: string;
  document_date: ScanField;
  vehicle_ref: ScanField;
  lines: ScanDraftLine[];
  warnings: string[];
}

export function parseDocument(poId: string, image: Blob): Promise<ScanDraft> {
  const form = new FormData();
  form.append("image", image, "delivery-note.jpg");
  return api.upload<ScanDraft>(`/purchase-orders/${poId}/dispatches/parse-document`, form);
}

/** Fields the user should look at before confirming (constitution XXXIX). */
export function needsCheck(field: ScanField): boolean {
  return field.value !== null && field.confidence !== "high";
}
