// Shapes of the multi-item purchase order API (specs/006-multi-item-pos/contracts/api.md).
// Remaining is per line; a PO never carries one remaining figure across units.

export interface PurchaseOrderLine {
  id: string;
  line_no: number;
  material: string;
  unit: string;
  ordered_qty: number;
  dispatched_qty: number;
  remaining_qty: number;
}

export interface UnitRemaining {
  unit: string;
  remaining: number;
}

export interface PurchaseOrder {
  id: string;
  party_id: string;
  po_number: string;
  order_date: string;
  due_date: string;
  notes: string | null;
  days_to_delivery: number;
  status: string;
  item_count: number;
  material_summary: string;
  lines: PurchaseOrderLine[];
  remaining_by_unit: UnitRemaining[];
}

export interface DispatchLine {
  purchase_order_line_id: string;
  line_no: number;
  material: string;
  unit: string;
  qty: number;
}

export interface Dispatch {
  id: string;
  purchase_order_id: string;
  dispatch_date: string;
  vehicle_ref: string | null;
  remarks: string | null;
  lines: DispatchLine[];
}

export interface OverLine {
  purchase_order_line_id: string;
  material: string;
  unit: string;
  remaining: number;
  requested: number;
}

export interface DispatchCreateResponse {
  dispatch: Dispatch | null;
  warning: string | null;
  over_lines: OverLine[];
}

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatQty(qty: number): string {
  return numberFmt.format(qty);
}

/** "200 bag · 30 tonne" -- quantities side by side, never added together. */
export function formatByUnit(rows: UnitRemaining[]): string {
  if (rows.length === 0) return "0";
  return rows.map((r) => `${numberFmt.format(r.remaining)} ${r.unit}`).join(" · ");
}
