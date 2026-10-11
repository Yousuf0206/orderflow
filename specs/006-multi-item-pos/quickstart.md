# Quickstart: validating Multi-item Purchase Orders

See [contracts/api.md](./contracts/api.md) and [data-model.md](./data-model.md) for shapes.

## 1. Automated (local)

```bash
cd backend && pytest                       # unit + integration (SQLite)
cd backend && pytest tests/migration -m pg  # 0003 backfill, needs local PostgreSQL (never prod)
cd frontend && npm test && npx playwright test
```

Expected: multi-line create, subset dispatch, per-line over-dispatch warning, derived status,
line-row exports (empty ⇒ header only), and 0003 backfill equality all pass.

## 2. Migration rehearsal on a production copy (manual, named owner)

1. Restore a copy of the production database to a non-production PostgreSQL.
2. `python -m src.scripts.verify_0003 snapshot --db <copy-url>` — records per-PO remaining.
3. `alembic upgrade head` against the copy.
4. `python -m src.scripts.verify_0003 compare --db <copy-url>` — must report 0 differences and
   equal PO/line and dispatch/dispatch-line counts.
5. Record date, operator, counts in the release notes. Only then deploy.

## 3. UI check (desktop and 390px phone)

1. Create a PO with 3 lines in different units; detail shows 3 lines, remaining = ordered.
2. Record one dispatch with qty on 2 lines; the third untouched; history shows one dispatch, 2 lines.
3. Enter more than a line's remaining: warning names that line; confirm saves.
4. Dashboard shows counts and per-unit remaining, no single mixed total.
5. Export remaining: one row per line; export overdue with nothing overdue: header only.
6. Open a pre-existing PO: one line, history intact, remaining unchanged.

## 4. After production deploy

`python backend/src/scripts/smoke_deployed.py` — must include multi-line create → partial
multi-line dispatch → per-line remaining. Record the pass. Only after that may landing/beta copy
mention multi-item POs (XXXII).
