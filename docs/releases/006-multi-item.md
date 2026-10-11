# Release 006 — Multi-item purchase orders

Evidence for the release gate in `specs/006-multi-item-pos/tasks.md` (Phase 5). A task there is
checked only when its evidence is recorded here.

| Task | Status |
|------|--------|
| T049 Rehearsal of 0003 on a production copy | **Not done** — see below |
| T050 Production migrate via normal deploy | Recorded 2026-10-12 |
| T051 Deployed smoke, multi-line path | Recorded 2026-10-12 — passed |
| T052 Manual 3-line PO, partial truck, on production | Open |
| T053 Remaining CSV opened in Google Sheets | Open |
| T054 Announcement decision | Open — blocked on T052, T053 (constitution XXXII) |

## T049 — rehearsal (not done)

`main` was pushed on 2026-10-11 (UTC) at the owner's instruction, before migration 0003 was rehearsed
on a copy of production. Recorded as a gap, not waived: XXXI asks for the rehearsal *before*
production. What stood in its place:

- 0003 asserts, inside its own transaction and before dropping any column, that line and dispatch
  line counts match and that every PO's remaining is unchanged. A mismatch rolls the whole revision
  back and the startup migrator refuses to serve.
- `backend/tests/migration/test_0003_backfill.py` ran the migration against PostgreSQL 16 locally
  (partial, untouched, over-dispatched and soft-deleted rows; upgrade, re-run, downgrade).

The deploy started and serves the new schema (T050/T051), so those assertions held on production
data. `verify_0003 compare` was not run, because there is no pre-migration snapshot to compare
against.

## T050 — production migrate

- Commit: `67d0f9a` (push `f6bf697..67d0f9a` to `main`, 2026-10-11 ~20:05 UTC).
- Deployment: `orderflow-7ccb97fco-muhammad-yousufs-projects-9a9e064a.vercel.app`, served at
  `https://purchaseorderflow.vercel.app`.
- Migration path: the startup migrator (`backend/src/core/migrate.py`, advisory lock). No manual
  `alembic` command was run.
- Started cleanly: `GET /api/health` → `{"status":"ok","database_host":"aws-0-ap-northeast-2.pooler.supabase.com"}`.
  A failed 0003 would have stopped startup; the multi-line endpoints below exist only at 0003.

## T051 — deployed smoke

Run by hand, 2026-10-11 20:13 UTC, operator: Claude Code at the owner's request.

```
$ python backend/src/scripts/smoke_deployed.py https://purchaseorderflow.vercel.app
PASSED  https://purchaseorderflow.vercel.app
  database host: aws-0-ap-northeast-2.pooler.supabase.com
  ok  health
  ok  signup
  ok  auth/me
  ok  create party
  ok  create multi-line purchase order
  ok  record multi-line dispatch
  ok  remaining per line
  created (for cleanup):
    organization_id: a1a72bee-f704-4fa9-826b-faa75141e40e
    user_email: smoke-20261011T201340Z@orderflow-checks.example
    party_id: 8fc0bcd7-993e-4919-9781-3f6cecd8e462
    purchase_order_id: 5ddd312f-605d-47c4-9e12-7b1001f2ce3b
exit 0
```

The multi-line steps: create a PO with 100 ton / 200 bag / 10 truck, record one dispatch of 40 ton
and 50 bag, then read back remaining 60 / 150 / 10.

The automatic post-deploy workflow failed for this deployment at `health` with 401: it checked the
protected per-deployment URL. That workflow now checks the production alias. Its failure was not a
result of 006, and it failed the same way on 2026-10-10.

## T052 / T053 — manual (open)

To record: who, when, device/browser, and the outcome of
- creating a 3-line PO in the production UI, recording one partial truck on two lines, and checking
  each line's remaining; and opening one pre-006 PO to confirm one line and an unchanged remaining;
- downloading the remaining CSV, opening it in Google Sheets, and confirming one row per line with
  numeric quantity columns.
