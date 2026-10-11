# Tasks: Multi-item Purchase Orders

**Input**: Design documents from `/specs/006-multi-item-pos/` (plan.md, spec.md, research.md,
data-model.md, contracts/api.md, quickstart.md)

**Organisation note**: the phases follow the breakdown supplied on 2026-10-12 (spec lock → schema
→ domain/API → UI → hardening → release gate) rather than one phase per user story. That is
deliberate: migration 0003 drops the single-material columns atomically (research R1), so no
story can ship on the old model alongside another on the new one. Story labels ([US1]–[US6]) map
each task to spec.md so coverage stays traceable. IDs keep the supplied numbering; tasks added
during planning take free numbers inside their phase (T017, T028–T029, T036–T037, T045–T047).

Tests are requested by the spec (FR-014), so test tasks are included.

## Task rules

- No UI-only "Add line" against the old single-material columns: Phase 3 starts only after
  Phase 2 is merged.
- T050–T054 MUST NOT be checked without production evidence recorded in
  `docs/releases/006-multi-item.md` (date, operator, output).
- Plan-limit tests MUST still count PO headers (FR-012).
- T035 (phone layout) is not real-device evidence (constitution XXVI).

---

## Phase 0: Spec lock

- [X] T000 Confirm product rules in `specs/006-multi-item-pos/spec.md`: multi-line dispatch, per-line remaining, PO-level due date only, limits count POs, line editing after create out of scope
- [X] T001 Merge constitution v1.5.0 (`.specify/memory/constitution.md`, Sync Impact Report removed) to main
- [X] T002 Mark `specs/006-multi-item-pos/spec.md` Status: Accepted (FR-001–FR-015 frozen)

---

## Phase 1: Schema & migration (blocks everything)

- [X] T010 [US1] Add `PurchaseOrderLine` to `backend/src/models/purchase_order.py`: id uuid PK; organization_id FK indexed; purchase_order_id FK indexed; `line_no` int "≥ 1, unique per PO"; `material` str(200) "required, trimmed non-empty"; `ordered_qty` numeric(14,3) "> 0"; `unit` str(20) "required, trimmed non-empty"; timestamps; `UNIQUE(purchase_order_id, line_no)`, `UNIQUE(id, purchase_order_id)`, `CHECK(ordered_qty > 0)`; no `deleted_at`. Remove `material`, `ordered_qty`, `unit` from `PurchaseOrder`; add `lines` relationship ordered by `line_no`
- [X] T011 [US2] Add `DispatchLine` to `backend/src/models/dispatch.py`: id; organization_id indexed; dispatch_id FK indexed; purchase_order_id; purchase_order_line_id indexed; `qty` numeric(14,3) "> 0"; timestamps; composite FK `(purchase_order_line_id, purchase_order_id)` → `purchase_order_lines(id, purchase_order_id)`; `UNIQUE(dispatch_id, purchase_order_line_id)`; `CHECK(qty > 0)`. Remove `qty` from `Dispatch`; add `lines` relationship; register both models in `backend/src/models/__init__.py`
- [X] T012 [US3] Create `backend/src/migrations/versions/0003_multi_item_lines.py` (down_revision 0002): create both tables, then backfill one `purchase_order_lines` row per PO (line_no 1, same material/ordered_qty/unit, same organization_id), including soft-deleted POs
- [X] T013 [US3] In the same revision, backfill one `dispatch_lines` row per dispatch (including soft-deleted) against its PO's sole line with the same qty
- [X] T014 [US3] In the same revision, before any drop, assert in SQL: line count == PO count; dispatch_line count == dispatch count; every PO has exactly one line; per-PO `ordered_qty − SUM(non-deleted dispatch qty)` equals line remaining. Raise (aborting the transaction) on any mismatch
- [X] T015 [US3] In the same revision, after the asserts, drop `purchase_orders.material`, `ordered_qty`, `unit` and `dispatches.qty`; write a `downgrade()` that restores them from the single line (refusing if any PO has > 1 line)
- [X] T016 [US3] Add migration test `backend/tests/migration/test_0003_backfill.py` (PostgreSQL only, marker `pg` registered in `backend/pytest.ini`/`pyproject.toml`, guarded by the existing local-only DB assertion per XXVII): upgrade to 0002, seed POs/dispatches incl. soft-deleted and over-dispatched, upgrade to head, assert counts and remaining equality; assert re-running `upgrade head` is a no-op; run it in the CI PostgreSQL job in `.github/workflows/`
- [X] T017 [US3] Create `backend/src/scripts/verify_0003.py` with `snapshot` and `compare` subcommands (`--db <url>`, refuses the production URL from settings) that record per-PO remaining before upgrade and diff after, per `quickstart.md` §2

**Checkpoint**: schema at head locally; migration test green. Nothing else compiles yet — Phase 2 follows immediately on the same branch.

---

## Phase 2: Domain & API

- [X] T020 [US2] Rewrite `backend/src/services/po_calc.py`: `dispatched_by_line_many(db, line_ids)` (one grouped query over `dispatch_lines` joined to non-deleted dispatches), `line_remaining`, `po_status(lines_remaining, due_date, today)` (all ≤ 0 → fully_dispatched; else overdue/due_soon/on_track using `settings.due_soon_days`), `po_is_complete`, `remaining_by_unit` (group by `unit.strip().lower()`, open lines only); keep `VALID_STATUSES` and a batched `compute_many`. Update `backend/tests/unit/test_po_calc.py` and `test_po_calc_batch.py` for lines, including the batch == single equality and over-dispatched line → fully_dispatched
- [X] T021 [US1] Update `backend/src/schemas/purchase_order.py` and `backend/src/api/purchase_orders.py`: POST requires `lines` (min 1), assigns line_no in order, rejects top-level material/ordered_qty/unit with 422, per-line 422 paths (`lines.N.field`), header + lines in one transaction, audit entry includes lines; plan-limit check unchanged (counts headers)
- [X] T022 [US1] GET `/purchase-orders/{id}` returns `lines[]` with ordered_qty/dispatched_qty/remaining_qty, `item_count`, `remaining_by_unit`, derived `status`; remove `total_dispatched`/`remaining_balance` per `contracts/api.md`
- [X] T023 [US2] Update `backend/src/schemas/dispatch.py` and `backend/src/api/dispatches.py`: POST accepts `lines[{purchase_order_line_id, qty>0}]` (min 1), rejects duplicates and lines not on this PO/org with 422 (not 404), header + lines in one transaction, audit includes lines; GET dispatch list returns `lines[]` with material/unit/qty; soft-deleting a dispatch restores all its lines' remaining
- [X] T024 [US2] Per-line over-dispatch in `backend/src/api/dispatches.py`: when any line would go below 0 and `confirm` is false, return `{dispatch: null, warning, over_lines: [...]}` and save nothing; warning names each line's material and remaining and never names request parameters; exact-remaining dispatch does not warn
- [X] T025 [US4] PO list in `backend/src/api/purchase_orders.py`: `item_count`, `material_summary` ("<first material> +N more"), `remaining_by_unit`, derived status; status filter uses derived status; stays batched (no per-PO query)
- [X] T026 [US4] `backend/src/api/dashboard.py`: remove `total_remaining_balance`, add `remaining_by_unit` over open lines; counts unchanged in meaning
- [X] T027 [US5] `backend/src/services/exports.py` and `backend/src/api/reports.py`: remaining/overdue one row per PO line with declared columns `po_number, party_code, party_name, material, unit, ordered_qty, dispatched_qty, remaining_qty, order_date, due_date, status`; dispatch history one row per dispatch line `dispatch_date, po_number, party_name, material, unit, qty, vehicle_ref, remarks`; CSV and PDF; empty ⇒ header only
- [X] T028 [US4] `backend/src/api/parties.py` (party detail + party export): remaining per line and `remaining_by_unit` per party; no cross-unit total
- [X] T029 Update remaining readers of old fields: `backend/src/services/notifications.py`, `backend/src/scripts/seed.py`, `backend/src/scripts/seed_landing_demo.py` (seed multi-line demo POs), `docs/api-examples.md`; `grep` for `ordered_qty|\.material|Dispatch.qty|remaining_balance` in `backend/src` returns only line-model usages

**Checkpoint**: `cd backend && pytest` green (existing integration tests updated in Phase 4 tasks run here too).

---

## Phase 3: UI (only after Phase 2 merged)

- [X] T030 [US1] `frontend/src/pages/purchase-orders/PurchaseOrderForm.tsx`: header fields + line table (material, qty, unit), "Add line", remove line (disabled when one line remains), per-line field errors mapped from `lines.N.field`; update frontend API types/client for `lines[]`
- [X] T031 [US1] `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx`: line table with Material, Unit, Ordered, Dispatched, Remaining (labels as XIX spells them); per-unit remaining summary; loaded/empty/error states (XII)
- [X] T032 [US2] Same file: dispatch form with shared date/vehicle/remarks and a qty input per line (blank/0 = not on this truck); client check that ≥ 1 qty is entered; show `over_lines` warning against the specific rows with a confirm action
- [X] T033 [US2] Same file: dispatch history shows each dispatch's lines (material, unit, qty)
- [X] T034 [US4] `frontend/src/pages/purchase-orders/PurchaseOrdersList.tsx` (item count/material summary, per-unit remaining), `frontend/src/pages/parties/PartyDetail.tsx` (per-line rows, per-unit totals), `frontend/src/pages/dashboard/Dashboard.tsx` (remove mixed total, show counts + per-unit remaining)
- [X] T035 [US2] Phone layout at 390px for the line editor and dispatch qty inputs: no horizontal scroll, 44×44 targets, numeric keyboard, submit reachable (XXII). Layout only — not real-device evidence (XXVI)
- [X] T036 [P] [US1] Update frontend unit tests touching old fields: `frontend/tests/unit/coreLoopFailureStates.test.tsx`, `statusConsistency.test.tsx`, `roleGatedControls.test.tsx`, `poFilters.test.tsx`, `noSilentFailures.test.tsx`; add tests for add/remove line and the last-line guard
- [X] T037 [P] [US2] Update Playwright core-loop e2e in `frontend/tests/` to create a 2-line PO and dispatch one line, at desktop and 390px viewports

---

## Phase 4: Hardening

- [X] T040 [P] [US2] New `backend/tests/integration/test_multi_item.py`: create two-line PO; dispatch one line only; dispatch both lines; over-dispatch on one of two lines names only that line; confirm proceeds; cross-PO and cross-org line rejected; duplicate line rejected; derived status per spec scenarios. Update `test_core_workflow.py`, `test_po_filters.py`, `test_tenant_isolation.py`, `test_beta_bar.py`, `test_billing_contract.py`, `test_limits_truth.py` for `lines[]`
- [X] T041 [P] [US3] Ensure `backend/tests/migration/test_0003_backfill.py` runs in CI on every PR (not skipped silently when PostgreSQL is missing in CI — fail instead)
- [X] T042 [P] [US5] `backend/tests/unit/test_exports.py`, `backend/tests/integration/test_report_columns.py`, `test_party_export.py`: multi-line PO ⇒ N rows with repeated po_number; empty org ⇒ header-only CSV and valid PDF
- [X] T043 [US6] `backend/src/scripts/smoke_deployed.py`: create a 3-line PO, dispatch two lines partially in one dispatch, assert per-line remaining via GET; keep signup/login steps
- [ ] T044 [US6] Prepare landing/beta copy changes (landing page source under `frontend/src/` and the beta announcement draft) on a branch, NOT merged; until T051 passes, any published copy states the single-material limitation or omits multi-item. Status 2026-10-12: published landing copy and `docs/beta-announcement.md` make no multi-item claim (compliant); landing screenshots recaptured for the per-unit dashboard. Multi-item copy itself not yet drafted
- [X] T045 [P] `backend/tests/integration/test_plan_limits.py`: a PO with 5 lines consumes one slot; creating PO #N+1 at limit is blocked regardless of lines (FR-012)
- [X] T046 [P] Add audit tests: PO create and dispatch create/delete audit entries contain the line list (FR-015)
- [X] T047 Run `/speckit-analyze`-style check: every FR-001–FR-015 maps to at least one task above

---

## Phase 5: Release gate (production evidence required)

- [ ] T049 Rehearse 0003 on a restored copy of production per `quickstart.md` §2 (`verify_0003 snapshot` → upgrade → `compare` = 0 differences); record operator, date, counts in `docs/releases/006-multi-item.md`
- [X] T050 Production migrate via the normal deploy path (startup migrator with advisory lock); record the deploy id and that the app started (no migrate failure) in `docs/releases/006-multi-item.md`
- [X] T051 Run `smoke_deployed.py` against production; exit 0 on the multi-line path; paste output into `docs/releases/006-multi-item.md`
- [ ] T052 Manual on production: create a 3-line PO, record one partial truck on 2 lines, verify each line's remaining; also open one pre-006 PO and confirm one line and unchanged remaining. Record in the release doc
- [ ] T053 Manual: download remaining CSV from production, open in Google Sheets, confirm one row per line and numeric qty columns; record in the release doc
- [ ] T054 Decision recorded in the release doc: merge T044 copy and send/update the beta announcement for multi-item — only if T051–T053 are recorded (XXXII)

---

## Dependencies

- Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5, strictly. Phases 1–2 land together
  (models without old columns do not compile against the old API).
- Within Phase 1: T010, T011 → T012 → T013 → T014 → T015 → T016; T017 independent after T015.
- Within Phase 2: T020 first; T021–T028 depend on T020; T029 any time after T010/T011.
- Phase 3: T030–T034 depend on T021–T028; T036/T037 after their pages.
- Phase 5: T049 → T050 → T051 → T052/T053 → T054.

Story coverage: US1 T010, T021–T022, T030–T031, T036 · US2 T011, T020, T023–T024, T032–T033,
T035, T037, T040 · US3 T012–T017, T041, T049 · US4 T025–T026, T028, T034 · US5 T027, T042 ·
US6 T043–T044, T051, T054.

## Parallel opportunities

- Phase 1: T017 alongside T016.
- Phase 2: after T020, T025/T026/T027/T028 touch different files and can run in parallel; T021–T024
  share `purchase_orders.py`/`dispatches.py` and run sequentially per file.
- Phase 3: T034 (three other pages) in parallel with T030–T033; T036 and T037 in parallel.
- Phase 4: T040, T041, T042, T045, T046 all in parallel.

## Implementation strategy

MVP = Phases 0–2 plus T030–T032: a multi-line PO can be created and dispatched through the UI with
correct per-line remaining (US1 + US2 + US3, since migration is inseparable). Then lists, dashboard,
exports (US4–US5), hardening, and finally the production gate and copy (US6). Nothing is announced
before T051–T053 are recorded.
