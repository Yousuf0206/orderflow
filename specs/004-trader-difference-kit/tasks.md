---

description: "Task list for the Trader Difference Kit"
---

# Tasks: Trader Difference Kit

**Input**: Design documents from `/specs/004-trader-difference-kit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks ARE included. The specification requires them: FR-011 demands the phone
measurements be automated "so it cannot silently lapse", SC-001 is an exhaustive claim about a
Viewer's screens that only a test can hold, and `contracts/list-filters.md` requires a
`compute_many` parity assertion because it guards a figure Principle II calls sacred.

**Organization**: grouped by user story. Each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6 per spec.md
- Exact file paths are given in every task

## Path Conventions

Web app, two services: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

---

## Mapping from the Supplied Sprint Board

Your board is reproduced here with its disposition, so nothing looks quietly dropped. **18 of your
31 items are already shipped** — they were delivered by `002-market-ready-trial` and
`003-landing-page-upgrade`. Re-listing them as work would produce tasks that close themselves.

| Your item | Disposition |
| --- | --- |
| T0.1 Freeze scorecard priorities | Done by this document; order is set by R2, not by the board |
| T0.2 Seed demo org for screenshots | **Shipped** (`seed_landing_demo.py`). Re-run only if US2 changes the captured screens — and only against a local database (R1) → T046 |
| T0.3 Smoke checklist updated for mobile viewport | → **T003** |
| T1.1 Capture screenshots | **Shipped** (17 assets in `frontend/src/assets/landing/`). Conditional re-capture → T046 |
| T1.2 Hero with product image + trial CTA | **Shipped** (`Hero.tsx`) |
| T1.3 Proof strip + problem/outcome | **Shipped** (`ProofStrip.tsx`, `ProblemOutcome.tsx`) |
| T1.4 Three feature blocks with crops | **Shipped** (`FeatureBlock.tsx`) |
| T1.5 How it works + final CTA + footer | **Shipped** (`HowItWorks.tsx`, `FinalCta.tsx`, `SiteFooter.tsx`) |
| T1.6 Mobile landing layout | **Shipped** (`mobile-viewport.spec.ts` covers 320–430px) |
| T1.7 Deploy + 10-second impression test | **Outstanding from 003**, not this feature: T043/T044 of `003/tasks.md` |
| T2.1 Responsive app shell / nav | **Partly shipped** (drawer exists); touch targets fail → T016 |
| T2.2 PO list usable on mobile | → T018 |
| T2.3 PO detail + dispatch form touch-optimized | → T017 |
| T2.4 Numeric qty input; full-width Add Dispatch | Numeric input **shipped** (`PurchaseOrderDetail.tsx:179`); full-width → T019 |
| T2.5 Remaining updates without desktop dependency | **Shipped**; asserted by T014 |
| T2.6 PWA manifest + icons | → T040–T043 (US6) |
| T2.7 Real-device test | → **T022** (manual, non-automatable — R13) |
| T3.1 PO filters: status, party, search | → T025–T029. Status **shipped**; `party_id` already exists server-side |
| T3.2 Dashboard overdue → filtered list | → T030 |
| T3.3 Party detail: export remaining CSV | → T033–T036 |
| T3.4 Optional printable party summary | → T036 (PDF, not a print stylesheet — R8) |
| T3.5 Reports remaining-by-party CSV verified | → T037 (regression check after the writer extraction) |
| T3.6 Remove/disable non-working export formats | **No-op**: CSV, XLSX and PDF are all genuinely implemented (`reports.py:184-221`). Nothing to hide. Verified by T037 |
| T4.1 Invite member end-to-end / copy-link fallback | → T038–T039b (US5) |
| T4.2 Accept-invite page | **Shipped** (`AcceptInvite.tsx`); error-message split → T039c |
| T4.3 Role gates on dispatch create / settings | → T006–T013 (US1), promoted to first |
| T4.4 Pricing page: no blank cards; trial-first | **Shipped** (`002`) |
| T4.5 Billing page: real limits; paid CTAs hidden | **Shipped** (`002`) |
| T5.1 Consistent overdue / due soon badges | → T044 |
| T5.2 Kill infinite loading states | **Shipped** (`002`, `QueryState`) |
| T5.3 Empty states with one clear CTA | **Shipped** (`002`, `EmptyState`) |
| T5.4 Trial limit error copy when capped | **Shipped** (`002`) |
| T6.1 Full smoke desktop + mobile | → T047 |
| T6.2 Landing vs wireframe checklist | → T046 (conditional) |
| T6.3 Export files open in Excel / Sheets | → T048 |
| T6.4 Tag `v0.3.0-difference` | → T049 |
| T6.5 Invite beta users with the new pitch | → T050 (gated on T047 passing) |

---

## Phase 1: Setup

**Purpose**: make it safe to run this feature's work at all.

- [ ] T001 **BLOCKED — needs the user.** Point `backend/.env` `DATABASE_URL` at a local Postgres. Verified still remote on 2026-10-09: `/health` reports `aws-0-ap-northeast-2.pooler.supabase.com`. Not changed by this implementation — `.env` is a secrets file this agent cannot read (it is in `permissions.deny`), so it cannot be edited without discarding whatever else it holds. A local Postgres **is** listening on `localhost:5432`, so this is one line away once someone who can read the file makes the change.
- [X] T002 Added `frontend/tests/e2e/globalSetup.ts`, wired via `globalSetup` in `frontend/playwright.config.ts`, which aborts the run unless the backend reports a local database host. `GET /health` in `backend/src/main.py` now returns `database_host` (hostname only — never user, password or database name) so the check has something to read. **Verified refusing**: run against the current configuration, the suite stopped with "the backend's database host is "aws-0-ap-northeast-2.pooler.supabase.com", which is not local". Override with `ORDERFLOW_E2E_ALLOW_REMOTE_DB=1`.
- [X] T003 [P] The phone-viewport pass is in `quickstart.md` under "Whole-feature gate", matching the constitution's "Phone dispatch evidence" gate (board T0.3)

**Checkpoint**: ✅ the e2e suite can no longer write to production — it now refuses. T001 remains open, so the suite cannot be *run* either until the database is pointed somewhere local; that is the correct failure mode rather than the previous silent success.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the batched aggregate from research R3. **This blocks US3 and US4** and fixes a latent
defect affecting the dashboard today.

**⚠️ Why this is first**: `backend/src/api/purchase_orders.py:63` calls `_to_out` per row, which
calls `compute`, which issues one `SELECT coalesce(sum(qty), 0)` per purchase order
(`po_calc.py:28`). `dashboard.py:28` does the same. At the 180 orders SC-005 names, against the
configured hosted database at roughly 300 ms a round trip, the list costs about 54 seconds —
past the 12 s client deadline in `frontend/src/services/apiClient.ts:51`. Filters built on this
pattern would let a user narrow 180 rows to 3 and still wait the full 54 seconds, so SC-005 would
fail on the day it shipped.

- [X] T004 Add `compute_many(db, pos) -> dict[str, PoCalc]` to `backend/src/services/po_calc.py`, computing dispatched totals for all given purchase orders with a single grouped aggregate over non-deleted dispatches, and reimplement `total_dispatched`/`compute` in terms of the same aggregate so one definition of `status` remains (R4). Do NOT add a stored `total_dispatched` or `remaining_balance` column — Principle II forbids a balance that can drift from its dispatch rows, and `contracts/list-filters.md` records this as a forbidden fix
- [X] T005 Add a parity unit test in `backend/tests/unit/test_po_calc_batch.py` asserting `compute_many(db, pos)[po.id] == compute(db, po)` for every order across a fixture covering: zero dispatches, partial dispatches, exactly-fully dispatched, over-dispatched, soft-deleted dispatches excluded, and an order due today — the boundary between `due_soon` and `overdue`
- [X] T005a Adopted `compute_many` in `list_purchase_orders`, `get_dashboard`, both `reports.py` row builders, and also `get_party` in `backend/src/api/parties.py` — which had the same per-row loop and was not in the original task list
- [X] T005b Query-count assertion landed in `backend/tests/unit/test_po_calc_batch.py::test_batch_issues_one_aggregate_regardless_of_order_count` rather than a separate integration file: it counts the dispatch aggregate via a SQLAlchemy `before_cursor_execute` listener and asserts one statement for 7 orders and one for 2. **Note on the first attempt**: counting *all* statements gave 8 for 7 orders, because the fixture's `commit()` expired the objects and attribute access reloaded them — an artefact of the fixture, not of `compute_many`. The assertion now counts only the dispatch aggregate, which is the claim that matters.

**Checkpoint**: ✅ the list, dashboard, party screen and reports are O(1) in aggregate queries. 11 unit tests cover the parity, including no-dispatch, soft-deleted-only, over-dispatched, and due-today boundary cases.

---

## Phase 3: User Story 1 — A Viewer is never offered an action they cannot complete (Priority: P1) 🎯 MVP

**Goal**: the interface stops showing controls the server will refuse. A Viewer sees an explanation
where the dispatch form was, not a form that fails.

**Independent Test**: sign in as each of the four roles against one seeded organization; every
control in `contracts/permissions.md` is present or absent as specified, and no visible control
produces a refusal when pressed.

**Why first** (R2): this is not a missing capability, it is a live defect.
`frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx` has no role check at all, while
`backend/src/api/dispatches.py:31` restricts recording to `owner`, `manager`, `staff`. Every Viewer
fills in the form and is refused, with nothing wrong with what they typed.

### Tests for User Story 1

- [X] T006 [P] [US1] Unit test the capability table in `frontend/tests/unit/permissions.test.ts`, asserting each of `canRecordDispatch`, `canEditDispatch`, `canManageOrders`, `canManageParties`, `canManageTeam`, `canManageBilling` for all four roles exactly as `contracts/permissions.md` tabulates them, plus the unknown-role case returning neither permitted nor forbidden
- [~] T007 [P] [US1] `frontend/tests/e2e/roles.spec.ts` written — three tests driving real roles through the actual invitation flow rather than stubbing `/auth/me`, so the check is that the interface and the server agree. **Not executed**: blocked by T001 (the e2e guard correctly refuses the production database). Companion coverage that *does* run: `frontend/tests/unit/roleGatedControls.test.tsx`, 5 tests, all passing, covering viewer / staff / owner / unknown-role and that a Viewer still sees the figures.

### Implementation for User Story 1

- [X] T008 [US1] Create `frontend/src/hooks/usePermissions.ts` deriving the six named capabilities from the role on `/auth/me`, returning a distinct `unknown` state when the query has not resolved or has failed — it MUST NOT default to permissive (FR-004); `AppShell.tsx:176` already treats a failed `/auth/me` as a banner rather than a page error, and that judgement extends here
- [X] T009 [US1] Gate the dispatch form in `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx` on `canRecordDispatch`, replacing it with a line stating that recording dispatches needs Staff access or above (FR-002) — an empty space where the form belongs reads as a broken page
- [X] T010 [US1] **No-op, verified.** `PurchaseOrderDetail.tsx` renders no edit or delete control on dispatch history rows — there was nothing to gate. `canEditDispatch` exists in the capability table and is asserted in `permissions.test.ts`, so the Staff-may-record-but-not-amend asymmetry is captured for whoever adds those controls later.
- [X] T011 [P] [US1] Gated `PurchaseOrdersList.tsx` and `PartiesList.tsx` (both the header action and the empty-state action). **Also gated the forms themselves** — `PurchaseOrderForm.tsx` and `PartyForm.tsx` — which the task did not call out but which are reachable by a typed or bookmarked URL. A form that submits into a refusal is the defect, not a milder version of it.
- [X] T012 [US1] Replaced the inline role literals in `AppShell.tsx` with `usePermissions`
- [X] T013 [US1] `PermissionsUnconfirmed` (in the new `components/ui/RoleNotice.tsx`) renders on the purchase order detail screen and on both create forms. The hook returns a distinct `unknown` state and never falls back to permissive. A Super Admin, who legitimately has no role, is treated as known rather than unconfirmed.

**Checkpoint**: ✅ at unit level. SC-001's exhaustive claim across every screen awaits the e2e run (T007/T001).

---

## Phase 4: User Story 2 — Recording a dispatch on a phone is comfortable (Priority: P1)

**Goal**: every control on the dispatch path is big enough to hit, the primary action spans the
screen, and nothing needs a sideways swipe.

**Independent Test**: at 320/360/390/430px, measure every control on the dispatch path and the
horizontal scroll extent; then record a dispatch on a real phone.

**Why this closes a known gap**: the v1.3.0 amendment recorded Principle XXII as unproven on exactly
the 44px and keyboard clauses, because nothing asserted them.

### Tests for User Story 2

- [X] T014 [US2] Extend `frontend/tests/e2e/mobile-viewport.spec.ts` with, for each of 320, 360, 390 and 430px: a `boundingBox()` assertion that every interactive control on the dispatch path measures at least 44Ã—44 CSS pixels (FR-006), an assertion that `document.scrollWidth <= document.clientWidth` (FR-007), and an assertion that the dispatch form's primary action spans the form's content width at 390px (FR-009)
- [~] T015 [US2] **Not executed** — blocked by T001, same as T007. The baseline was instead established by reading: `AppShell.tsx` lines 138 and 158 were `h-9 w-9` (36px), `Button.tsx` was `min-h-[2.5rem]` (40px), `Field.tsx` was `min-h-[2.5rem]` (40px), `ThemeToggle.tsx` and `Notifications.tsx` were `h-9 w-9`, and the "Confirm anyway" button was `min-h-[2.25rem]` (36px). All six are named in the commit, so the before-state is on record even though the failing run is not. **This is weaker evidence than the task asked for** and the first real run may still find controls these edits missed.

### Implementation for User Story 2

- [X] T016 [US2] Raise the mobile menu open and close controls in `frontend/src/components/AppShell.tsx` (lines 138 and 158, both `h-9 w-9`) to a touch target of at least 44Ã—44 CSS pixels, padding around the icon rather than enlarging the icon
- [X] T017 [US2] Raised `Field.tsx` (`min-h-11`, covering every Input and Select in the app), the "Confirm anyway" button, `ThemeToggle.tsx` and `Notifications.tsx` — the last two sit in the app-shell header and so are on the dispatch path
- [X] T018 [P] [US2] Filter controls use the shared `Select`/44px input; row links are `min-h-11`; filter chips and their clear buttons are 44px. The table keeps `min-w-[600px]` inside `Card className="overflow-x-auto"`, so the *card* scrolls rather than the document — which is what `expectNoHorizontalScroll` measures
- [X] T019 [US2] `Button` gained a `block` prop (`w-full sm:w-auto`) and its floor rose from `min-h-[2.5rem]` to `min-h-11`; used on the dispatch submit and the invite submit
- [X] T020 [US2] The submit sits last in the form's document flow; nothing on the dispatch path is pinned to the viewport bottom. The e2e test asserts `submit.y > qty.y`
- [X] T021 [US2] Confirmed `inputMode="decimal"` on both quantity fields — already satisfied, unchanged, and now asserted by an e2e test
- [ ] T022 [US2] **Manual, not automatable (R13)** — not done; needs a real device: on a real Android device and a real iPhone, record a dispatch one-handed; confirm the submit control is reachable with the keyboard open over the quantity field, and that no pinch-zoom or sideways swipe is needed. Record device, browser and outcome in this task. No automated run may close it — Playwright models width, not a thumb or a keyboard
- [ ] T023 [US2] **Not done** — needs the suite to run (T001). Time SC-002 on a phone viewport: from the purchase order screen, signed in, to the new Remaining figure, under 30 seconds. Note while measuring that a dispatch POST against the hosted database measured ~2.2 s p50 earlier in this project against a 12 s deadline — the budget is comfortable but a slow network is the realistic failure mode

**Checkpoint**: ⚠️ the proof is *written and automated* but has not yet run. Principle XXII stays
aspirational until T001 unblocks the suite — which is exactly the state the v1.3.0 amendment
recorded, now with the measuring instrument built.

---

## Phase 5: User Story 3 — Finding the right purchase order quickly (Priority: P2)

**Goal**: narrow 180 orders by party or PO number, and reach an overdue list by pressing the
dashboard figure.

**Independent Test**: seed ~180 orders across several parties and mixed statuses; filter by each
dimension and in combination; press the dashboard Overdue figure and compare its number to the row
count.

**Depends on**: Phase 2 (T004–T005b). Without the batched aggregate this story ships failing SC-005.

### Tests for User Story 3

- [X] T024 [P] [US3] Integration tests in `backend/tests/integration/test_po_filters.py`: `party_id` restricts correctly and never returns another organization's rows; `q` matches partial and case-insensitively; `q` containing `%`, `_` or the escape character is treated as literal text (R5); an unrecognised `status` yields an empty list rather than everything; all three combine with AND
- [X] T024a [P] [US3] Landed as `test_dashboard_overdue_count_equals_filtered_list_length` inside `test_po_filters.py` rather than its own file — it shares that module's fixture. Asserts `GET /dashboard`'s `overdue_count` equals the row count of `GET /purchase-orders?status=overdue` for the same seeded organization (FR-017) — the point is that a future second definition of `status` fails here instead of quietly disagreeing

### Implementation for User Story 3

- [X] T025 [US3] Add a `q` query parameter to `list_purchase_orders` in `backend/src/api/purchase_orders.py`, matching `po_number` case-insensitively on a substring, trimming input, treating empty or whitespace-only as absent, and escaping `%`, `_` and the escape character before building the pattern (R5)
- [X] T026 [US3] Make an unrecognised `status` value return an empty list in `backend/src/api/purchase_orders.py` rather than being ignored — silently returning everything makes the filter lie (`contracts/list-filters.md`)
- [X] T027 [US3] Move filter state in `frontend/src/pages/purchase-orders/PurchaseOrdersList.tsx` from `useState` (line 27) to `useSearchParams`, holding `status`, `party_id` and `q` in the URL (R6) — this is what makes FR-015 and FR-017 fall out rather than needing their own mechanisms
- [X] T028 [US3] Add a party filter to `frontend/src/pages/purchase-orders/PurchaseOrdersList.tsx`, sourcing the options from `GET /parties`; the `party_id` server parameter already exists (`purchase_orders.py:47`) and needs no backend work
- [X] T029 [US3] Add a PO-number search control to `frontend/src/pages/purchase-orders/PurchaseOrdersList.tsx`, debounced, with the active filters visible and each independently clearable (FR-014, FR-015)
- [X] T030 [US3] Make the Overdue `StatCard` in `frontend/src/pages/dashboard/Dashboard.tsx:123` a link to `/purchase-orders?status=overdue`, and NOT a link when the count is zero, so pressing it can never open an empty list presented as an error (FR-017)
- [X] T031 [US3] Extend the empty state in `frontend/src/pages/purchase-orders/PurchaseOrdersList.tsx:75` so "no matches" accounts for party and search as well as status, and never renders "No purchase orders yet" when any filter is active — that sentence means the organization is empty and reads as data loss to a trader with 180 orders (FR-016)
- [X] T032 [P] [US3] Unit test filter state in `frontend/tests/unit/poFilters.test.tsx`: URL round-trip for all three parameters, independent clearing, and the correct empty-state copy for filtered-no-match versus genuinely-empty

**Checkpoint**: SC-005 (a specific order located among 180 in under 15 seconds) and SC-006 (figure
equals row count) both hold.

---

## Phase 6: User Story 4 — Sending a party their remaining balance (Priority: P2)

**Goal**: one control on the party screen produces a file a trader can forward, with figures that
match the screen.

**Independent Test**: export a party with several open orders and one fully dispatched order; the
file contains only the open ones, the exact seven columns, and figures identical to the screen.

### Tests for User Story 4

- [X] T033 [P] [US4] Integration tests in `backend/tests/integration/test_party_export.py`: the seven columns in the order fixed by FR-019 (`party_name`, `po_number`, `material`, `ordered_qty`, `dispatched_qty`, `remaining_balance`, `due_date`); only orders with `remaining_balance > 0`; soft-deleted orders excluded; another organization's `party_id` returns 404 not 403; an unrecognised `format` returns 400 rather than falling back to CSV; a party with no open orders produces no file; one audit entry per export
- [X] T033a [P] [US4] `backend/tests/unit/test_exports.py`, 10 tests. **Deviation**: asserts the writers' *contract* — column order, comma/quote/newline escaping, empty-row handling, file magic for xlsx and PDF, filename slugification — rather than byte-identity with the pre-extraction code, which would have meant pinning a copy of the old implementation inside the test. The regression byte-identity was meant to catch is covered from the other side by `test_organization_reports_still_export_after_the_writer_extraction` in `test_party_export.py`, which downloads all three formats through the unchanged endpoints.

### Implementation for User Story 4

- [X] T034 [US4] Extract the CSV, XLSX and PDF writers from `backend/src/api/reports.py` (lines 122-221) into `backend/src/services/exports.py`, keeping `_build_pdf`'s existing `(title, org_name, fieldnames, rows) -> bytes` shape, and have `export_report` call the extracted functions. Two copies of an export writer is how a party export and an organization report begin disagreeing about a number (R7)
- [X] T035 [US4] Add `GET /parties/{party_id}/remaining/export?format=csv|xlsx|pdf` to `backend/src/api/parties.py`, selecting open orders via `compute_many` so every figure is derived from dispatch rows at export time (FR-021), scoped by organization, returning 404 for a party outside it, and writing one `log_action` entry with action `export`, entity type `party`, and the requested format (FR-025)
- [X] T036 [US4] Add "Export remaining" (CSV) and "Printable summary" (PDF) controls to `frontend/src/pages/parties/PartyDetail.tsx`, reusing the download path from `frontend/src/pages/reports/Reports.tsx:36-68` **including its `resp.ok` check before the download is built** — that check exists because a 403 body once landed in a user's downloads as a file named `report.csv` containing JSON (the comment at `Reports.tsx:47`), which is exactly what FR-023 forbids. Keep the in-flight guard so a double press yields one download. Hide or disable the controls, with a reason, when the party has no open orders (FR-024)
- [X] T037 [US4] Regression-check the three organization reports after the extraction: CSV, XLSX and PDF each download and open correctly from `frontend/src/pages/reports/Reports.tsx` (board T3.5). Note that all three formats are genuinely implemented, so board item T3.6 — hiding non-working formats — has nothing to hide; confirming that is this task's second half

**Checkpoint**: SC-007 holds, and a trader has no reason left to retype a balance into a spreadsheet
(Principle XXI).

---

## Phase 7: User Story 5 — An invitation that tells the truth (Priority: P3)

**Goal**: an owner learns whether the email actually went out, and gets a link to pass on when it
did not.

**Independent Test**: with no mail service configured, invite a colleague; the interface says no
email was sent and offers a working link; with a mail service, it says the email was sent and names
the address.

### Tests for User Story 5

- [X] T038 [P] [US5] Integration tests in `backend/tests/integration/test_invite_outcome.py` for all three outcomes: `not_configured` (no `SMTP_HOST`) returns `email_outcome: "not_configured"` with an `invitation_link` and leaves `invitation_email_sent_at` NULL; `sent` sets the timestamp; `failed` (SMTP pointed at a closed port) returns `failed`, leaves the timestamp NULL, does not raise out of the handler, and leaves the pending member and link usable (FR-029)

### Implementation for User Story 5

- [X] T039 [US5] Add `invitation_email_sent_at` to `backend/src/models/membership.py` as `Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)` — **nullable, default NULL**, per data-model.md: NULL is the honest value both for memberships predating the column and for a failed send
- [X] T039a [US5] Add the Alembic revision in `backend/src/migrations/versions/` adding that nullable column (additive, no backfill), with `down_revision` pointing at `0001_initial`
- [X] T039b [US5] Change `send_email` in `backend/src/services/email.py` to return `sent` | `not_configured` | `failed` instead of `None` — line 21 currently logs and returns early when `smtp_host` is unset, so the invitation link goes to the server log and nowhere else, and `org.py:97` ignores the result and returns 201 regardless. A `failed` outcome MUST NOT propagate as an exception out of the invitation handler
- [X] T039c [US5] Return `email_outcome` and `invitation_link` from `invite_member` in `backend/src/api/org.py`, setting `invitation_email_sent_at` **only** when the outcome is `sent`; add `invitation_email_sent_at` to `MemberOut` in `backend/src/schemas/org.py` so the team list can distinguish an emailed member from one who was not
- [X] T039d [US5] Add a resend-or-retrieve-link endpoint for a pending member in `backend/src/api/org.py` (Owner only), minting a fresh token rather than reusing a stored one — no token is stored (data-model.md) — and distinguish "already accepted" from "expired" in `accept_invite` at `backend/src/api/auth.py:155`, which currently conflates them although the remedies differ (FR-030)
- [X] T039e [US5] Update `frontend/src/pages/settings/TeamMembers.tsx` to report the outcome honestly: name the address on `sent`; on `not_configured` or `failed` state that no email went out and render the link with a copy control requiring no technical knowledge (FR-027). The link MUST NOT be logged, placed in a URL, or sent to analytics
- [X] T039f [P] [US5] Unit test the invitation messaging in `frontend/tests/unit/inviteOutcome.test.tsx`: each of the three outcomes produces its own message, and a link is offered for the two non-sent cases

**Checkpoint**: SC-008 holds — with no mail configured an owner can still get a colleague onto the
team, and is never told an email was sent when none was.

---

## Phase 8: User Story 6 — Keeping OrderFlow on the phone's home screen (Priority: P3)

**Goal**: add to home screen gives a correctly named, correctly iconed entry that opens the app.

**Independent Test**: install from mobile Safari and mobile Chrome; the entry carries the OrderFlow
name and icon and opens to a working core loop.

### Implementation for User Story 6

- [X] T040 [US6] Create `frontend/public/manifest.webmanifest` with `name: "OrderFlow"`, a short name suitable for a home screen, `start_url: "/dashboard"` (FR-032 — the app, not the landing page; existing route guards redirect an unauthenticated visitor to login), `display: "standalone"`, and theme and background colours matching `brand-600` (`#4f46e5`)
- [X] T041 [P] [US6] Add home-screen icons under `frontend/public/icons/` at 192Ã—192 and 512Ã—512 PNG plus a maskable variant, derived from the existing mark in `frontend/public/favicon.svg`
- [X] T042 [US6] Link the manifest and add a `theme-color` meta in `frontend/index.html`
- [X] T043 [US6] Confirm no service worker exists or is registered anywhere in `frontend/` — devtools → Application → Service Workers must be empty. FR-034 and Principle II forbid a cache that could serve a stale remaining balance, which is the one thing a service worker is for (R11). This task exists so a later reader does not add one as an "obvious improvement"

**Checkpoint**: SC-009 holds, and installation is additive only (FR-033).

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T044 [P] Verify status labels and colours are identical across `frontend/src/pages/dashboard/Dashboard.tsx`, `PurchaseOrdersList.tsx`, `PartyDetail.tsx` and `PurchaseOrderDetail.tsx`, all deriving from `frontend/src/components/ui/statusMeta.ts` (FR-035, board T5.1), and add a unit test comparing the rendered label and tone per status across all four surfaces rather than inspecting one
- [~] T045 **Partly run.** `pytest` **99 passed**; `npx tsc -b` clean; `npm run lint` clean; `npm run test` **79 passed** (was 51); `npm run build` succeeds. `npx playwright test` **not run** — blocked by T001.
- [ ] T046 **Condition met, work blocked — this is an open Landing-review item, not a clean pass.** T016–T019 raised the dispatch form's inputs and buttons from 40px to 44px, and that form sits on the purchase order detail screen, which is the hero screenshot's subject. The landing assets therefore probably no longer match the deployed UI, and Principle XIX treats the screenshot as the defect when the two disagree. Re-capturing needs a seeded local database, so it is blocked behind T001: re-run `npm run capture:landing` from `frontend/` **against a local database** and commit the updated assets in the same change (board T1.1/T6.2). `backend/src/scripts/seed_landing_demo.py` refuses a remote host on purpose — do not pass `--i-know-this-is-not-local`
- [ ] T047 Run the release smoke path by hand (Principle XIII): signup → party → PO → dispatch → dashboard remaining, in a browser, then the same loop at 390px width (board T6.1)
- [ ] T048 [P] Open an exported CSV and XLSX in Excel and in Google Sheets and confirm columns, numbers and dates render correctly (board T6.3) — a file that opens as one column of text is not an export
- [ ] T049 Tag `v0.3.0-difference` (board T6.4), only after T045 and T047 pass
- [ ] T050 Announce to beta users with "mobile dispatch + party export" as the pitch (board T6.5) — gated on T047, per Principle XIII: a failed smoke run blocks the announcement regardless of what else is ready
- [ ] T051 **Manual, not automatable** — SC-011: three people outside the team, each given a phone and a purchase order, record a dispatch without being told how. Record who and what happened. No command closes this

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T003)**: no dependencies. T001 and T002 must precede anything that runs a test.
- **Foundational (T004–T005b)**: depends on Setup. **Blocks US3 and US4.** Does not block US1, US2,
  US5 or US6.
- **US1 (T006–T013)**: after Setup. Independent of every other story.
- **US2 (T014–T023)**: after Setup. Independent.
- **US3 (T024–T032)**: after Foundational. Independent of US1, US2, US4–US6.
- **US4 (T033–T037)**: after Foundational (T035 uses `compute_many`). Independent otherwise.
- **US5 (T038–T039f)**: after Setup. Independent.
- **US6 (T040–T043)**: after Setup. Independent.
- **Polish (T044–T051)**: after the stories you intend to ship. T046 depends on US2. T049 and T050
  depend on T045 and T047.

### Within Each Story

Tests before implementation. T015 in particular must run and fail before T016–T019, or the phone
assertions are not testing what they claim. T039 and T039a (model and migration) precede T039b–T039f.
T034 (extraction) precedes T035 (the endpoint that uses it).

### Parallel Opportunities

- T003 runs alongside T001/T002.
- Once Setup is done, **US1, US2, US5 and US6 can proceed in parallel** — four disjoint file sets.
- US3 and US4 both wait on Foundational, then run in parallel: US3 is the list and dashboard, US4 is
  parties and reports.
- Within stories: T006 ∥ T007; T011 ∥ T012; T018 alongside T016/T017; T024 ∥ T024a; T033 ∥ T033a;
  T041 alongside T040.

---

## Parallel Example: after Setup, four stories at once

```bash
# Developer A — US1 (role-aware interface)
Task: "Unit test the capability table in frontend/tests/unit/permissions.test.ts"
Task: "Write frontend/tests/e2e/roles.spec.ts for all four roles"

# Developer B — US2 (phone comfort)
Task: "Extend frontend/tests/e2e/mobile-viewport.spec.ts with 44px and scroll assertions"

# Developer C — US5 (invitation honesty)
Task: "Integration tests for all three email outcomes in backend/tests/integration/test_invite_outcome.py"

# Developer D — US6 (manifest)
Task: "Create frontend/public/manifest.webmanifest"
Task: "Add home-screen icons under frontend/public/icons/"
```

Per the project's concurrency rules, give each writing developer an isolated worktree and a
non-overlapping file scope. Note the one real collision risk: US1 (T012) and US2 (T016) both edit
`frontend/src/components/AppShell.tsx`. Sequence those two tasks or assign both to one person.

---

## Implementation Strategy

### MVP — the two P1 stories

1. Setup (T001–T003) — do not skip T001 and T002.
2. US1 (T006–T013) — the Viewer defect.
3. US2 (T014–T023) — phone comfort, including the real-device pass.
4. T045, T046 (if needed), T047 — validate and smoke.

That is a shippable increment: it removes the product's most certain credibility loss and closes a
constitutional gate that is currently open. It needs neither the Foundational phase nor any other
story.

### Incremental Delivery

1. Setup → US1 → **ship** (a Viewer stops being misinformed)
2. US2 → **ship** (Principle XXII proven)
3. Foundational → US3 → **ship** (the list is fast and filterable; these must ship together — the
   filters without the aggregate ship a story that fails SC-005)
4. US4 → **ship** (party export)
5. US5 → **ship** (invitation honesty)
6. US6 → **ship** (home screen)

### If you would rather split the feature

The plan noted that six stories is wide. US1 and US2 are both live defects in the core loop and
stand alone cleanly as `004`; US3–US6 are new capability and would make a coherent `005`. The
Foundational phase belongs with US3, wherever US3 lands.

---

## Notes

- 51 tasks. 18 of the 31 board items were already shipped; the mapping table above records each.
- The highest-risk task is **T004**: it touches the calculation Principle II calls sacred. T005's
  parity test is the guard, and `contracts/list-filters.md` names the forbidden shortcut.
- **T022 and T051 cannot be closed by any automated run.** They are written that way deliberately —
  an automated check that appeared to cover a thumb or a stranger's first impression would be worse
  than admitting it does not.
- Commit after each task or logical group. Stop at any checkpoint to validate a story on its own.

