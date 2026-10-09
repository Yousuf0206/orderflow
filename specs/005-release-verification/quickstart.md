# Quickstart: Running the Release Gates

Four gates. Two can be automated, two need a person, and the two that need a person are the ones
that have been skipped.

---

## Before a deploy — the existing checklist

`docs/SMOKE_CHECKLIST.md`, against a local stack, with the suites run first:

```bash
cd backend  && pytest
cd frontend && npm run test && npm run build && npm run test:e2e
```

**The e2e suite refuses to run unless the backend is pointed at a local database.** That is the
guard from `f107ce5`, working as intended. If it refuses, the backend is pointed at production —
fix that rather than overriding it.

For the PostgreSQL-only tests (the startup-migration ones, which otherwise skip silently):

```bash
docker run -d --name pg -e POSTGRES_USER=orderflow -e POSTGRES_PASSWORD=orderflow \
  -e POSTGRES_DB=orderflow -p 5434:5432 postgres:16
cd backend
TEST_PG_URL=postgresql+psycopg://orderflow:orderflow@localhost:5434/orderflow pytest -q
```

Without `TEST_PG_URL` they skip, and a skipped test for the thing that took production down is
not a guard. CI sets it.

---

## Gate 1 — After the deploy, against the deployment

```bash
cd backend
python -m src.scripts.smoke_deployed https://your-deployment.example.com
```

Signs up, reads the account back, creates a party. **Step 2 is the one that matters**: during the
2026-10-09 outage, login returned 200 the whole time and it was the authenticated read that
failed, so a check stopping at "signup responded" would have passed through most of it.

Exit codes carry meaning:

| Code | Meaning | What to do |
| --- | --- | --- |
| 0 | Passed | Proceed |
| 1 | The deployment answered and a step failed | It is broken. Do not announce |
| 2 | Could not be reached | Nothing was learned. Re-run; if it persists, the deployment is down |

Only exit 2 justifies a re-run. Re-running a 1 until it goes green is how an outage gets announced.

**It creates one organization on whatever it checks**, named `SMOKE <timestamp>`, and prints the
ids. Against production that is a real row in a real database — deliberate, because checking
anywhere else does not verify what users reach.

The workflow runs this automatically when a production deployment succeeds. Run it by hand during
an incident, when depending on CI is the last thing you want.

---

## Gate 2 — A dispatch on a real phone

**No command closes this one.** Copy `docs/qa/mobile-dispatch.md` to
`docs/qa/records/<release-tag>.md` and fill it in, on a physical Android device and a physical
iPhone, against the **deployed** application.

The step that is the reason this exists:

> Focus the quantity field so the keyboard appears. **Without dismissing it**, find the submit
> control. Record whether it is reachable.

Playwright cannot render a keyboard. That clause of FR-008 has never been verified by anything.

A record missing a required field does not count. A record from a previous release does not count.
A Playwright run does not count — Principle XXVI says so explicitly.

Until a release train has records for both platforms, **it may not be announced or described as
supporting mobile dispatch** (FR-012).

---

## Gate 3 — Open an export in a real spreadsheet

Once per release. Download each format from the deployed product and open each in **both** Excel
and Google Sheets — they disagree about type inference, so one is half a check.

The one with teeth:

> Select a quantity column. The status bar shows a sum.

Numbers stored as text look identical and make `SUM` return zero, which a trader finds while
reconciling rather than while reading.

Also confirm an empty report still shows its header row. That is fixed in code and covered by
`test_report_columns.py`; this confirms it *renders* as an empty table rather than as a file the
spreadsheet refuses.

---

## Gate 4 — Can someone else do all of the above?

The test: hand `docs/README.md` to someone who has not worked on this and see whether they reach a
passing suite without pointing anything at production. If they have to ask, the documentation has
not passed.

---

## What blocks an announcement

Per Constitution XXIII, XXIV and XXVI, and FR-007 and FR-012:

- Gate 1 failing — blocks.
- Gate 2 missing or failing — blocks any mobile-dispatch claim for that release.
- Gate 3 failing — blocks claims about export, and the defect is recorded rather than worked
  around.
- The pre-deploy checklist failing — blocks, as it already did (Principle XIII).

**As of 2026-10-10, gates 1 and 2 have never been run.** The constitution records both as unmet.
`v0.3.0-difference` is tagged and pushed, and under these rules it is not yet announceable on
mobile dispatch.
