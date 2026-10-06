# Phase 0 Research: OrderFlow MVP Core Platform

All Technical Context items were resolved directly from the project's stated
direction (FastAPI/PostgreSQL/SQLAlchemy/Alembic/Stripe) plus reasonable,
documented defaults for items left unspecified (frontend framework, testing
tools). No items remain marked NEEDS CLARIFICATION.

## Backend framework & ORM

- **Decision**: FastAPI + SQLAlchemy 2.x (declarative models, typed) + Alembic for
  migrations + Pydantic v2 for request/response schemas.
- **Rationale**: Explicitly specified by the project. FastAPI's dependency-injection
  system is a natural fit for enforcing tenant scoping and role checks on every
  route (Principles I and V), and Pydantic validation keeps input validation at
  system boundaries, per project conventions.
- **Alternatives considered**: Django + DRF (heavier, more batteries-included than
  needed for Principle IV "Simplicity over Features"); Node/NestJS (rejected,
  project direction specifies Python/FastAPI).

## Multi-tenancy enforcement

- **Decision**: Every tenant-owned table carries `organization_id`; a shared
  SQLAlchemy query layer (base repository / session-scoped filter) injects the
  current request's `organization_id` into every SELECT/UPDATE/DELETE, sourced
  from the authenticated user's membership via a FastAPI dependency. No endpoint
  is allowed to query these tables without going through that layer.
- **Rationale**: Centralizing tenant scoping in one place is the only way to make
  Principle I ("No cross-tenant data leakage is acceptable under any
  circumstance") actually enforceable — per-endpoint manual filtering is where
  leaks happen in practice.
- **Alternatives considered**: PostgreSQL Row-Level Security (RLS) policies as a
  defense-in-depth second layer — recommended as a future hardening step, not
  required for MVP given the added operational complexity (Principle IV).
  Separate database-per-tenant — rejected as unnecessary operational overhead at
  SME SaaS scale (Scale/Scope).

## Authentication & authorization

- **Decision**: JWT access tokens (short-lived) + refresh tokens (longer-lived,
  rotated), password hashing via bcrypt, password-reset via time-limited signed
  tokens emailed to the user. Role (Owner/Manager/Staff/Viewer) and Super Admin
  status stored on the membership/user record and checked via a FastAPI
  dependency on every protected route.
- **Rationale**: Matches the explicitly requested auth approach; stateless JWT
  access tokens scale simply for a web API without a server-side session store.
- **Alternatives considered**: Server-side sessions (simpler revocation, rejected
  because it was not the requested direction and adds session-store
  infrastructure); third-party auth-as-a-service (rejected for MVP simplicity and
  cost; revisit post-MVP if SSO is requested).

## Real-time balance & status calculation

- **Decision**: Remaining Balance, Total Dispatched, and Status are computed at
  query time from the PO's non-deleted Dispatches (e.g., a SQL aggregate or a
  service-layer function called on read) and are never written to a persisted
  column on the Purchase Order.
- **Rationale**: Directly mandated by constitution Principle II ("Never store
  remaining balance as a static value").
- **Alternatives considered**: Maintaining a cached/denormalized
  `remaining_balance` column updated on every dispatch write — rejected outright,
  it is exactly what the constitution forbids (risk of drift under concurrent
  writes).

## Soft deletes & audit logging

- **Decision**: `deleted_at` nullable timestamp column on Party, Purchase Order,
  and Dispatch; all default repository queries filter `deleted_at IS NULL`. A
  shared audit-logging service call wraps create/edit/delete operations on these
  three entities, recording actor, action, entity type/id, timestamp, and a
  before/after snapshot.
- **Rationale**: Directly mandated by constitution Principles VI and VII.
  Centralizing both soft-delete filtering and audit writes in the service layer
  (rather than repeating logic per endpoint) avoids an endpoint accidentally
  skipping either requirement.
- **Alternatives considered**: Database triggers for audit logging — rejected for
  MVP as it moves business logic out of the application layer and makes local
  development/testing harder; can be revisited later for stronger guarantees.

## Billing

- **Decision**: Stripe Checkout for plan upgrades, Stripe Customer Portal for
  self-serve plan/payment management, Stripe Webhooks to keep
  Subscription/Plan state in sync (trial status, active plan, usage limits).
- **Rationale**: Explicitly specified; Stripe's hosted Checkout/Portal minimizes
  PCI scope and custom billing UI work, in line with Principle IV.
- **Alternatives considered**: Building a custom billing UI over the Stripe API
  directly — rejected for MVP as unnecessary complexity versus hosted
  Checkout/Portal.

## Frontend framework & styling

- **Decision**: React 18 + TypeScript, built with Vite, styled with Tailwind CSS;
  TanStack Query for server-state caching/fetching; React Router for navigation.
- **Rationale**: Not specified by the user, so a mainstream, low-friction default
  was chosen that supports fast iteration (Principle IV) and straightforward
  responsive layouts for Principle VIII (Mobile + Desktop Equality). Tailwind's
  utility classes make mobile-first responsive design fast to apply consistently
  across the many CRUD-style screens in this MVP.
- **Alternatives considered**: Next.js (rejected — its server-rendering/routing
  features are not needed since this is a pure SPA over a separate FastAPI API;
  adding it would be unjustified complexity under Principle IV); Vue/Svelte
  (reasonable alternatives, not chosen only to keep the ecosystem/tooling choice
  unsurprising for a typical hiring/contributor pool).

## Notifications

- **Decision**: In-app notifications stored as rows tied to a user/organization,
  polled or fetched on dashboard load; transactional email alerts sent via a
  standard transactional email provider (e.g., SES/Postmark/SendGrid — exact
  provider is an infrastructure choice deferred to implementation, not a
  product-level decision) triggered by the same status-evaluation job that flags
  Overdue/Due Soon POs.
- **Rationale**: Matches FR-014; keeps the notification trigger logic colocated
  with the status calculation that already determines Overdue/Due Soon (Phase 0
  decision above), avoiding duplicate "is this overdue" logic.
- **Alternatives considered**: Real-time push (WebSockets) for in-app
  notifications — rejected for MVP as unnecessary complexity (Principle IV);
  polling/on-load fetch is sufficient for the stated use case.

## Testing strategy

- **Decision**: pytest + httpx for backend contract and integration tests
  (including dedicated multi-tenant-isolation and RBAC test suites); Vitest +
  React Testing Library for frontend unit/component tests; a small Playwright
  suite covering the P1 "create PO → record dispatch" end-to-end flow as the
  MVP's critical-path smoke test.
- **Rationale**: Standard, well-supported tools for the chosen stack; the
  dedicated tenant-isolation and RBAC test suites directly protect constitution
  Principles I and V, which are explicitly "non-negotiable."
- **Alternatives considered**: Full end-to-end coverage of every user story via
  Playwright — deferred post-MVP; for now only the P1 critical path gets E2E
  coverage, per FR priorities and Principle IV.

## Deployment

- **Decision**: Containerized FastAPI backend (Docker) behind a standard CI
  pipeline (build → test → deploy); frontend built as static assets served
  separately (e.g., a CDN/static host) or via the same container setup; seed-data
  script and setup documentation produced alongside the pipeline.
- **Rationale**: Matches the project's stated Phase 6 goal ("deployment
  pipeline") without prescribing a specific cloud provider, which is an
  infrastructure decision outside this feature's scope.
- **Alternatives considered**: None evaluated in depth — specific hosting
  provider selection is deferred to the implementation/ops phase.
