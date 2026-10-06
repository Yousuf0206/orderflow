---
description: "Task list for OrderFlow MVP Core Platform"
---

# Tasks: OrderFlow MVP Core Platform

**Input**: Design documents from `specs/001-orderflow-mvp/` (plan.md, spec.md, research.md,
data-model.md, contracts/api.md, quickstart.md)

**Tests**: Not explicitly requested as a per-story TDD gate in spec.md. Dedicated contract/
integration test tasks are therefore omitted from each user-story phase; a single
cross-cutting "basic test coverage for critical paths" task is kept in Phase 12 (Polish),
matching the project's own task list, plus the quickstart.md scenarios as the acceptance
check for each story.

**Organization**: Tasks are grouped by user story (from spec.md, priorities P1–P9) so each
story can be implemented, demoed, and shipped independently, per the project's own phased
plan (Foundation → Core Business Logic → Dashboard & Views → Frontend MVP → Billing & Team →
Polish & Launch) re-sequenced around story independence.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps to spec.md user stories US1–US9
- Paths follow the Web application structure from plan.md: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize repository structure: `backend/` (FastAPI) and `frontend/` (React +
  Vite + TypeScript) per plan.md Project Structure
- [X] T002 [P] Set up backend dependencies in `backend/pyproject.toml`: FastAPI, SQLAlchemy
  2.x, Alembic, Pydantic v2, passlib[bcrypt], python-jose, stripe, pytest, httpx
- [X] T003 [P] Set up frontend dependencies in `frontend/package.json`: React 18, Vite,
  TypeScript, TanStack Query, React Router, Tailwind CSS, Vitest, React Testing Library,
  Playwright
- [X] T004 [P] Configure linting/formatting: `ruff`/`black` for backend, `eslint`/`prettier`
  for frontend
- [X] T005 [P] Configure environment management: `backend/src/core/config.py` (Pydantic
  Settings) and `frontend/.env.example`

**Checkpoint**: Projects scaffolded and installable; no business logic yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST exist before any user story can be built —
multi-tenancy, auth, roles, soft delete, and audit logging are cross-cutting per the
project constitution and must not be bolted on per-story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Configure PostgreSQL connection + Alembic migrations framework in
  `backend/src/core/db.py` and `backend/src/migrations/`
- [X] T007 [P] Create `Organization` model + migration in
  `backend/src/models/organization.py` (fields per data-model.md: name, logo_url, currency,
  timezone, plan_tier, trial_ends_at, is_suspended)
- [X] T008 [P] Create `User` model + migration in `backend/src/models/user.py`
- [X] T009 [P] Create `Membership` model + migration in `backend/src/models/membership.py`
  (organization_id, user_id, role, invited_at, accepted_at)
- [X] T010 Implement password hashing + JWT access/refresh token issuance in
  `backend/src/core/security.py`
- [X] T011 Implement auth endpoints (signup, login, refresh, password-reset
  request/confirm) in `backend/src/api/auth.py` (depends on T007–T010)
- [X] T012 Implement tenant-scoping dependency/base repository in
  `backend/src/core/tenant.py` that injects `organization_id` from the authenticated
  user's Membership into every query (Constitution Principle I — depends on T009, T011)
- [X] T013 Implement role-check dependency (`require_role(...)`) in
  `backend/src/core/security.py` for Owner/Manager/Staff/Viewer + Super Admin enforcement
  (depends on T009, T011)
- [X] T014 [P] Implement shared soft-delete mixin/base model (`deleted_at` filtering) in
  `backend/src/models/base.py` (Constitution Principle VII)
- [X] T015 [P] Implement shared audit-logging service (`AuditLogEntry` model +
  `log_action(...)` helper capturing actor/action/entity/before/after) in
  `backend/src/models/audit_log.py` and `backend/src/services/audit.py` (Constitution
  Principle VI — depends on T008)
- [X] T016 Configure global error handling + structured logging middleware in
  `backend/src/core/middleware.py`
- [X] T017 [P] Build frontend app shell (navigation, layout, auth-aware routing) in
  `frontend/src/components/AppShell.tsx` and `frontend/src/pages/` routing config
- [X] T018 [P] Build frontend auth pages (Login, Signup, Password Reset) in
  `frontend/src/pages/auth/` wired to `/auth/*` endpoints
- [X] T019 [P] Build frontend API client + session/token handling in
  `frontend/src/services/apiClient.ts`

**Checkpoint**: Foundation ready — auth, tenancy, roles, soft delete, and audit logging
all exist and are enforced centrally; user story implementation can now begin.

---

## Phase 3: User Story 1 - Create a PO and Record a Partial Dispatch (Priority: P1) 🎯 MVP

**Goal**: Manager/Staff can create a PO under a party and record partial dispatches, with
Remaining Balance and Status always computed live (constitution Principle II).

**Independent Test**: Create a PO, record two partial dispatches summing to less than the
ordered quantity, and confirm Remaining Balance/Status are correct after each dispatch
(quickstart.md Scenario B).

### Implementation for User Story 1

- [X] T020 [P] [US1] Create `PurchaseOrder` model + migration in
  `backend/src/models/purchase_order.py` (fields per data-model.md; soft delete via T014)
- [X] T021 [P] [US1] Create `Dispatch` model + migration in
  `backend/src/models/dispatch.py` (soft delete via T014)
- [X] T022 [US1] Implement balance/status calculation service (never persisted — Principle
  II) in `backend/src/services/po_calc.py`: `total_dispatched`, `remaining_balance`,
  `days_to_delivery`, `status` (depends on T020, T021)
- [X] T023 [US1] Implement Purchase Order endpoints (create, list with filters by party/
  status/date range, detail, edit, soft delete) in `backend/src/api/purchase_orders.py`
  (depends on T012, T013, T020, T022)
- [X] T024 [US1] Implement Dispatch endpoints (list history, create with over-dispatch
  warning + `confirm` override, soft delete) in `backend/src/api/dispatches.py` (depends on
  T022, T023)
- [X] T025 [US1] Wire audit logging (T015) into PO and Dispatch create/edit/delete in
  `backend/src/api/purchase_orders.py` and `backend/src/api/dispatches.py`
- [X] T026 [US1] Add validation: `po_number` unique per organization, `ordered_qty`/`qty` >
  0, `due_date >= order_date` in `backend/src/schemas/purchase_order.py` and
  `backend/src/schemas/dispatch.py`
- [X] T027 [P] [US1] Build Purchase Orders list + create/edit frontend pages in
  `frontend/src/pages/purchase-orders/` with filters (party, status, date range)
- [X] T028 [P] [US1] Build PO Detail page with dispatch history + "Add Dispatch" form
  (including the over-dispatch warning/confirm UI) in
  `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx`
- [X] T029 [US1] Ensure PO creation + dispatch entry screens are responsive/mobile-first
  (Constitution Principle VIII) and complete the full flow in under 60 seconds (SC-002)

**Checkpoint**: User Story 1 (the constitution's sacred core workflow) is fully functional
and independently testable via quickstart.md Scenario B and C.

---

## Phase 4: User Story 2 - Manage Parties (Priority: P2)

**Goal**: Manager can create, edit, archive, and search Party records.

**Independent Test**: Create a party, edit it, archive it, and confirm it is excluded from
default active search/filter results.

### Implementation for User Story 2

- [X] T030 [P] [US2] Create `Party` model + migration in `backend/src/models/party.py`
  (fields per data-model.md: party_code, party_name, city, contact_person, phone,
  archived_at; soft delete via T014)
- [X] T031 [US2] Implement Party endpoints (create, list with search/filter excluding
  archived + deleted, detail, edit, archive) in `backend/src/api/parties.py` (depends on
  T012, T013, T030)
- [X] T032 [US2] Validate `party_code` unique per organization among non-deleted rows in
  `backend/src/schemas/party.py`
- [X] T033 [US2] Wire audit logging (T015) into Party create/edit/archive in
  `backend/src/api/parties.py`
- [X] T034 [P] [US2] Build Parties list + create/edit form (search/filter) in
  `frontend/src/pages/parties/PartiesList.tsx` and `PartyForm.tsx`

**Checkpoint**: User Stories 1 AND 2 both work independently (PO creation can now reference
real Party data end-to-end).

---

## Phase 5: User Story 3 - Organization Setup & Team Access (Priority: P3)

**Goal**: Owner signs up, sets company profile, invites teammates, and assigns roles; roles
and tenant isolation are enforced on every action.

**Independent Test**: Sign up, complete company profile, invite a teammate, assign a role,
and confirm the invited user has exactly the permissions their role allows
(quickstart.md Scenarios A and E).

### Implementation for User Story 3

- [X] T035 [US3] Implement organization profile endpoints (get/update name, logo, currency,
  timezone) in `backend/src/api/org.py` (depends on T007, T012, T013)
- [X] T036 [US3] Implement member invite/list/role-change/remove endpoints in
  `backend/src/api/org.py` (depends on T009, T013)
- [X] T037 [US3] Implement invite-acceptance flow (invited user sets password, Membership
  `accepted_at` set) in `backend/src/api/auth.py` (depends on T009, T011)
- [X] T038 [US3] Enforce "at least one Owner per organization" validation on role change/
  removal in `backend/src/services/membership.py`
- [X] T039 [P] [US3] Build Company Settings page (profile, currency, timezone) in
  `frontend/src/pages/settings/CompanySettings.tsx`
- [X] T040 [P] [US3] Build Team/Members page (invite, change role, remove) in
  `frontend/src/pages/settings/TeamMembers.tsx`
- [X] T041 [US3] Write multi-tenant isolation + RBAC integration tests covering
  quickstart.md Scenarios D and E in `backend/tests/integration/test_tenant_isolation.py`
  and `test_rbac.py` (Constitution Principles I and V are non-negotiable — covered
  explicitly, not left to incidental coverage)

**Checkpoint**: Full team onboarding flow works; cross-tenant isolation and role
enforcement are explicitly verified.

---

## Phase 6: User Story 4 - Live Dashboard & Party Detail View (Priority: P4)

**Goal**: Users see organization-wide KPIs and can drill into a single party's open orders.

**Independent Test**: Seed POs/dispatches across two parties and confirm dashboard KPIs and
party detail view match expected totals and overdue/due-soon classifications.

### Implementation for User Story 4

- [X] T042 [US4] Implement dashboard endpoint (org-wide KPIs: total remaining balance,
  overdue count, due-soon count, party-wise summary) in `backend/src/api/dashboard.py`
  (depends on T022, T023)
- [X] T043 [US4] Extend Party detail endpoint to include that party's open orders +
  remaining quantities in `backend/src/api/parties.py` (depends on T022, T031)
- [X] T044 [P] [US4] Build Dashboard page (KPIs + party-wise summary) in
  `frontend/src/pages/dashboard/Dashboard.tsx`
- [X] T045 [P] [US4] Build Party Detail View (party's open orders + remaining quantities)
  in `frontend/src/pages/parties/PartyDetail.tsx`

**Checkpoint**: Dashboard and party detail views are live and accurate against seeded data.

---

## Phase 7: User Story 5 - Reports & Export (Priority: P5)

**Goal**: Manager generates and exports Remaining by Party, Overdue Orders, and Dispatch
History reports.

**Independent Test**: Generate each report against seeded data and confirm exported file
row counts/totals match the on-screen data.

### Implementation for User Story 5

- [X] T046 [US5] Implement report query endpoints (remaining-by-party, overdue-orders,
  dispatch-history) in `backend/src/api/reports.py` (depends on T022, T023)
- [X] T047 [US5] Implement CSV/Excel export endpoint (`/reports/{report}/export`) in
  `backend/src/api/reports.py` (depends on T046)
- [X] T048 [P] [US5] Build Reports page with report selector + export button in
  `frontend/src/pages/reports/Reports.tsx`

**Checkpoint**: All three reports are viewable and exportable.

---

## Phase 8: User Story 6 - Notifications & Alerts (Priority: P6)

**Goal**: Users get in-app notifications and email alerts when POs become Due Soon or
Overdue.

**Independent Test**: Advance a PO's due date into the Due Soon then Overdue windows and
confirm an in-app notification and email alert are generated.

### Implementation for User Story 6

- [X] T049 [P] [US6] Create `Notification` model + migration in
  `backend/src/models/notification.py`
- [X] T050 [US6] Implement scheduled status-evaluation job that flags Due Soon/Overdue POs
  and creates Notification rows, reusing the status calc from T022, in
  `backend/src/services/notifications.py` (depends on T022, T049)
- [X] T051 [US6] Implement transactional email sending (overdue/due-soon alerts) in
  `backend/src/services/email.py`, invoked from T050
- [X] T052 [US6] Implement notification endpoints (list, mark-read) in
  `backend/src/api/notifications.py` (depends on T049)
- [X] T053 [P] [US6] Build in-app notifications UI (bell/list, mark-read) in
  `frontend/src/components/Notifications.tsx`

**Checkpoint**: Due Soon/Overdue POs reliably generate both notification channels.

---

## Phase 9: User Story 7 - Audit Log (Priority: P7)

**Goal**: Owner/Manager can review who created/edited/deleted Parties, POs, and
Dispatches.

**Independent Test**: Create, edit, and archive/delete a Party, PO, and Dispatch, then
confirm each appears in the audit log with actor, action, timestamp, before/after.

### Implementation for User Story 7

- [X] T054 [US7] Implement audit log query endpoint (filter by entity type, user, date
  range; Owner/Manager only) in `backend/src/api/audit_log.py` (depends on T013, T015)
- [X] T055 [P] [US7] Build Audit Log page (filterable table) in
  `frontend/src/pages/audit/AuditLog.tsx`

**Checkpoint**: Every create/edit/delete across Parties, POs, and Dispatches (wired in
Phases 3–4) is visible and filterable here.

---

## Phase 10: User Story 8 - Billing & Subscription (Priority: P8)

**Goal**: Organizations start on a free trial and can upgrade to Starter/Business/Pro via
Stripe, with usage limits enforced; trial expiry triggers read-only lockout (FR-021).

**Independent Test**: Sign up, confirm trial status/expiry is visible, upgrade via Stripe
checkout, confirm plan limits are enforced.

### Implementation for User Story 8

- [X] T056 [P] [US8] Create `Subscription`/Plan model + migration in
  `backend/src/models/subscription.py` (plan_tier, stripe_customer_id,
  stripe_subscription_id, max_users, max_active_pos, trial_ends_at,
  is_read_only_locked)
- [X] T057 [US8] Implement Stripe Checkout + Customer Portal session endpoints in
  `backend/src/api/billing.py` (depends on T056)
- [X] T058 [US8] Implement Stripe webhook handler to sync Subscription state (plan changes,
  payment status) in `backend/src/api/billing.py` (depends on T056)
- [X] T059 [US8] Implement usage-limit enforcement (block exceeding max_users /
  max_active_pos with a clear upgrade message) in `backend/src/services/billing.py`
  (depends on T056)
- [X] T060 [US8] Implement trial-expiry read-only lockout: scheduled check that sets
  `is_read_only_locked` and blocks create/edit (not read/export) once `trial_ends_at`
  passes without upgrade (FR-021) in `backend/src/services/billing.py` and
  `backend/src/core/tenant.py` write-guard
- [X] T061 [P] [US8] Build Billing page (plan selection, trial status, usage vs. limits,
  Stripe Checkout/Portal links) in `frontend/src/pages/billing/Billing.tsx`

**Checkpoint**: Full trial → paid lifecycle works, including the read-only lockout path.

---

## Phase 11: User Story 9 - Super Admin Console (Priority: P9)

**Goal**: Internal Super Admin can view all organizations, suspend/reactivate them, and see
basic platform metrics.

**Independent Test**: Log in as Super Admin, view all organizations, suspend one, confirm
its users are blocked, then reactivate it.

### Implementation for User Story 9

- [X] T062 [US9] Implement Super Admin endpoints (list organizations, suspend, reactivate,
  platform metrics) in `backend/src/api/admin.py` (depends on T007, T013 — `is_super_admin`
  check, bypasses normal org-scoped tenant filter by design)
- [X] T063 [US9] Enforce `is_suspended` check in the auth/tenant-scoping layer so suspended
  organizations' users are blocked immediately (depends on T007, T012, T062)
- [X] T064 [P] [US9] Build Super Admin panel (org list, suspend/reactivate, metrics) in
  `frontend/src/pages/admin/SuperAdmin.tsx`

**Checkpoint**: All nine user stories are independently functional.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Launch-readiness items that span multiple user stories (from the project's
own Phase 6 plan).

- [X] T065 [P] Build onboarding wizard (first-run guide through org setup → first party →
  first PO) in `frontend/src/pages/onboarding/Onboarding.tsx`
- [X] T066 [P] Build public Landing page + Pricing page in `frontend/src/pages/marketing/`
- [X] T067 [P] Add consistent error, loading, and empty states across all frontend pages
  built in Phases 2–11 — basic pass only (inline "Loading...", empty-state rows, and
  form-level error messages); no global error boundary or toast/notification system yet.
- [X] T068 Add basic test coverage for critical paths: backend pytest suite for
  tenant isolation, RBAC, and balance/status calc (building on T041); frontend Vitest
  coverage for PO/Dispatch forms; one Playwright E2E test for the P1 core workflow in
  `backend/tests/`, `frontend/tests/unit/`, `frontend/tests/e2e/` — backend suite (9 tests)
  verified passing; frontend has 1 Vitest test verified passing; the Playwright spec is
  written but not executed in this environment (needs both servers + a browser runtime).
- [X] T069 Set up CI/CD deployment pipeline (build → test → deploy) for backend container
  and frontend static build — `.github/workflows/ci.yml` written (lint+test both apps,
  Docker build check); not yet run against a real CI service since there's no git remote.
- [X] T070 [P] Write seed-data script (`backend/src/scripts/seed.py`) and setup
  documentation (`docs/README.md`) for local development and demo data
- [X] T071 Run quickstart.md Scenarios A–F end-to-end against a deployed/staging build as
  the final MVP acceptance check — DONE 2026-10-06 against a real Supabase-hosted
  PostgreSQL 17 instance (not SQLite): Alembic migration applied cleanly, seed script ran,
  API server started against it, and all of Scenarios A–F passed (16/16 assertions,
  including org isolation, over-dispatch confirm flow, staff invite-accept + RBAC
  enforcement, and soft-delete/audit-log behavior). See chat history for the verification
  script and raw results.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (auth, tenancy,
  roles, soft delete, audit logging must exist first)
- **User Stories (Phases 3–11)**: All depend on Foundational completion
  - US1 (P1) has no dependency on other stories and is the MVP target
  - US2 (P2) can proceed in parallel with US1 once Foundational is done; US1's PO screens
    assume Parties exist, so US2's backend (T030–T033) should land before US1's frontend
    (T027–T028) is demoed end-to-end, though the APIs can be built in parallel
  - US3 (P3) team/org features are independent of US1/US2 data but share the same auth
    foundation
  - US4 (P4) depends on US1 and US2 data existing (reads POs and Parties)
  - US5 (P5) depends on US1 and US2 data existing (reads POs, Parties, Dispatches)
  - US6 (P6) depends on US1's status calculation (T022)
  - US7 (P7) depends on the audit-write hooks added in US1/US2/US3 (T025, T033) actually
    producing entries to display
  - US8 (P8) is independent of US1/US2 data but depends on Foundational org/auth
  - US9 (P9) depends on Organizations existing (Foundational) and is otherwise independent
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### Parallel Opportunities

- All [P]-marked tasks within a phase touch different files and can run in parallel
- Once Phase 2 (Foundational) completes, US1 and US2 backend work can proceed in parallel;
  US3, US8, and US9 can also start in parallel since they don't depend on PO/Party data
- Frontend page tasks marked [P] within a story can run in parallel with that story's
  backend tasks once the relevant API contract (contracts/api.md) is stable

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Complete Phase 3 (User Story 1 — the constitution's sacred core workflow)
3. Validate against quickstart.md Scenarios B and C
4. Deploy/demo if ready

### Incremental Delivery

Phases 3 → 11 in priority order (P1 → P9), each independently validated via its
"Independent Test" before moving on, then Phase 12 (Polish) before launch.
