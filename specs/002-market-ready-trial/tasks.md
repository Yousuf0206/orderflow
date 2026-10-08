---
description: "Task list for Market-Ready Trial Updates"
---

# Tasks: Market-Ready Trial Updates

**Input**: Design documents from `/specs/002-market-ready-trial/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Test tasks ARE included. Constitution Principle XIII makes a passing
smoke run a hard release gate, Principle X rejects an API-level pass as evidence
for the core loop, and each contract document carries a "tests required" table.

**Organization**: Grouped by user story so each ships independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1–US6 from [spec.md](./spec.md)

## Path Conventions

Web application, two trees: `backend/src/`, `backend/tests/`, `frontend/src/`,
`frontend/tests/`. No new top-level directories.

---

## Mapping to the sp.tasks board

Your board is phase-ordered; this file is story-ordered so each slice stays
independently shippable. Every one of your items is carried, and four change shape
because the codebase survey contradicted their premise.

| Your item | Here | Change |
|-----------|------|--------|
| T0.1 product decision | — | Already done: constitution v1.1.0, Principles IX & XIV |
| T0.2 document trial limits | T003 | Already captured in [data-model.md](./data-model.md); becomes a verification task |
| T0.3 write smoke checklist | T085–T087 | `docs/SMOKE_CHECKLIST.md` already exists; two of its items now contradict this feature and must be corrected |
| T1.1 `PAID_PLANS_ENABLED` | T004 | Backend setting, not a build-time constant — see [research R4](./research.md) |
| T1.2 landing CTA only | T043 | **Already passes.** All three CTAs are "Start free trial" → `/signup`. Reduced to the trial-length copy fix |
| T1.3 pricing trial-only | T036–T038 | Preferred option adopted (single message) |
| T1.4 billing hide CTAs | T039–T042 | Plus: the direct endpoint must refuse, or the path stays reachable |
| T1.5 remove $29/$79/$199 contradiction | T033–T035 | Gated at the API too, not only the card |
| T2.1 / T2.2 indefinite loading | T015–T022 | One shared root cause across **14** modules, not 2 — see [research R1](./research.md) |
| T2.3 global error + retry | T005–T010 | Promoted to Foundational: blocks every story |
| T2.4 / T2.5 signup + logout | T026–T029 | |
| T2.6 / T2.7 dispatch + over-dispatch | T030–T032 | |
| T3.1–T3.4 limits truth | T045–T054 | Smaller than estimated: Billing already reads limits from the API |
| T4.1 map Team API routes | T065 | No 404s found; becomes a verification task |
| T4.2 / T4.3 invite | T066–T070 | Accept-invite **already exists**; SMTP is unset by default, so pending is the real path |
| T4.4 reports table | T071 | |
| T4.5 CSV export | T072 | **Already works.** Real defect: `resp.ok` unchecked — an error body downloads as `report.csv` |
| T4.6 hide Excel/PDF | T073 | **Nothing to hide** — all three formats work server-side |
| T4.7 audit log smoke | T076–T077 | |
| T5.1–T5.5 launch gate | T088–T095 | T5.5 needs your explicit go-ahead (outward-facing) |
| Later kit | Out of scope | Principle XIV; recorded at the end |

---

## Phase 1: Setup

**Purpose**: Establish an isolated branch and a known-good baseline to measure against.

- [X] T001 Create and switch to branch `002-market-ready-trial` from `main` (repository root; currently on `main` with a clean tree)
- [X] T002 [P] Record the baseline: run `pytest` in `backend/` and `npm run test -- --run` plus `npm run build` in `frontend/`, and note any pre-existing failures in `specs/002-market-ready-trial/baseline.md` so this feature is not blamed for them
- [X] T003 [P] Verify the documented trial limits against the running API: confirm `GET /billing` reports 3 users / 25 active POs and that these match `PLAN_LIMITS` in `backend/src/models/subscription.py:9` (your T0.2 — figures already recorded in `data-model.md`)

**Checkpoint**: Branch isolated, baseline known.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared request layer, the shared query-state component, the paid-plans gate, and the billing response. Every user story below depends on at least one of these.

**⚠️ CRITICAL**: No user story work starts until this phase completes. These are the
two root causes from [research R1](./research.md) plus the single gate from R4 —
fixing them here is what keeps 14 screens from each inventing their own behaviour.

- [X] T004 Add `paid_plans_enabled: bool = False` to `Settings` in `backend/src/core/config.py` (env var `PAID_PLANS_ENABLED`; deployment-wide, **not** tenant data — see `data-model.md`). Do **not** add `TRIAL_MAX_USERS` or `TRIAL_MAX_ACTIVE_POS`: `PLAN_LIMITS` stays the single limits definition (plan Complexity Tracking)
- [X] T005 Add a request timeout to `request()` in `frontend/src/services/apiClient.ts` using `AbortSignal`, so a stalled fetch aborts rather than pending forever. Budget: 15 s per attempt, matching SC-005. Applies to every `api.get/post/patch/delete` call
- [X] T006 Add a timeout/network branch to `describeApiError` in `frontend/src/services/apiClient.ts` returning trader-readable text (e.g. "Couldn't reach the server. Check your connection and try again."). It MUST NOT surface `AbortError` or a bare status code (FR-031). Same file as T005, so sequential
- [X] T007 Decide and apply the retry budget in `frontend/src/main.tsx` so total time to a terminal state still meets SC-005's 15 s: `retry: 1` currently means a timeout is retried, doubling worst-case time. Either shorten the per-attempt budget or disable retry on timeout — record the choice in a comment
- [X] T008 [P] Create `frontend/src/components/ui/ErrorState.tsx`: error message plus a retry control, rendering without horizontal overflow at phone width (Principle VIII)
- [X] T009 Create `frontend/src/components/ui/QueryState.tsx` accepting `isLoading`, `isError`, `error`, `data`, `refetch`, a caller-supplied skeleton, and a caller-supplied empty state. It MUST NOT render the loading branch when `isError` is true — that is the exact defect being fixed. Depends on T008
- [X] T010 [P] Add unit tests for `QueryState` in `frontend/tests/` covering all four inputs: loading, data, empty, and error-with-retry — including the regression case where `data` is undefined **and** `isLoading` is false, which must render the error state, never loading
- [X] T011 Extend the `GET /billing` response in `backend/src/api/billing.py` with `current_users`, `current_active_pos`, `paid_plans_enabled`, and `has_billing_account` (a boolean derived from `stripe_customer_id`, **never** the identifier itself) per `contracts/billing-info.md`
- [X] T012 Ensure `current_users` and `current_active_pos` in T011 are counted by the **same** definition `enforce_usage_limits` uses in `backend/src/services/billing.py:38,49`. A display count that diverges from the enforcement count would show "7 of 25" to a user who is already blocked
- [X] T013 [P] Create `frontend/src/hooks/useTrialInfo.ts` as the single read of plan tier, trial end date, limits, usage, and paid availability from `GET /billing`, so no screen re-derives them
- [X] T014 [P] Add contract tests for the extended `GET /billing` in `backend/tests/integration/`: all fields present; limits match the organization's `Subscription` row; `has_billing_account` false on a trial org; 403 for non-owners (Principle V)

**Checkpoint**: Timeout, shared query states, paid gate, and billing truth all in place. User stories can now proceed in parallel.

---

## Phase 3: User Story 1 — Core loop a trader can trust (Priority: P1) 🎯 MVP

**Goal**: Signup → party → PO → partial dispatch → remaining balance works through the UI every time, and no core-loop screen can hang.

**Independent Test**: Perform the full loop in a browser against a clean organization and confirm remaining balance agrees with dispatch records on the dashboard, party detail, and order detail. Delivers the complete demonstrable product alone.

### Tests for User Story 1

- [X] T015 [P] [US1] Write the core-loop end-to-end test in `frontend/tests/e2e/core-loop.spec.ts` (Playwright, already configured via `npm run test:e2e`): signup with organization name → create party → create PO ordered 100 → dispatch 30 → assert Dispatched 30 / Remaining 70 without reload → assert dashboard totals agree. This is the SC-002 vehicle and the Principle XIII gate
- [X] T016 [P] [US1] Write failure-state tests in `frontend/tests/` for party detail and purchase order detail: with the query failing, the screen renders an error and a retry, and the strings "Loading party…" and "Loading purchase order…" are absent. These must FAIL before T017–T018
- [X] T017 [P] [US1] Write a stalled-request test asserting a core-loop screen reaches a terminal error state within the SC-005 budget when the request never settles — the case a screen can still fail after `isError` is handled

### Implementation for User Story 1

- [X] T018 [US1] Replace `if (isLoading || !data)` at `frontend/src/pages/parties/PartyDetail.tsx:35` with `QueryState`, removing the "Loading party…" header named in the constitution
- [X] T019 [US1] Replace `if (isLoading || !data)` at `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx:82` with `QueryState`, removing "Loading purchase order…"
- [X] T020 [P] [US1] Adopt `QueryState` in `frontend/src/pages/dashboard/Dashboard.tsx`, with an empty state naming the next action when the organization has no POs (FR-025)
- [X] T021 [P] [US1] Adopt `QueryState` in `frontend/src/pages/parties/PartiesList.tsx`, with a "Create first party" empty state (FR-030)
- [X] T022 [P] [US1] Adopt `QueryState` in `frontend/src/pages/purchase-orders/PurchaseOrdersList.tsx`, with an empty state naming the next action
- [X] T023 [US1] Adopt `QueryState` in `frontend/src/pages/purchase-orders/PurchaseOrderForm.tsx` so a failed party-dropdown fetch surfaces an error rather than an empty dropdown that reads as "no parties exist" (FR-019)
- [X] T024 [US1] Adopt `QueryState` in `frontend/src/components/AppShell.tsx`: a failed shell bootstrap currently degrades every screen inside it (FR-016)
- [X] T025 [US1] Verify the shell populates organization name, role, and email from the server's account representation (FR-016)
- [X] T026 [US1] Verify signup submits every field the server requires including `organization_name`, and that a valid submission cannot fail for a reason the user cannot see or correct (FR-014) — `backend/src/api/auth.py:41` is the server side
- [X] T027 [US1] Verify successful signup establishes the session and lands on onboarding or the dashboard (FR-015)
- [X] T028 [US1] Verify logout clears the session completely — no authenticated route reachable, and no `orderflow_tokens` left in `localStorage` (FR-017)
- [X] T029 [P] [US1] Verify creating a party opens its detail screen showing the saved party (FR-018), and creating a PO with the party selector works and shows Ordered / Dispatched / Remaining (FR-019, FR-020)
- [X] T030 [US1] Verify a recorded dispatch updates displayed quantities and the dispatch history without a reload (FR-021)
- [X] T031 [US1] Verify every remaining balance in the UI is derived from dispatch records, with no screen showing a figure obtained another way (FR-022, Principle II). Confirm by inspection, not by changing the domain engine — the constitution forbids rewriting it without a proven bug
- [X] T032 [US1] Verify the over-dispatch path still warns and requires explicit confirmation (FR-023), including the boundary case where the dispatch exactly equals remaining, which must NOT warn and must drive remaining to zero

**Checkpoint**: The product is demonstrable to a beta user. US1 alone is a viable MVP.

---

## Phase 4: User Story 2 — No reachable paid path (Priority: P1)

**Goal**: One commercial action exists — start or continue a free trial. Nothing invites a user toward a purchase that cannot complete.

**Independent Test**: Walk landing, nav, pricing, billing, and footers as both an anonymous visitor and a trial user; confirm no reachable control initiates checkout or a billing portal session, including by direct request.

**Why P1 alongside US1**: Independent of the core loop and the cheapest risk reduction in the feature — it removes surface rather than adding it.

### Tests for User Story 2

- [X] T033 [P] [US2] Contract tests for `GET /plans` in `backend/tests/integration/`: with the flag off, `plans == []` and `paid_plans_enabled == false`; with it on, three tiers with prices and limits from `PLAN_LIMITS` (`contracts/public-plans.md`)
- [X] T034 [P] [US2] Contract tests asserting `POST /billing/checkout-session` and `POST /billing/portal-session` both return 403 when the flag is off — **and that no Stripe call is attempted even when `stripe_secret_key` is set**, proving the gate precedes the vendor call
- [X] T035 [P] [US2] Test that every refusal message contains no environment variable name, no vendor name, and no "upgrade" instruction (FR-013, FR-031)

### Implementation for User Story 2

- [X] T036 [US2] Change `GET /plans` in `backend/src/api/plans.py` to return the object shape in `contracts/public-plans.md` — `{paid_plans_enabled, trial_length_days, plans}` — with `plans` empty whenever the flag is false. This is a deliberate breaking change to a public endpoint; its only consumer is the Pricing page, rewritten in T038
- [X] T037 [US2] Gate `POST /billing/checkout-session` and `POST /billing/portal-session` in `backend/src/api/billing.py` behind `paid_plans_enabled`, refusing with 403 **before** the existing `stripe_secret_key` check at line 40. FR-003 forbids a *reachable* checkout, so hiding the button is not sufficient
- [X] T038 [US2] Rewrite `frontend/src/pages/marketing/Pricing.tsx`: remove the three tier cards at lines 52–63 and render the single trial message — trial length, no credit card required, paid plans coming soon (FR-002, FR-010). Preserve the `formatLimit` "unlimited" sentinel handling if any Pro limit can still surface elsewhere
- [X] T039 [US2] Remove the "Choose starter/business/pro" buttons and the `upgrade()` function from `frontend/src/pages/billing/Billing.tsx:107-113,32-38`, including the string "Stripe is not configured on this deployment yet. Set STRIPE_SECRET_KEY and price IDs on the backend." — developer-facing copy currently shown to end users
- [X] T040 [US2] Remove the "Manage billing" control and `openPortal()` from `frontend/src/pages/billing/Billing.tsx:100-102,40-47` when `has_billing_account` is false. A trial organization never has a Stripe customer, so this can never succeed for the beta audience (FR-007)
- [X] T041 [US2] Rewrite the read-only lockout banner at `frontend/src/pages/billing/Billing.tsx:85`: it currently says "upgrade to resume creating and editing records", instructing an action FR-006 forbids. State the condition and that existing data remains readable
- [X] T042 [US2] Adopt `QueryState` in the surviving `Billing.tsx` trial card, replacing `isLoading || !data` at line 59 while preserving the existing owner-only 403 `AccessDenied` path at line 50 (Principle V)
- [X] T043 [US2] Replace the hardcoded "14-day free trial" at `frontend/src/pages/marketing/Landing.tsx:107` with the server-reported trial length (FR-011). **The landing CTAs themselves already pass** — lines 80, 97, and 179 are all "Start free trial" → `/signup` with no Buy or Subscribe, so your T1.2 needs no CTA work
- [X] T044 [US2] Replace both hardcoded "14-day" strings in `frontend/src/pages/marketing/Pricing.tsx` (the `usePageMeta` description and the footnote) with the value from `GET /plans` (FR-011)

**Checkpoint**: Zero reachable paid paths, verified from the UI and by direct request.

---

## Phase 5: User Story 3 — Displayed limits match enforced limits (Priority: P2)

**Goal**: The number a user is shown is the number that stops them, with a message explaining what happened.

**Independent Test**: Read the limits in the UI, then create users and POs up to and past them; the blocking point and the message match what was displayed.

### Tests for User Story 3

- [X] T045 [P] [US3] Integration test in `backend/tests/integration/`: invite past `max_users` returns 403, the message names the limit and its number, contains no "upgrade", and the member is **not** created (FR-012)
- [X] T046 [P] [US3] Integration test: create past `max_active_pos` returns 403 with the same properties, and the order is not created
- [X] T047 [P] [US3] Test that `current_users` / `current_active_pos` from `GET /billing` equal the counts enforcement uses, by creating records up to the limit and comparing the displayed count to the blocking point
- [X] T048 [P] [US3] Test the trial-length coupling (SC-004a): overriding `trial_length_days` changes both the `GET /plans` response and the length granted at signup, and leaves existing organizations' `trial_ends_at` untouched

### Implementation for User Story 3

- [X] T049 [US3] Reword the limit refusals in `backend/src/services/billing.py:41,52`: drop "Upgrade to add more users." / "Upgrade to add more." and state what the trial includes instead — e.g. "User limit reached — your trial includes 3 users." The number MUST be interpolated from the `Subscription` row, not written into the string (FR-008, FR-013)
- [X] T050 [US3] Settle limit refusals on **403** (your board said "403/422"; `contracts/billing-info.md` picks one so the frontend has a single path). `describeApiError` already returns a string `detail` verbatim for sub-500 statuses, so the message reaches the user once the text is right
- [X] T051 [US3] Surface the server's refusal message in the UI on PO create and member invite, rather than a generic fallback (FR-013)
- [X] T052 [US3] Point the Billing limits display at `useTrialInfo` so the figures come from `GET /billing` for that organization (FR-008). `Billing.tsx:98` already complies — this preserves that through the T038–T042 rewrite
- [X] T053 [US3] Make `backend/src/scripts/seed.py:50` read `settings.trial_length_days` instead of its independent hardcoded `timedelta(days=14)`, so seeded and signed-up organizations cannot disagree (FR-011a)
- [X] T054 [US3] Confirm no surface presents paid tier limits as available entitlements while the tiers cannot be purchased, while **leaving enforcement intact** for any organization placed on a paid tier (FR-010; `data-model.md` invariant)

**Checkpoint**: Every displayed limit is the enforced limit; one setting governs trial length everywhere.

---

## Phase 6: User Story 4 — Nothing loads forever (Priority: P2)

**Goal**: Extend the three-terminal-state contract to every remaining data-backed screen, beyond the core loop.

**Independent Test**: Exercise each remaining screen under request failure, server error, and a stalled request; each reaches a terminal state with a usable retry.

**Depends on**: Phase 2 (`QueryState`, timeout). Phase 4 must precede the Billing entry here, so that screen is not repaired and then rewritten.

### Tests for User Story 4

- [X] T055 [P] [US4] Failure-state tests in `frontend/tests/` for each module adopted in T057–T061
- [X] T056 [P] [US4] Mobile-width rendering tests for the error and empty states at a phone viewport (Principle VIII, gated in the plan's Constitution Check)

### Implementation for User Story 4

- [X] T057 [P] [US4] Adopt `QueryState` in `frontend/src/pages/audit/AuditLog.tsx`
- [X] T058 [P] [US4] Adopt `QueryState` in `frontend/src/pages/reports/Reports.tsx`
- [X] T059 [P] [US4] Adopt `QueryState` in `frontend/src/pages/settings/CompanySettings.tsx`
- [X] T060 [P] [US4] Adopt `QueryState` in `frontend/src/components/Notifications.tsx`
- [X] T061 [P] [US4] Adopt `QueryState` in `frontend/src/pages/admin/SuperAdmin.tsx`
- [X] T062 [US4] Reconcile `frontend/src/pages/settings/TeamMembers.tsx` with `QueryState` — it is the only module that already handles an error state and is the reference pattern; converge it rather than leaving two conventions
- [X] T063 [US4] Audit every remaining `useQuery` call site for the `isLoading || !data` shape and confirm none survives (FR-027). 15 modules call `useQuery`; all must be accounted for
- [X] T064 [US4] Confirm every list and detail screen renders an empty state naming a next action when a request succeeds with zero records (FR-030)

**Checkpoint**: No screen in the application can be left in a loading state.

---

## Phase 7: User Story 5 — The beta bar is honest (Priority: P3)

**Goal**: Team, Reports, Audit Log, and Onboarding each either work or are not offered. No control looks functional and is not.

**Independent Test**: Exercise all four areas as an owner; every visible control either completes its action or is absent.

**Scope note**: Invitation issuance, invitation acceptance, and all three export formats already exist ([research R7](./research.md)). This phase verifies them and fixes two real defects.

### Tests for User Story 5

- [X] T065 [P] [US5] Verify the API routes the Team and Reports pages call actually exist and respond — no 404s were found during the survey, so this confirms rather than repairs (your T4.1)
- [X] T066 [P] [US5] Integration test for invitation re-use and tampering: an expired, already-used, or invalid invite is refused with an understandable message (FR-035) — `backend/src/api/auth.py:155` is the existing guard
- [X] T067 [P] [US5] Integration test for the sole-owner guard covering **both** removal and self-demotion (FR-036). A removal-only guard can be bypassed by demoting the last owner — a gap the spec flagged as an edge case
- [X] T068 [P] [US5] Test that an export receiving a 403 or 500 shows an error and downloads **no** file, and that a network failure during export produces a message rather than an unhandled rejection

### Implementation for User Story 5

- [X] T069 [US5] Verify the member list shows each member's role and invitation status (FR-032), and that an invite creates a clearly pending member (FR-033). With `smtp_host` empty by default (`backend/src/core/config.py:21`) no email is delivered, so this visible status is the entire mechanism — your board's "else pending state" is the default-deployment reality, not the fallback
- [X] T070 [US5] Verify accepting a valid invitation grants access with the invited role and updates the member's status (FR-034)
- [X] T071 [US5] Extend the sole-owner guard in `backend/src/api/org.py` to cover self-demotion as well as self-removal (FR-036)
- [X] T072 [US5] Verify remaining-balance-by-party is visible in `frontend/src/pages/reports/Reports.tsx` (FR-037)
- [X] T073 [US5] Add a `resp.ok` check and a `catch` to `exportReport` in `frontend/src/pages/reports/Reports.tsx:34-50`. It currently hands a 403 or 500 response body to `URL.createObjectURL`, downloading a JSON error as `report.csv`, and has only a `finally` so failures produce an unhandled rejection with no user feedback (FR-031, FR-039). **CSV already works** — this is the actual defect behind your T4.5
- [X] T074 [US5] Keep all three export formats offered. CSV, XLSX, and PDF all work server-side (`backend/src/api/reports.py:172-220`) and the frontend already streams blobs for each, so **nothing needs hiding** under FR-039 — your T4.6 has no work to do beyond T073
- [X] T075 [US5] Verify exporting a report with zero rows produces a valid empty file or a clear message, not a corrupt download (spec edge case)
- [X] T076 [US5] Verify the audit log lists recent creates and updates for parties, POs, and dispatches (FR-040)
- [X] T077 [US5] Verify the audit log shows a readable empty state on a fresh organization (FR-041)
- [X] T078 [US5] Verify onboarding steps describe capabilities that exist (FR-042), the primary action leads to creating a party, and skip leads to the dashboard (FR-043). Sample-data loading is **out of scope** — deferred per `spec.md` Assumptions

**Checkpoint**: Nothing in the beta surface is visible but non-functional.

---

## Phase 8: User Story 6 — Legitimate to a stranger (Priority: P3)

**Goal**: Legal documents are reachable from everywhere they are expected, and public pages present correctly when found or shared.

**Independent Test**: Locate both legal documents from each required surface and inspect public page metadata.

- [ ] T079 [P] [US6] Verify Privacy and Terms are both reachable from signup, pricing, billing, and page footers (FR-044). Billing's links at lines 115–125 sit inside the "Upgrading is subject to…" paragraph removed by T039 — **re-attach them** or the surface loses its legal links
- [ ] T080 [P] [US6] Review both documents in `frontend/src/pages/legal/` for internal consistency, including any Stripe or paid-plan references that no longer reflect a trial-only product (FR-045)
- [ ] T081 [US6] Replace the placeholder contact address where a real one exists — `email_from` defaults to `no-reply@orderflow.example` at `backend/src/core/config.py:20` (FR-045)
- [ ] T082 [P] [US6] Verify title, description, social preview, and site icon on every public page (FR-046)
- [ ] T083 [P] [US6] Confirm `usePageMeta` still yields a distinct title per public page after the Pricing rewrite in T038
- [ ] T084 [US6] Verify the expired-trial state communicates clearly and does not instruct an upgrade (spec edge case; pairs with T041), and that existing data remains readable

**Checkpoint**: The product reads as legitimate to a first-time evaluator.

---

## Phase 9: Polish, Smoke Gate & Launch

**Purpose**: Make the release gate real, then ship. Your board's T0.3 and T5.x.

- [ ] T085 Correct the two items in `docs/SMOKE_CHECKLIST.md` that now contradict this feature: lines 40–42 require "a clear **upgrade** message" on limit rejection (must become a message naming the limit with no upgrade instruction, FR-013), and lines 46–47 require `/pricing` numbers to match `GET /plans` (must become: `/pricing` shows the trial message only and `GET /plans` returns no paid tiers while the flag is off)
- [ ] T086 Add the four missing cases to `docs/SMOKE_CHECKLIST.md`: the stalled-request case, the trial-length coupling, the failed-export case, and the expired-trial copy (see `quickstart.md`)
- [ ] T087 [P] Cross-check `docs/api-examples.md` for the `GET /plans` shape change from T036 and the `GET /billing` additions from T011 — frozen API examples that no longer match are a truth problem under Principle XI
- [ ] T088 Run the full verification suite: `pytest` in `backend/`; `npm run test -- --run`, `npm run build`, and `npm run test:e2e` in `frontend/`
- [ ] T089 Run all seven scenarios in [quickstart.md](./quickstart.md) against a real deployment, in a browser. Principle X rejects an API-level pass as evidence for the core loop
- [ ] T090 Execute the core-loop e2e run 10 consecutive times on clean organizations to satisfy SC-002
- [ ] T091 Repeat quickstart Scenarios 1, 3, and 5 at a phone viewport (Principle VIII)
- [ ] T092 Walk the corrected `docs/SMOKE_CHECKLIST.md` manually against production (your T5.1)
- [ ] T093 Write a short "Known limitations" note for beta users stating that paid plans are not open yet (your T5.3). `docs/` already holds a launch-limitations note from commit `0f4df3b` — update it rather than adding a second
- [ ] T094 Tag the release `v0.2.0-trial-beta` — **only after T088–T092 all pass**. Principle XIII: if smoke fails, the build is not announced regardless of what else is ready (your T5.4)
- [ ] T095 Invite the first real trial users (your T5.5). **Outward-facing and irreversible — confirm with the product owner before sending.** Gated on T094

**Checkpoint**: Gate passed, release tagged, beta users invited.

---

## Out of Scope — Later Kit

Recorded for traceability. Blocked by constitution Principle XIV until the P0 gate
(Phases 2–5 here) passes. Do not start:

- Stripe checkout and webhooks
- Enabling `PAID_PLANS_ENABLED`
- Aligning paid plan cards with enforced limits
- Customer portal

Note that Principle XIV's `TODO(P0_DEFINITION)` still has no authoritative
checklist. **Phases 2–5 of this file are the natural candidate** — if you agree,
amend the constitution to link here, so the gate becomes objectively testable
rather than a judgement call.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup** — no dependencies
- **Phase 2 Foundational** — depends on Setup; **blocks every user story**
- **Phase 3 US1 (P1)** — depends on Phase 2; independent of all other stories
- **Phase 4 US2 (P1)** — depends on Phase 2; independent of US1
- **Phase 5 US3 (P2)** — depends on Phase 2 (T011–T013); best after US2, which rewrites the Billing screen it displays into
- **Phase 6 US4 (P2)** — depends on Phase 2; **T042 in Phase 4 must precede** the Billing entry, so that screen is not repaired then rewritten
- **Phase 7 US5 (P3)** — depends on Phase 2
- **Phase 8 US6 (P3)** — depends on Phase 4 (T079 re-attaches links T039 removes)
- **Phase 9** — depends on every story you intend to ship

### The one ordering trap

Phase 4 (US2) deletes the Pricing and Billing paid surfaces. Both screens also
appear on the error-state repair list. Doing US2 **before** touching those two
files avoids repairing code about to be deleted — which is why `Pricing.tsx` is
absent from Phase 6 entirely and `Billing.tsx` appears there only as T042, inside
Phase 4.

### Parallel opportunities

- T002, T003 together
- T008, T010, T013, T014 together (after T004–T007)
- T015, T016, T017 together — all US1 tests
- T020, T021, T022 together — different page files
- T033, T034, T035 together — all US2 contract tests
- T045, T046, T047, T048 together — all US3 integration tests
- T057–T061 together — five independent page files
- T079, T080, T082, T083 together
- **Whole stories in parallel**: once Phase 2 closes, US1 / US2 / US5 / US6 touch disjoint files. US3 and US4 both touch Billing, so they serialise against Phase 4.

Per the project's concurrency rules, give each writing agent an isolated worktree
and non-overlapping file ownership; `apiClient.ts`, `Billing.tsx`, and
`docs/SMOKE_CHECKLIST.md` are the three contested files.

---

## Implementation Strategy

### MVP

**US1 alone** is a viable MVP: the core loop demonstrable to a beta user. Phase 1 →
Phase 2 → Phase 3, then stop and validate.

In practice ship **US1 + US2 together**. Both are P1, US2 is roughly half a day
because the landing page already passes and the work is deletion, and shipping a
reliable core loop while broken upgrade buttons remain would satisfy Principle X
and violate Principle IX in the same release.

### Incremental delivery

1. Phases 1–2 → foundation (the two root causes fixed)
2. + Phase 3 (US1) → **MVP**, demonstrable
3. + Phase 4 (US2) → **beta-invitable**; P0 complete per your rules
4. + Phases 5–6 (US3, US4) → honest limits, nothing hangs anywhere
5. + Phases 7–8 (US5, US6) → ready for wider trial traffic
6. + Phase 9 → gate, tag, invite

### Your P0/P1 rule, mapped

- **P0 blocks beta invites** → Phases 1–5 (your T1.x, T2.x, T3.x). T095 is gated on them.
- **P1 before wide traffic** → Phases 6–8.
- **Paid work stays future** → the Out of Scope section; nothing in Phases 1–9 wires checkout.

---

## Notes

- 95 tasks. Effort revised against the kit in four places, each traced in the mapping table above.
- Commit after each task or logical group. Do not add a `Co-Authored-By` trailer unless `.claude/settings.json` sets `attribution.commit` (project rule).
- Three tasks (T003, T065, T074) are verification-only — they exist because the survey found the capability already present and the kit assumed otherwise. Confirm rather than build.
- T095 is the only outward-facing, irreversible task. It needs explicit human go-ahead.
