# OrderFlow — Local Development Setup

OrderFlow is a multi-tenant SaaS for tracking Purchase Orders, partial dispatches, and
live remaining balances. See `specs/001-orderflow-mvp/` for the full spec, plan, data
model, API contracts, and task breakdown, and `.specify/memory/constitution.md` for the
project's non-negotiable principles.

## Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 14+ (a local instance or a Docker container)

## Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env   # then edit DATABASE_URL, JWT_SECRET, etc.

alembic upgrade head
python -m src.scripts.seed        # optional: creates demo org + data
uvicorn src.main:app --reload --port 8000
```

### DATABASE_URL must point at a local database

**This is the single most important line in your `.env`, and the most dangerous to get
wrong.** This project's production database already holds several hundred organizations
created by test suites that resolved their connection from a developer's `.env`. Set it to a
local PostgreSQL:

```
DATABASE_URL=postgresql+psycopg://orderflow:orderflow@localhost:5432/orderflow
```

or, with Docker:

```bash
docker run -d --name orderflow-pg -e POSTGRES_USER=orderflow \
  -e POSTGRES_PASSWORD=orderflow -e POSTGRES_DB=orderflow -p 5432:5432 postgres:16
```

Three guards exist because of that history, and they are defaults rather than conventions
(Constitution Principle XXVII):

- **The e2e suite refuses to run** unless the backend reports a local database host. If it
  refuses, fix `DATABASE_URL` — do not reach for the override. `GET /health` tells you which
  host the backend is using (hostname only, never credentials).
- **`seed_landing_demo.py` refuses** a non-local host, because it creates fixture rows and
  `--recreate` hard-deletes them.
- **The test suite never migrates.** `pytest` disables the startup migration session-wide, and
  the app skips it under pytest as well. Verified by running the suite with `DATABASE_URL`
  pointed at an unroutable address: every test still passes, because nothing connects to it.

The one deliberate exception is `src/scripts/smoke_deployed.py`, which checks a deployed
system on purpose. It takes its target as a required argument, speaks only HTTP, and is not
part of any suite — so it cannot be reached by accident.

### Migrations run at startup

`src/core/migrate.py` brings the schema to head when the app boots, under a PostgreSQL
advisory lock so concurrent instances queue rather than race. It exists because a migration
was once deployed without being applied, which returned 500 from signup and from every
authenticated request until someone noticed.

Set `AUTO_MIGRATE=false` if a deployment grows a separate release phase that owns this.

### Tests that need a real PostgreSQL

The migration tests use an advisory lock and alembic history, neither of which SQLite has.
They **skip silently** without a database, so set `TEST_PG_URL`:

```bash
docker run -d --name pg -e POSTGRES_USER=orderflow -e POSTGRES_PASSWORD=orderflow \
  -e POSTGRES_DB=orderflow -p 5434:5432 postgres:16
TEST_PG_URL=postgresql+psycopg://orderflow:orderflow@localhost:5434/orderflow pytest -q
```

CI sets it. Locally, a skipped test for the thing that took production down is not a guard.

API docs (Swagger UI) are then available at `http://localhost:8000/docs`.

Demo login after seeding: `owner@demo.orderflow` / `password123`.

Run tests: `pytest -q`. Lint: `ruff check src/`.

### Notification sweep (Due Soon / Overdue)

Notifications are evaluated on-demand rather than by a built-in scheduler (see
`specs/001-orderflow-mvp/research.md` → Notifications). Run it manually or wire it to
cron/a scheduled task:

```bash
python -m src.scripts.evaluate_notifications
```

### Stripe billing

Billing endpoints require `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`STRIPE_PRICE_STARTER` / `STRIPE_PRICE_BUSINESS` / `STRIPE_PRICE_PRO` to be set in
`.env`. Without them, `/billing/checkout-session` returns a 503 rather than failing
unpredictably — the rest of the app (including the free trial) works without Stripe
configured.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` and expects the backend at
`http://localhost:8000` by default (override with `VITE_API_BASE_URL`).

Run unit tests: `npm test`. Typecheck: `npx tsc -b`. Lint: `npm run lint`.
E2E smoke test (requires both servers running): `npm run test:e2e`.

## Docker (backend)

```bash
cd backend
docker build -t orderflow-backend .
docker run -p 8000:8000 --env-file .env orderflow-backend
```

## CI

`.github/workflows/ci.yml` runs backend lint+tests (with a PostgreSQL service, so the
migration tests run rather than skip), frontend typecheck+lint+unit tests+build, and a Docker
build sanity check on every push/PR.

`.github/workflows/post-deploy-smoke.yml` runs after a successful **production** deployment
and checks the deployed system — see below.

## Releasing

Three gates, in `docs/SMOKE_CHECKLIST.md`, split into what is run before a deploy and what is
run after. The split is the point: before-deploy items verify the build, after-deploy items
verify what users reach, and on 2026-10-09 the first passed while the second would have
failed for hours.

```bash
# after any production deploy
python backend/src/scripts/smoke_deployed.py https://purchaseorderflow.vercel.app
```

Exit 0 passed, 1 the deployment answered and a step failed, 2 it could not be reached. Only
a 2 justifies a re-run.

The other two gates cannot be run by a machine and are not pretended otherwise:

- **A dispatch on a real phone**, once per release train, recorded from the template at
  `docs/qa/mobile-dispatch.md` into `docs/qa/records/<tag>.md`. Until that exists, the
  release may not be described as supporting mobile dispatch (Constitution Principle XXVI).
- **An export opened in Excel and Google Sheets**, once per release.

## What's simplified for MVP (see research.md for full rationale)

- Email sending logs to the console unless `SMTP_HOST` is configured — swap
  `src/services/email.py` for a provider SDK (SES/Postmark/SendGrid) for production.
- The Due Soon/Overdue notification sweep is a script to schedule externally, not a
  built-in background worker.
- The initial Alembic migration was hand-written (no live database was available to
  autogenerate against) — review it against a real Postgres instance, and use
  `alembic revision --autogenerate` for every migration after this one.

## For beta users: what's open and what isn't (2026-10-08)

**OrderFlow is a free trial. There are no paid plans yet.** You cannot buy
anything, there's nothing to cancel, and we don't ask for or store card details.
Every paid path — checkout, plan upgrades, the billing portal — is switched off at
the server, not just hidden, and will stay off until checkout is verified end to
end. We'll tell existing organizations before that changes.

What this means day to day:

- **Trial limits are 3 users and 25 purchase orders.** The figures on your Billing
  page are the ones the server actually enforces. Note that the purchase-order
  limit counts every order you haven't deleted, including fully dispatched ones —
  completing an order doesn't free up room.
- **When your trial ends, the organization becomes read-only.** Your records stay
  available to view and export; creating and editing pauses. Get in touch and we
  can extend it.
- **Team invitations need the link.** Invite emails only send once SMTP is
  configured on the deployment; until then an invited member shows as pending and
  an owner needs to pass on the accept link.
- **Reports export to CSV, Excel, and PDF.** All three work.

## Known limitations (launch hardening, 2026-10-07; revised 2026-10-08)

What's genuinely launch-ready vs. still trial-grade after the hardening pass
(see `api-examples.md` and `SMOKE_CHECKLIST.md` for what's been verified):

- **Trial expiry is lazy, not scheduled.** `check_trial_expiry` runs on every
  authenticated request (via `get_tenant_context`), not on a timer. An organization
  whose trial has expired won't flip to read-only until its next authenticated
  request — fine in practice, but not instantaneous.
- **Plan limits are per-organization counts, not usage trends.** `max_users` counts
  all memberships (including pending invites); `max_active_pos` counts
  non-deleted POs. There's no grace period or soft warning before the hard 403 —
  the first request past the limit is rejected outright.
- **Paid billing is switched off, not finished.** `PAID_PLANS_ENABLED` defaults to
  false: `GET /plans` returns no paid tiers, and checkout and portal sessions are
  refused with 403 before any Stripe call. The Stripe code and the webhook handler
  still exist and are untested end to end — enabling the flag is a separate,
  deliberately gated piece of work, not a config toggle.
- **No automated billing reconciliation beyond the Stripe webhook.** Moot while
  paid plans are gated, but unresolved: if a webhook delivery is missed (Stripe
  retries, but this isn't polled or reconciled on a schedule), a subscription
  could drift out of sync with Stripe's actual state.
- **Due Soon / Overdue notifications require an external scheduler** (see above) —
  nothing pages anyone if that script isn't scheduled.
- **No file/logo upload** — `Organization.logo_url` exists as a field but there's no
  upload endpoint or UI for it yet.
- **Single region, no read replicas, no caching layer** — fine for early trial
  volume, not evaluated under load.
- **Email is console-logged in development** and needs a real provider
  (SES/Postmark/SendGrid) wired into `src/services/email.py` before relying on
  password-reset or invite emails actually reaching anyone outside of local dev.
- **This doc and `api-examples.md` are the frozen contract** as of this pass — if
  a schema changes, update both alongside the code, not after the fact.
