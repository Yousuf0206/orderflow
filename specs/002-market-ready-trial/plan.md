# Implementation Plan: Market-Ready Trial Updates

**Branch**: `002-market-ready-trial` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-market-ready-trial/spec.md`

## Summary

Stabilise what exists, remove paid pressure, and make the trial path undeniable.

The codebase survey behind this plan found that the work is smaller than the kit
assumes in two streams and larger in one. Positioning (Stream A) is mostly
deletion, and the landing page already passes its audit. Team and Reports
(Stream D) are built end to end, including all three export formats, so that
stream collapses to fixing unchecked failure paths. Reliability (Stream B) is the
real work: **14 of 15 screens that fetch data never check for failure**, and the
shared request layer has no timeout, so the two loading messages the constitution
names by name are reproducible defects with a single shared root cause.

The technical approach is therefore: one fix in the shared request layer plus one
reusable query-state component to close Stream B across all 14 screens; delete
paid surfaces behind a single server-owned flag for Stream A; and treat Streams C
and D as verification with targeted repairs rather than construction.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.6 / React 18.3 (frontend)

**Primary Dependencies**: FastAPI 0.115, SQLAlchemy 2.0, Pydantic 2.9,
pydantic-settings, Alembic, Stripe 11.1, openpyxl, reportlab (backend);
React Router 6.27, TanStack Query 5.59, Tailwind 3.4, Vite 5.4, Recharts
(frontend)

**Storage**: PostgreSQL via SQLAlchemy + Alembic migrations

**Testing**: pytest + httpx (backend); Vitest + Testing Library (frontend unit);
Playwright (end-to-end, already configured via `npm run test:e2e`)

**Target Platform**: Linux server (containerised backend, `backend/Dockerfile`) +
evergreen browsers; responsive web, desktop and mobile viewports

**Project Type**: Web application — separate `backend/` and `frontend/` trees

**Performance Goals**: No new throughput goals. One new user-facing timing
guarantee: every data-backed screen reaches a terminal state within 15 seconds
under failure or stall (SC-005).

**Constraints**: No domain-engine rewrite without a proven bug (constitution
Constraints). Remaining balance stays derived, never stored (Principle II). No
new migration is required by this feature. Paid checkout stays out of scope
(Principle XIV) — this feature only hides and disables.

**Scale/Scope**: 15 screens audited, 14 needing error-state repair; 4 surfaces
carrying paid affordances to remove; 1 shared request layer; 1 new server
setting; 0 schema changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0.

| Gate | Verdict | Evidence / Note |
|------|---------|-----------------|
| I. Multi-tenancy First | **PASS** | No data-access changes. The new `paid_plans_enabled` setting is deployment-wide, not tenant data, so it introduces no tenant-scoped read path. |
| II. Remaining Balance is Sacred | **PASS** | No change to balance computation. Stream B touches only presentation and failure states. |
| III. Partial Dispatches are Core | **PASS** | No change to dispatch behaviour. |
| IV. Simplicity over Features | **PASS** | Net removal of surface. One shared component replaces 14 ad-hoc states rather than adding 14 new ones. |
| V. Role-Based Access | **PASS** | No authorisation changes. The existing owner-only billing 403 path is preserved. |
| VI. Audit Everything Important | **PASS** | No business-record mutations introduced. |
| VII. No Hard Deletes | **PASS** | No deletion paths touched. |
| VIII. Mobile + Desktop Equality | **GATED** | New error and empty states must be verified at mobile width, not only desktop. Enforced in `quickstart.md` validation. |
| IX. Trial-First Positioning | **DRIVES** | Stream A exists to satisfy this. |
| X. Core Loop Boringly Reliable | **GATED** | Requires UI-level proof. API tests alone cannot discharge it; `quickstart.md` defines the UI run. |
| XI. Truth Over Marketing | **DRIVES + CONFLICT FOUND** | See Complexity Tracking: the kit's proposed `TRIAL_MAX_USERS` / `TRIAL_MAX_ACTIVE_POS` env vars would create a second source of truth for limits and are rejected. |
| XII. No Silent Failures | **DRIVES** | Stream B exists to satisfy this. |
| XIII. Smoke Test Before Deploy | **GATED** | Stream E must produce a runnable smoke path, not only a written list. |
| XIV. Paid Work Is Gated | **PASS** | This feature only hides/disables paid CTAs — the explicitly permitted exception. No Stripe wiring is added or completed. |

**Gate result: PASS with one rejected input.** No violation requires
justification. One element of the supplied config suggestion is rejected on
Principle XI grounds and recorded in Complexity Tracking.

### Post-Phase 1 re-check

Re-evaluated after the design artifacts below were written. No gate changed
verdict. Two design decisions were made specifically to keep gates passing:

- `paid_plans_enabled` is owned by the **backend** and exposed over the API,
  rather than a Vite build-time variable, so the flag cannot drift from what the
  server will actually honour (Principle XI).
- The limits shown on every surface continue to come from `GET /billing` for
  signed-in users, with `PLAN_LIMITS` remaining the single server-side
  definition (Principle XI, FR-008).

## Project Structure

### Documentation (this feature)

```text
specs/002-market-ready-trial/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output — smoke + validation runbook
├── contracts/
│   ├── public-plans.md      # GET /plans behaviour under the flag
│   ├── billing-info.md      # GET /billing as the limits source of truth
│   └── ui-query-states.md   # The three-terminal-state UI contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── core/
│   │   └── config.py              # ADD paid_plans_enabled; trial_length_days already present
│   ├── models/
│   │   └── subscription.py        # PLAN_LIMITS / PLAN_PRICES — single limits source, unchanged
│   ├── api/
│   │   ├── plans.py               # Gate paid tiers behind the flag
│   │   ├── billing.py             # Refuse checkout/portal when flag is off; expose trial length
│   │   └── org.py                 # Invite path — verify pending state when SMTP unset
│   ├── services/
│   │   └── billing.py             # enforce_usage_limits / check_trial_expiry — unchanged
│   └── scripts/
│       └── seed.py                # Read trial_length_days instead of hardcoded 14 (FR-011a)
└── tests/
    ├── integration/               # Flag behaviour, limit refusal messages
    └── unit/

frontend/
├── src/
│   ├── services/
│   │   └── apiClient.ts           # ADD request timeout — single root-cause fix for FR-028
│   ├── components/
│   │   └── ui/
│   │       ├── QueryState.tsx     # NEW — shared loading/empty/error/retry wrapper
│   │       └── ErrorState.tsx     # NEW — error + retry presentation
│   ├── hooks/
│   │   └── useTrialInfo.ts        # NEW — single read of plan/limits/trial length for UI copy
│   └── pages/
│       ├── marketing/
│       │   ├── Landing.tsx        # Trial-length copy only; CTAs already pass
│       │   └── Pricing.tsx        # Replace paid tier cards with single trial message
│       ├── billing/Billing.tsx    # Remove upgrade + manage-billing paths
│       ├── parties/               # PartyDetail, PartiesList — adopt QueryState
│       ├── purchase-orders/       # Detail, List, Form — adopt QueryState
│       ├── dashboard/             # Dashboard — adopt QueryState
│       ├── reports/Reports.tsx    # Check export response status before download
│       ├── audit/AuditLog.tsx     # Adopt QueryState
│       └── settings/              # TeamMembers, CompanySettings — adopt QueryState
└── tests/
    └── e2e/                       # Playwright: the core-loop smoke path (Stream E)

docs/
└── SMOKE_CHECKLIST.md             # Stream E written checklist (exists; two items now
                                   # contradict this feature — see quickstart.md)
```

**Structure Decision**: The repository is an existing two-tree web application
(`backend/` FastAPI + `frontend/` React), and this feature modifies that layout in
place. No new top-level directories are introduced. Three new frontend modules are
added (`QueryState.tsx`, `ErrorState.tsx`, `useTrialInfo.ts`) because the
alternative — repeating error and retry handling inline across 14 screens —
would violate Principle IV and would make FR-027 unverifiable screen by screen.

## Workstream Mapping

The supplied streams map to spec requirements as follows. Sequencing differs from
the kit in one place, explained below.

| Stream | Spec requirements | Effort (kit → revised) | Note |
|--------|-------------------|------------------------|------|
| A — Positioning | FR-001 … FR-007, FR-010, FR-011 | 0.5–1 d → **0.5 d** | Landing already passes; work is deletion plus one flag. |
| B — Reliability | FR-014 … FR-018, FR-027 … FR-031 | 2–4 d → **3–4 d** | Larger than it looks: 14 screens, but one shared root cause. |
| C — Limits truth | FR-008, FR-009, FR-012, FR-013 | 1 d → **0.5 d** | Billing already reads limits from the API; onboarding shows none. |
| D — Team & Reports | FR-032 … FR-043 | 2–3 d → **1 d** | Invite and all three exports already work; fix unchecked failures. |
| E — Deploy discipline | FR-026, SC-002, SC-010 | ongoing → **ongoing** | Needs a runnable path, not only a written list. |

**Sequencing change**: Stream A should land **before** Stream B, not in parallel.
Stream A deletes the Pricing and Billing paid surfaces outright, and both of those
screens are on Stream B's list of 14 needing error-state repair. Doing A first
removes two screens from B's scope and avoids repairing code that is about to be
deleted.

## Complexity Tracking

> Filled because one supplied input conflicts with a constitution gate.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| `TRIAL_MAX_USERS=3` and `TRIAL_MAX_ACTIVE_POS=25` as environment variables, per the supplied config suggestion | Not needed. **Rejected.** | `PLAN_LIMITS` in `backend/src/models/subscription.py:9` already defines trial limits as 3 users / 25 active POs, and `enforce_usage_limits` already enforces them from that definition. Adding env vars would create a second source of truth for the same numbers, so a deployment could enforce one value while another surface displayed a different one — exactly the drift Principle XI forbids and FR-008 is written to prevent. Limits stay in `PLAN_LIMITS`. |
| `TRIAL_DAYS=14` as a new variable | Not needed as new. | `trial_length_days: int = 14` already exists at `backend/src/core/config.py:27` and is already what signup grants. The real defect is that `backend/src/scripts/seed.py:50` hardcodes `timedelta(days=14)` independently; FR-011a fixes that by making seeding read the setting. No new variable. |
| `PAID_PLANS_ENABLED=false` as a new setting | **Accepted.** Needed so a single server-owned value gates every paid surface at once, rather than four screens each deciding independently. | A frontend-only constant was rejected: it could disagree with a backend that still honours checkout, leaving a path reachable by direct URL. A per-screen conditional was rejected under Principle IV. |
