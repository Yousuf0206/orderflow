# Implementation Plan: Trader Difference Kit

**Branch**: `004-trader-difference-kit` (spec directory; the working git branch is `main`)
| **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-trader-difference-kit/spec.md`

## Summary

Six gaps stand between OrderFlow and the "difference" the brief describes: a Viewer is shown a
dispatch form the server will refuse, the dispatch path has never been measured on a phone, the
purchase order list cannot be narrowed by party or PO number, a party's remaining balances cannot
be shared, an invitation reports an email that may never have been sent, and the application cannot
be added to a home screen.

Phase 0 research found one thing that changes the shape of this work: **the purchase order list and
the dashboard issue one database query per purchase order.** At 180 open orders against the hosted
database that is roughly 54 seconds of round trips, so the list is already too slow for the
organization size this feature is meant to serve — and filtering makes it worse, because a derived
status filter has to compute every order before it can exclude any. Adding filters on top of that
query pattern would ship a feature that measurably fails its own success criterion. Fixing the
aggregate is therefore a prerequisite of the filter work, not an optimisation to follow it.

## Technical Context

**Language/Version**: TypeScript 5.6 (frontend), Python 3.12 (backend)

**Primary Dependencies**: Vite 5.4, React 18.3, react-router-dom 6.27, @tanstack/react-query 5,
Tailwind 3.4, lucide-react, recharts (frontend); FastAPI, SQLAlchemy, Alembic, openpyxl, reportlab
(backend). No new runtime dependency is introduced by this feature.

**Storage**: PostgreSQL. No schema change is required except one nullable column recording whether
an invitation email was dispatched.

**Testing**: Vitest (frontend unit), Playwright 1.63 (e2e, including `mobile-viewport.spec.ts` at
320/360/390/430px), pytest (backend unit and integration).

**Target Platform**: responsive web. Mobile Safari and mobile Chrome are first-class; no native
app.

**Project Type**: web application — `frontend/` + `backend/`, deployed as two Vercel services.

**Performance Goals**: purchase order list renders in under 2 seconds at 200 open orders;
dispatch recorded and new Remaining visible within 30 seconds on a phone (SC-002); a specific
order located in under 15 seconds (SC-005).

**Constraints**: no cached or stored remaining balance anywhere, including exports and any browser
cache (Principles II, XXI, FR-021, FR-034); 44×44 CSS pixel minimum touch targets on the dispatch
path; no horizontal scroll at 320–430px; existing client request deadline is 12 s with no retry, so
any new endpoint must complete well inside it.

**Scale/Scope**: 6 user stories, 35 functional requirements. Touches ~10 frontend files and ~6
backend files. Two screens gain new behaviour (purchase order list, party detail); one gains a
correctness fix (purchase order detail); two backend endpoints change shape; one new endpoint.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` **v1.3.0**.

| Principle | Gate | Verdict |
| --- | --- | --- |
| II — Remaining Balance is Sacred | No stored or cached balance | **PASS.** R3 replaces per-row SUM queries with one grouped aggregate — still computed from dispatch rows at request time, never stored. R11 adds no service worker, so no response carrying a balance can be served from a cache. |
| IV — Simplicity over Features | Core workflow not slowed | **PASS, improved.** R3 makes the list faster, not slower. No new step enters the dispatch path. |
| V — Role-Based Access | Server-side enforcement | **PASS.** US1 is additive interface work; FR-003 keeps the server the enforcer. R10 derives interface permissions from one shared table so the two cannot drift. |
| VI — Audit Everything Important | Actions logged | **PASS.** FR-025 adds an audit entry for a party export. |
| VIII / XXII — Phone equality and comfort | Phone-viewport evidence | **PASS.** US2 exists for this. R12 makes the 44px and horizontal-scroll rules automated assertions, closing the gap the v1.3.0 amendment recorded as unproven. |
| X — Core loop boringly reliable | UI evidence, not API-only | **PASS.** Every story has a UI-level acceptance scenario; US2's evidence is a phone-viewport e2e run. |
| XII — No Silent Failures | Loaded / empty / error | **PASS.** FR-016 separates "no matches" from "no orders"; FR-023 stops an error body being saved as a data file; FR-026 and FR-029 stop an undelivered email being reported as sent. |
| XIII — Smoke test before deploy | Required | **PASS, unchanged.** US2 adds a phone-viewport pass to what the smoke run must cover. |
| XIV — Paid work gated | No Stripe / checkout / paid CTA | **PASS.** Nothing here touches billing. The brief's "Trial UI" workstream is already shipped and is not reopened. |
| XX — Own One Job, Visibly | No new top-level module | **PASS.** Every change serves the core loop or trust in its numbers. |
| XXI — Beat the Spreadsheet on Trust | No human-entered balance; four capabilities not degraded | **PASS.** US4 removes the reason to retype into a spreadsheet; the export is derived per FR-021. |
| XXIII — Credibility Over Feature Count | Hide rather than ship visible-and-incomplete | **PASS.** US1 and US5 are both direct applications. |
| XV–XIX — Landing principles | Screenshots match shipped UI | **ATTENTION — see below.** |

**One gate needs a decision at implementation time, not here.** Principle XIX requires landing
screenshots to match the deployed UI, and the Landing review gate requires a UI change the
screenshots contradict to be re-captured in the same unit of work. US2 changes control sizes in the
app shell and on the purchase order detail screen — which is the screen the hero screenshot shows.
If the visible result differs, the landing assets must be re-captured in the same change. R1 records
how, and why that capture must not run against the hosted database.

No violations requiring justification. Complexity Tracking is therefore empty and omitted.

## Project Structure

### Documentation (this feature)

```text
specs/004-trader-difference-kit/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions R1-R13
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output — how to validate each story
├── checklists/
│   └── requirements.md  # Spec quality checklist (16/16)
├── contracts/
│   ├── list-filters.md      # Purchase order list query contract
│   ├── party-export.md      # Party remaining export contract
│   ├── invite-outcome.md    # Invitation email outcome contract
│   ├── permissions.md       # Role-to-action table the UI and server share
│   └── touch-targets.md     # Phone comfort measurement contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── purchase_orders.py   # add po_number search; use batched aggregate
│   │   ├── parties.py           # add party remaining export endpoint
│   │   ├── dashboard.py         # use batched aggregate
│   │   ├── reports.py           # extract shared CSV/XLSX/PDF writer
│   │   └── org.py               # report invitation email outcome
│   ├── services/
│   │   ├── po_calc.py           # add compute_many (batched aggregate)
│   │   ├── email.py             # return a delivery outcome, not None
│   │   └── exports.py           # NEW: shared row-set -> file writer
│   ├── models/
│   │   └── membership.py        # invitation_email_sent_at (nullable)
│   └── migrations/versions/     # one migration for the column above
└── tests/
    ├── unit/                    # compute_many parity with compute; email outcome
    └── integration/             # filters, party export, invite outcome, role refusal

frontend/
├── public/
│   ├── manifest.webmanifest     # NEW
│   └── icons/                   # NEW: home-screen icons
├── src/
│   ├── components/
│   │   ├── AppShell.tsx         # touch target sizes
│   │   └── ui/                  # Button, Field: phone sizing + full-width primary
│   ├── hooks/
│   │   └── usePermissions.ts    # NEW: single source for interface role decisions
│   ├── pages/
│   │   ├── purchase-orders/
│   │   │   ├── PurchaseOrdersList.tsx   # party + search filters, URL-backed
│   │   │   └── PurchaseOrderDetail.tsx  # role-gate the dispatch form
│   │   ├── parties/PartyDetail.tsx      # export + share controls
│   │   ├── dashboard/Dashboard.tsx      # overdue figure becomes a link
│   │   └── settings/TeamMembers.tsx     # honest invite result + copyable link
│   └── services/                        # no new client needed
└── tests/
    ├── unit/                    # permissions table, filter state, invite messaging
    └── e2e/
        ├── mobile-viewport.spec.ts  # 44px + no-horizontal-scroll assertions
        └── roles.spec.ts            # NEW: Viewer sees no forbidden control
```

**Structure Decision**: the existing two-service layout is kept unchanged. Three new files are
added (`backend/src/services/exports.py`, `frontend/src/hooks/usePermissions.ts`,
`frontend/tests/e2e/roles.spec.ts`) plus the manifest and icons; everything else is an edit to a
file that already exists. `exports.py` exists so the party export and the three organization
reports share one file writer rather than growing a second copy of the CSV, XLSX, and PDF paths —
two copies of an export format is exactly how a party export and an organization report start
disagreeing about a number.

## Deviations from the Supplied Plan Brief

The brief's technical approach and workstream table were taken as input, not as instructions. Five
points differ, each recorded with its reasoning in `research.md`:

1. **The Landing workstream is not reopened** (R1). It shipped in `003-landing-page-upgrade`. The
   brief's "capture production UI" step cannot be followed as written: the capture fixture now
   refuses to run against a non-local database, deliberately, because it creates and deletes rows.
   Screenshots are re-captured locally, and only if US2 visibly changes the screens they show.
2. **The Trial UI workstream is not reopened.** It shipped in `002-market-ready-trial`.
3. **The sequence is reordered** (R2). The brief sequences by visitor psychology and places roles
   fourth. Role gating is promoted to first because it is not a new capability but a live defect
   that misinforms a user about whether the product works.
4. **A performance fix is inserted before the filter work** (R3). It is not in the brief because
   the brief could not have known about it; it is a prerequisite for SC-005 being achievable.
5. **The printable summary uses the existing server-side document path, not a browser print
   stylesheet** (R8). This revises an assumption recorded in the spec, and is the one place where
   research contradicted the specification rather than refining it.

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1. No gate changed verdict. Two notes:

- **Principle II survived the performance work.** The temptation in R3 is to store a dispatched
  total on the purchase order row. The design explicitly does not: `compute_many` runs one grouped
  `SUM` over dispatches per request. The contract in `contracts/list-filters.md` states that a
  stored total would be a defect, so a future reader optimising further is warned.
- **Principle XII gained a sharper edge in FR-023.** The existing organization export already
  handles this correctly (it checks the response before building the download); the party export
  must reuse that same path rather than reimplement it, which `contracts/party-export.md` requires.
