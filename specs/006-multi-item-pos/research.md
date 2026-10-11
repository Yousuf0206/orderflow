# Research: Multi-item Purchase Orders

## R1. One migration revision or several

- **Decision**: one Alembic revision `0003_multi_item_lines` that creates tables, backfills,
  asserts, and drops old columns in a single transaction.
- **Rationale**: PostgreSQL DDL is transactional, so a failed assertion rolls back everything and
  the startup migrator raises (XXIV). Splitting into "add + backfill" and a later "drop" would leave
  a window where code and schema could disagree about which columns are authoritative, and two
  sources of truth for a quantity is exactly what XXIX forbids.
- **Alternatives**: expand/contract across two deploys — safer for zero-downtime at scale, but this
  product has one backend and low traffic; the extra deploy adds a dual-write period with no
  benefit. Feature flag — unnecessary when the migration is atomic and smoke is mandatory.

## R2. Verifying the backfill

- **Decision**: in-migration assertions: `count(lines) == count(POs)`,
  `count(dispatch_lines) == count(dispatches)`, every PO has exactly one line, and for every PO
  `ordered − sum(dispatch qty)` before equals line remaining after (computed in SQL before the drop).
  Plus `scripts/verify_0003.py` that snapshots per-PO remaining before upgrade and compares after,
  run against a restored copy of production.
- **Rationale**: XXXI requires identical remaining, not just row counts. Doing it in the migration
  means production cannot end up half-correct even if the rehearsal were skipped.

## R3. Soft-deleted rows during backfill

- **Decision**: backfill all rows including soft-deleted ones; lines inherit nothing — deletion
  stays on the header (PO / dispatch). Calculations filter on the header's `deleted_at`.
- **Rationale**: keeps history for audit/recovery (VII) and avoids duplicating delete state.

## R4. Enforcing "dispatch line belongs to the dispatch's PO"

- **Decision**: application-level validation in the create-dispatch transaction (load the PO's
  line ids, reject any not in the set), plus a composite FK: `purchase_order_lines` gets a unique
  `(id, purchase_order_id)` and `dispatch_lines` stores `purchase_order_id` with FK
  `(purchase_order_line_id, purchase_order_id)` → lines. 
- **Rationale**: the database refuses a cross-PO line even if a future code path forgets the check.
- **Alternatives**: trigger — harder to test under SQLite; app-only — one forgotten check away from
  corrupting a balance.

## R5. Line soft delete and audit

- **Decision**: lines have no `deleted_at` in 006; they are created with their PO and never removed
  independently (line editing is out of scope). Audit entries for PO create/delete and dispatch
  create/delete include the full line list in before/after state.
- **Rationale**: satisfies VI/VII without inventing a line-delete flow the spec excludes. When line
  editing arrives, add `deleted_at` then.

## R6. Over-dispatch response shape

- **Decision**: keep today's warn-then-confirm: response `{dispatch: null, warning, over_lines:
  [{line_id, material, unit, remaining, requested}]}`; resubmit with `confirm: true`.
- **Rationale**: matches existing tested behaviour (test_core_workflow); the new `over_lines` lets
  the UI mark the specific rows (FR-005).

## R7. Dashboard replacement for `total_remaining_balance`

- **Decision**: remove the field; add `remaining_by_unit: [{unit, remaining}]` (open lines only)
  alongside existing counts.
- **Rationale**: per-unit aggregates are permitted by FR-009; removing (not renaming) the field
  makes any lingering consumer fail at test time rather than show a wrong number.

## R8. Unit normalisation

- **Decision**: group by the unit string trimmed and lower-cased; no unit conversion.
- **Rationale**: "Bag" vs "bag" are the same unit; tonne vs kg conversion is out of scope.

## R9. Performance

- **Decision**: one grouped query `SUM(dispatch_lines.qty) GROUP BY purchase_order_line_id` over
  non-deleted dispatches, replacing `total_dispatched_many`; lines loaded in one query per request.
- **Rationale**: preserves the batching lesson recorded in `po_calc.py` (per-row queries blew the
  12s deadline).

No NEEDS CLARIFICATION remain.
