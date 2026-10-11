import type { PurchaseOrder } from "../../src/services/purchaseOrders";

/**
 * A purchase order in the 006 multi-item shape: one header, its lines, and
 * remaining per line. Defaults to one line so single-material behaviour stays
 * the baseline; pass `lines` for multi-item cases.
 */
export function makePO(overrides: Partial<PurchaseOrder> & { id?: string } = {}): PurchaseOrder {
  const lines = overrides.lines ?? [
    {
      id: "line-1",
      line_no: 1,
      material: "TMT Steel Bars 12mm",
      unit: "ton",
      ordered_qty: 1000,
      dispatched_qty: 400,
      remaining_qty: 600,
    },
  ];
  return {
    id: "po-1",
    party_id: "party-1",
    po_number: "PO-2001",
    order_date: "2026-10-01",
    due_date: "2026-11-01",
    notes: null,
    days_to_delivery: 20,
    status: "on_track",
    item_count: lines.length,
    material_summary: lines.length > 1 ? `${lines[0].material} +${lines.length - 1} more` : lines[0].material,
    remaining_by_unit: [{ unit: lines[0].unit, remaining: lines[0].remaining_qty }],
    ...overrides,
    lines,
  };
}
