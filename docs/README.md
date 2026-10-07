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

`.github/workflows/ci.yml` runs backend lint+tests, frontend typecheck+lint+unit
tests+build, and a Docker build sanity check on every push/PR.

## What's simplified for MVP (see research.md for full rationale)

- Email sending logs to the console unless `SMTP_HOST` is configured — swap
  `src/services/email.py` for a provider SDK (SES/Postmark/SendGrid) for production.
- The Due Soon/Overdue notification sweep is a script to schedule externally, not a
  built-in background worker.
- The initial Alembic migration was hand-written (no live database was available to
  autogenerate against) — review it against a real Postgres instance, and use
  `alembic revision --autogenerate` for every migration after this one.

## Known limitations (launch hardening, 2026-10-07)

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
- **No automated billing reconciliation beyond the Stripe webhook.** If a webhook
  delivery is missed (Stripe retries failed webhooks, but this isn't polled or
  reconciled on a schedule), a subscription could drift out of sync with Stripe's
  actual state until the next webhook event arrives.
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
