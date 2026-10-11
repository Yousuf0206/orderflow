# Data Model: Multi-item Purchase Orders

## purchase_orders (header) — changed

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK organizations, indexed |
| party_id | uuid | FK parties |
| po_number | str(50) | unique per (organization_id, po_number) — unchanged |
| order_date, due_date | date | |
| notes | text? | |
| created_at, updated_at, deleted_at | | unchanged mixins |
| ~~material, ordered_qty, unit~~ | | **dropped** by 0003 after backfill |

Derived (never stored): `status` ∈ fully_dispatched | overdue | due_soon | on_track;
`item_count`; `remaining_by_unit`.

## purchase_order_lines — new

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK organizations, indexed |
| purchase_order_id | uuid | FK purchase_orders, indexed |
| line_no | int | ≥ 1, unique per PO, display order |
| material | str(200) | required, trimmed non-empty |
| ordered_qty | numeric(14,3) | > 0 |
| unit | str(20) | required, trimmed non-empty |
| created_at, updated_at | | |

Constraints: `UNIQUE(purchase_order_id, line_no)`, `UNIQUE(id, purchase_order_id)` (target of
composite FK), `CHECK(ordered_qty > 0)`. No `deleted_at` in 006 (research R5).

Derived: `dispatched = SUM(dispatch_lines.qty)` over dispatches with `deleted_at IS NULL`;
`remaining = ordered_qty − dispatched`.

## dispatches (header) — changed

| Field | Type | Notes |
|-------|------|-------|
| id, organization_id, purchase_order_id | uuid | unchanged |
| dispatch_date | date | |
| vehicle_ref | str(100)? | |
| remarks | text? | |
| timestamps / deleted_at | | unchanged |
| ~~qty~~ | | **dropped** by 0003 after backfill |

## dispatch_lines — new

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK organizations, indexed |
| dispatch_id | uuid | FK dispatches, indexed |
| purchase_order_id | uuid | denormalised for composite FK |
| purchase_order_line_id | uuid | indexed |
| qty | numeric(14,3) | > 0 |
| created_at, updated_at | | |

Constraints: FK `(purchase_order_line_id, purchase_order_id)` → `purchase_order_lines(id,
purchase_order_id)`; `UNIQUE(dispatch_id, purchase_order_line_id)`; `CHECK(qty > 0)`;
application check that `dispatches.purchase_order_id = dispatch_lines.purchase_order_id`.

## Rules

- PO create: ≥ 1 line; line_no assigned 1..N in submitted order.
- Dispatch create: ≥ 1 line, each line on the target PO, no duplicates; per-line over-dispatch →
  warning unless `confirm`.
- Status: all lines remaining ≤ 0 (existing rounding) → fully_dispatched; else by PO due_date
  vs today and `settings.due_soon_days`.
- Plan limit: count of active `purchase_orders` headers — unchanged.

## Migration 0003 mapping

| Pre-006 | Post-006 |
|---------|----------|
| purchase_orders row (material, ordered_qty, unit) | header + 1 `purchase_order_lines` row, line_no 1, same values |
| dispatches row (qty) | header + 1 `dispatch_lines` row → that PO's line, same qty |
| soft-deleted rows | backfilled; header keeps `deleted_at` |

Assertions before column drop: row counts match; every PO has exactly one line; per-PO
remaining before == line remaining after.
