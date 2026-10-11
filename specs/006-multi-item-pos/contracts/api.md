# API Contract: Multi-item Purchase Orders

All endpoints org-scoped by the authenticated membership, as today. Quantities are decimals with up
to 3 places.

## POST /purchase-orders

```json
{
  "party_id": "uuid", "po_number": "PO-1",
  "order_date": "2026-10-12", "due_date": "2026-11-01", "notes": null,
  "lines": [
    {"material": "Steel bar 12mm", "ordered_qty": 50, "unit": "tonne"},
    {"material": "Cement OPC", "ordered_qty": 200, "unit": "bag"}
  ]
}
```

- 201 → PO detail (below). `lines` required, length ≥ 1; `line_no` assigned in order.
- 422 with field paths, e.g. `lines.1.ordered_qty`, for per-line errors; `po_number` duplicate as
  today. Plan limit error unchanged (counts headers).
- `material`, `ordered_qty`, `unit` at top level are rejected (422) — no silent fallback.

## GET /purchase-orders/{id}

```json
{
  "id": "uuid", "party_id": "uuid", "party_name": "…", "po_number": "PO-1",
  "order_date": "…", "due_date": "…", "notes": null,
  "status": "on_track", "days_to_delivery": 20, "item_count": 2,
  "lines": [
    {"id": "uuid", "line_no": 1, "material": "Steel bar 12mm", "unit": "tonne",
     "ordered_qty": 50, "dispatched_qty": 20, "remaining_qty": 30}
  ],
  "remaining_by_unit": [{"unit": "tonne", "remaining": 30}, {"unit": "bag", "remaining": 100}]
}
```

`total_dispatched` and `remaining_balance` are removed from PO responses.

## GET /purchase-orders (list)

Each item: header fields, `status`, `item_count`, `material_summary` (e.g. "Steel bar 12mm +1
more"), `remaining_by_unit`. Status filter semantics unchanged, using derived status.

## POST /purchase-orders/{id}/dispatches

```json
{
  "dispatch_date": "2026-10-13", "vehicle_ref": "LEA-1234", "remarks": null,
  "lines": [{"purchase_order_line_id": "uuid", "qty": 20}],
  "confirm": false
}
```

- 201 `{ "dispatch": {…, "lines": [{purchase_order_line_id, material, unit, qty}]}, "warning": null }`
- Over-dispatch, `confirm` false: 200 `{ "dispatch": null, "warning": "<trader-readable>",
  "over_lines": [{"purchase_order_line_id", "material", "unit", "remaining", "requested"}] }`.
  Nothing saved. Warning text must not name request parameters.
- 422: empty `lines`; `qty` ≤ 0; duplicate line; line not on this PO (or other org → also 422, not
  404, without revealing existence).

## GET /purchase-orders/{id}/dispatches

Each dispatch includes `lines[]` with material, unit, qty.

## GET /dashboard

Removes `total_remaining_balance`. Adds `remaining_by_unit: [{unit, remaining}]` over open lines.
Counts (open, overdue, due soon) unchanged in meaning.

## GET /parties/{id} (and party export)

Remaining shown per line (`po_number`, `material`, `unit`, `ordered`, `dispatched`, `remaining`) and
`remaining_by_unit` per party.

## Reports / exports (CSV + PDF)

Remaining, overdue, party: one row per PO line. Columns, declared up front:
`po_number, party_code, party_name, material, unit, ordered_qty, dispatched_qty, remaining_qty,
order_date, due_date, status`.

Dispatch history: one row per dispatch line:
`dispatch_date, po_number, party_name, material, unit, qty, vehicle_ref, remarks`.

Empty result → header row only (XXV).
