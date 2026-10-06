# Implementation Plan: OrderFlow MVP Core Platform

**Branch**: `001-orderflow-mvp` (no git repository initialized yet) | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-orderflow-mvp/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build OrderFlow's MVP: a multi-tenant SaaS where trading companies manage Parties,
Purchase Orders, and partial Dispatches, with Remaining Balance and delivery status
always computed live from dispatch history. Primary technical approach: a FastAPI
(Python) backend over PostgreSQL via SQLAlchemy + Alembic, with every query scoped
by `organization_id` through a tenant-context middleware/repository layer; JWT-based
auth with refresh tokens; a responsive React SPA frontend covering auth, dashboard,
parties, POs, dispatches, and settings; Stripe for billing; soft deletes and audit
logging as cross-cutting concerns applied uniformly across Parties, POs, and
Dispatches.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x (frontend)

**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, python-jose
or authlib (JWT), passlib/bcrypt (password hashing), stripe-python; React 18 +
Vite, TanStack Query (server-state/caching), React Router, Tailwind CSS
(responsive styling to satisfy Mobile + Desktop Equality)

**Storage**: PostgreSQL (primary relational store for Organizations, Users, Parties,
Purchase Orders, Dispatches, Audit Log, Notifications, Subscription/Plan records)

**Testing**: pytest + httpx (backend contract/integration tests), Vitest + React
Testing Library (frontend unit/component tests), Playwright (end-to-end smoke of
the P1 "create PO → record dispatch" flow)

**Target Platform**: Linux server (containerized API), modern evergreen browsers on
desktop and mobile (responsive web, no native app)

**Project Type**: Web application (separate backend API + frontend SPA)

**Performance Goals**: Dashboard and party detail view respond in <2s for an
organization with up to 10,000 POs (SC-005); report export completes in <10s for up
to 5,000 rows (SC-006); core PO-create + dispatch-record workflow completable in
<60s of user time (SC-002)

**Constraints**: Every data access path MUST filter by `organization_id` (no
cross-tenant leakage, FR-001); Remaining Balance/Status MUST be computed on read,
never persisted as a cached column (constitution Principle II); Parties/POs/
Dispatches MUST use soft deletes only (`deleted_at`), excluded from all
calculations and views (FR-017); all role checks MUST be enforced server-side
(FR-004); currency/timezone MUST be per-organization configuration, not global
constants (FR-019)

**Scale/Scope**: SME trading-company tenants; initial target on the order of
dozens to low hundreds of organizations, each with up to ~10,000 POs and tens of
users, per the Success Criteria scale assumptions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Multi-tenancy First | All tables carry `organization_id`; a shared tenant-scoping layer (SQLAlchemy query filter / repository base class) is mandatory on every query, not opt-in per endpoint | PASS |
| II. Remaining Balance is Sacred | Remaining Balance/Total Dispatched/Status computed via a query-time aggregate (SQL `SUM`/view or service-layer calculation) over non-deleted Dispatches; no `remaining_balance` column is persisted | PASS |
| III. Partial Dispatches are Core | Dispatch is modeled as its own table with a one-to-many relationship to Purchase Order; no "single delivery" shortcut exists in the data model | PASS |
| IV. Simplicity over Features | Chosen stack (FastAPI + plain SQLAlchemy models + a standard React SPA) avoids heavyweight enterprise patterns (no CQRS/event-sourcing) so the P1 workflow stays fast to build and fast to use | PASS |
| V. Role-Based Access | Roles (Owner/Manager/Staff/Viewer) enforced via a FastAPI dependency checked against the authenticated user's membership + role on every protected route, not just hidden in the UI | PASS |
| VI. Audit Everything Important | A shared audit-log write (actor, action, entity, before/after) is attached at the service layer for every create/edit/delete on Party, PO, Dispatch — not left to be added ad hoc per endpoint | PASS |
| VII. No Hard Deletes | `deleted_at` column + soft-delete repository methods on Party, PO, Dispatch; all default queries filter `deleted_at IS NULL` | PASS |
| VIII. Mobile + Desktop Equality | Tailwind responsive utility classes + mobile-first layout for the core workflow screens (PO create, dispatch entry, dashboard) | PASS |

No violations identified; Complexity Tracking table is not needed for this plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-orderflow-mvp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # SQLAlchemy models: organization, user, membership,
│   │                      party, purchase_order, dispatch, subscription,
│   │                      notification, audit_log
│   ├── schemas/          # Pydantic request/response schemas
│   ├── services/         # Business logic: balance calc, status calc, billing,
│   │                      notifications, audit logging, tenant scoping
│   ├── api/              # FastAPI routers: auth, orgs, parties, purchase_orders,
│   │                      dispatches, dashboard, reports, billing, admin
│   ├── core/              # Config, security (JWT), db session, middleware
│   └── migrations/        # Alembic migration scripts
└── tests/
    ├── contract/          # API contract tests per router
    ├── integration/        # Multi-tenant isolation, balance-calc, RBAC tests
    └── unit/               # Service-layer unit tests

frontend/
├── src/
│   ├── components/        # Shared UI (forms, tables, badges, layout shell)
│   ├── pages/              # Auth, Dashboard, Parties, PurchaseOrders, PartyDetail,
│   │                         Reports, Team/Settings, Billing, SuperAdmin
│   ├── features/            # Feature-scoped hooks/state (parties, pos, dispatches,
│   │                           dashboard, billing)
│   └── services/             # API client, auth/session handling
└── tests/
    ├── unit/                 # Component/unit tests
    └── e2e/                  # Playwright smoke test for P1 core workflow
```

**Structure Decision**: Web application structure (Option 2: separate `backend/`
and `frontend/`), since the feature spans a FastAPI service and a React SPA with
genuinely different toolchains, dependency sets, and test runners. A single-project
layout would force the frontend and backend to share build/test tooling for no
benefit and would work against Principle IV (Simplicity over Features) rather than
serve it.

## Complexity Tracking

> No Constitution Check violations were identified; this section is intentionally
> left empty.
