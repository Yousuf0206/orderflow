# Implementation Plan: Multi-item Purchase Orders

**Branch**: `006-multi-item-pos` (spec directory; the working git branch is `main`)
| **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-multi-item-pos/spec.md`

## Summary

Split purchase orders and dispatches into header + lines. A PO owns one or more
`purchase_order_lines` (material, ordered qty, unit); a dispatch owns one or more `dispatch_lines`
(qty against one PO line). Remaining and status become per-line computations; PO status is derived
from its lines.

Order of work, which is also the order of risk: **schema + migration → domain (`po_calc`) → API →
UI → exports/dashboard honesty → deployed smoke → copy.** No UI "Add line" ships while the old
single-material columns are still the source of truth.

The migration is one Alembic revision (`0003`) that creates the line tables, backfills one line per
PO and one dispatch line per dispatch, asserts the backfill inside the same transaction, and only
then drops the obsolete columns. It reaches production through the existing startup migrator
(`backend/src/core/migrate.py`, advisory lock, raises on failure), but only after it has been run
and verified against a copy of production data.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.6 (frontend)

**Primary Dependencies**: FastAPI, SQLAlchemy 2, Alembic, Pydantic; React + Vite frontend. No new
dependency.

**Storage**: PostgreSQL (production, CI service); SQLite via `create_all` for most unit/integration
tests. The migration itself can only be tested on PostgreSQL.

**Testing**: pytest (unit, integration, migration test on PostgreSQL), Vitest, Playwright, plus
`backend/src/scripts/smoke_deployed.py` against production after deploy.

**Target Platform**: Vercel (frontend + Python backend), hosted PostgreSQL.

**Project Type**: web application — `backend/` + `frontend/`.

**Performance Goals**: PO list, dashboard, and reports stay within the client's 12s request
deadline at ~200 POs × several lines; aggregates stay batched (one grouped query per request, as
`total_dispatched_many` does today), never per-line queries in a loop.

**Constraints**: remaining never stored (II, XXIX); no cross-unit totals (XXIX); migration lossless
and rehearsed on a copy (XXXI); tests never reach production (XXVII); startup migration fails loud
(XXIV).

**Scale/Scope**: 6 user stories, 15 FRs. ~50 files reference the old single-material fields
(backend API/services/scripts/tests, 5 frontend pages, docs). Line editing after create is out of
scope (spec Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
|-----------|------------------------|--------|
| I Multi-tenancy | `organization_id` on both new tables; every line lookup also filters by org; dispatch lines validated against the target PO in the same org | PASS |
| II / XXIX Remaining computed, per line, no unit mixing | Per-line aggregate query; no stored remaining; dashboard `total_remaining_balance` removed, replaced by counts + per-unit totals | PASS |
| III / XXX Partial, multi-line dispatch | Dispatch accepts `lines[]`, subset allowed; over-dispatch evaluated per line with existing warn-then-confirm | PASS |
| IV Simplicity / 60s dispatch | Dispatch form is one row per line with a qty box; blank = not on this truck | PASS (verified via SC-001) |
| VI / VII Audit, soft delete | Line rows audited with their parent; soft delete via parent header (lines are not independently deletable in 006) | PASS — see research R5 |
| X / XXII UI evidence, phone | Create and dispatch forms verified in UI at 390px | PASS (gate in tasks) |
| XII No silent failures | New fetch states unchanged in shape; line-level validation errors shown on the line | PASS |
| XXI Trust capabilities | Live remaining, party view, export, overdue all retained at line grain | PASS |
| XXIV / XXXI Schema before code, lossless migration | Single revision; in-transaction assertions; rehearsal on a production copy before deploy; startup migrator raises | PASS |
| XXV Empty export headers | Line-grained CSV builders declare columns; empty-export tests retained and extended | PASS |
| XXVII Tests never touch production | Migration test uses the CI/local PostgreSQL guarded by the existing local-only assertion; production copy rehearsal is a manual, named step against a *copy* | PASS |
| XXVIII Header with lines; plan limits count headers | `max_active_pos` query unchanged (counts `purchase_orders`) | PASS |
| XXXII No claim until production works | Copy change is the last phase and gated on recorded deployed smoke | PASS |

No violations; Complexity Tracking not needed.

**Post-design re-check (after Phase 1)**: still PASS. The contract keeps `lines[]` mandatory on
create and dispatch, and the data model has no column that stores a balance.

## Project Structure

### Documentation (this feature)

```text
specs/006-multi-item-pos/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          purchase_order.py (+PurchaseOrderLine), dispatch.py (+DispatchLine)
│   ├── migrations/versions/0003_multi_item_lines.py
│   ├── schemas/         purchase_order.py, dispatch.py  (lines[] in/out)
│   ├── services/        po_calc.py (per-line), exports.py, notifications.py
│   ├── api/             purchase_orders.py, dispatches.py, dashboard.py, parties.py, reports.py
│   └── scripts/         smoke_deployed.py, seed.py, seed_landing_demo.py, verify_0003.py (copy check)
└── tests/
    ├── unit/            test_po_calc*.py, test_exports.py
    ├── integration/     test_core_workflow.py, test_multi_item.py (new), report/party/filter tests
    └── migration/       test_0003_backfill.py (new, PostgreSQL only)

frontend/
├── src/pages/
│   ├── purchase-orders/ PurchaseOrderForm.tsx (line editor), PurchaseOrderDetail.tsx (line table,
│   │                    multi-qty dispatch), PurchaseOrdersList.tsx (item summary)
│   ├── dashboard/       Dashboard.tsx (no mixed-unit total)
│   └── parties/         PartyDetail.tsx (per-line / per-unit)
└── tests/               unit + e2e updated for lines
```

**Structure Decision**: existing web-app layout; no new modules. One new migration, one new
verification script, new tests.

## Complexity Tracking

None.
