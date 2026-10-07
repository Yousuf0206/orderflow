<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0 (MINOR: six new principles + new workflow
  section; no existing principle removed or redefined)
Modified principles:
  - II. Remaining Balance is Sacred — unchanged in substance; new
    Principle X cross-references it to extend the guarantee to the UI
    surface (previously only a data-layer guarantee).
Added sections:
  - Core Principles IX–XIV:
      IX.   Trial-First Positioning
      X.    The Core Loop Must Be Boringly Reliable
      XI.   Truth Over Marketing
      XII.  No Silent Failures
      XIII. Smoke Test Before Every Production Deploy
      XIV.  Paid Work Is Gated
  - Launch Gates & Release Workflow (fills the previously-omitted
    [SECTION_3_NAME] slot from the constitution template)
  - Mission statement under the document title
Removed sections: none
Deferred items / TODOs:
  - TODO(RATIFICATION_DATE): original adoption date still not supplied;
    carried forward from v1.0.0 and unresolved. Confirm and replace.
  - TODO(P0_DEFINITION): Principle XIV gates paid work on "this kit's P0
    items". The P0 list lives outside this constitution; link or inline the
    authoritative P0 checklist so the gate is objectively testable.
Templates requiring follow-up:
  - .specify/templates/plan-template.md and spec-template.md do not
    reference principle counts or names directly; re-check during the next
    /speckit-plan run for alignment with Principles IX–XIV, particularly
    the smoke-test gate in Principle XIII.
-->

# OrderFlow Constitution

OrderFlow is a multi-tenant SaaS for traders and dealers to track Purchase
Orders, partial dispatches, and remaining balances in real time.

**Current mission (free trial / private beta):** make OrderFlow reliable
enough that a real trader can sign up, track parties, POs, and partial
dispatches, and trust the remaining balance. Paid billing is deferred until
that baseline is solid.

## Core Principles

### I. Multi-tenancy First
Every piece of business data MUST be isolated by `organization_id`. No
cross-tenant data leakage is acceptable under any circumstance. All queries,
background jobs, exports, and integrations MUST scope by organization at the
data-access layer, not only in the UI.

### II. Remaining Balance is Sacred
Remaining Balance = Ordered Qty − SUM(Dispatches). This calculation MUST
always be accurate and computed in real time; it MUST NEVER be stored as a
static/cached value that can drift from the underlying dispatch records.

### III. Partial Dispatches are Core
A single Purchase Order MUST support unlimited partial dispatches. The
system MUST NOT force full delivery only; partial fulfillment over time is a
first-class workflow, not an edge case.

### IV. Simplicity over Features
Clear, fast workflows are preferred over complex enterprise features. A user
MUST be able to create a PO and record a dispatch in under 60 seconds.
Any proposed feature that meaningfully slows this core workflow MUST be
justified or redesigned.

### V. Role-Based Access
Every action MUST respect the user's role: Owner / Manager / Staff /
Viewer. Staff MAY add dispatches but MUST NOT manage billing or users.
Authorization checks MUST be enforced server-side, not only hidden in the
UI.

### VI. Audit Everything Important
Creating, editing, or deleting Parties, Purchase Orders, and Dispatches
MUST be logged with enough detail (who, what, when, before/after state) to
reconstruct history for support and compliance purposes.

### VII. No Hard Deletes of Business Data
Parties, Purchase Orders, and Dispatches MUST use soft deletes
(`deleted_at`) rather than hard deletes. Soft-deleted records MUST be
excluded from normal views and calculations (including Remaining Balance)
while remaining available for audit and recovery.

### VIII. Mobile + Desktop Equality
Core workflows (creating a PO, recording a dispatch, viewing remaining
balance) MUST work well on both desktop and mobile viewports. A workflow
that only works on desktop is not considered complete.

### IX. Trial-First Positioning
While OrderFlow is in free trial / private beta, the primary call to action
MUST be the free trial and nothing else. Paid plans MUST NOT be presented as
available until checkout has been verified end-to-end against a real
payment flow. Billing surfaces MAY display the current trial state and a
non-interactive "Paid plans coming soon" message; they MUST NOT offer an
upgrade path that cannot complete.

**Rationale:** a broken upgrade path costs more trust than a missing one, and
beta users are being recruited on reliability, not on price.

### X. The Core Loop Must Be Boringly Reliable
The loop signup → onboarding → party → PO → partial dispatch → remaining
balance MUST work through the user interface every time, not only through the
API. An API-level pass is NOT sufficient evidence that this loop works.
Remaining balance displayed anywhere in the UI MUST be derived from dispatch
records per Principle II; no screen may show a figure obtained any other way.

**Rationale:** this loop is the entire product promise. Everything else is
secondary to it being unremarkable in its dependability.

### XI. Truth Over Marketing
Trial limits shown in the UI MUST match what the backend actually enforces.
Plan or limit cards that fail to load, or that contradict enforced trial
limits, MUST NOT be displayed at all rather than displayed in a wrong or
partial state. Privacy and Terms links MUST remain present, reachable, and
accurate.

**Rationale:** a limit the UI understates or overstates turns into a support
incident and a credibility loss at exactly the moment a trial user is
deciding whether to rely on the product.

### XII. No Silent Failures
Every loading state MUST resolve into one of three terminal states: loaded
data, an explicit empty state, or a clear actionable error. Indefinite
loading states such as "Loading party…" or "Loading purchase order…" that
never resolve are defects, not cosmetic issues. API and UI error messages
MUST be understandable to a non-technical trader; raw stack traces, bare
status codes, and generic "Something went wrong" without recourse are
insufficient.

**Rationale:** a user who cannot tell whether the system is slow, empty, or
broken will assume their data is lost.

### XIII. Smoke Test Before Every Production Deploy
Before any production deploy, the full path signup → party → PO → dispatch →
dashboard remaining-balance update MUST be exercised and MUST pass. If the
smoke test fails, the build MUST NOT be announced to beta users, regardless
of what else in the release is ready.

**Rationale:** the cost of one broken core loop reaching beta users exceeds
the cost of every delayed release in this phase.

### XIV. Paid Work Is Gated
Stripe integration, plan upgrade flows, and paid calls to action are OUT of
active scope until the launch-readiness P0 items are complete. The sole
permitted exception is work that *hides* or *disables* paid calls to action,
which is explicitly in scope and encouraged.

**Rationale:** half-built billing is the most expensive kind of unfinished
work, because it fails in front of a user holding a credit card.

TODO(P0_DEFINITION): the authoritative P0 checklist that releases this gate
lives outside this constitution; link or inline it so this principle is
objectively testable.

## Constraints

- Primary market: SME traders (steel, cement, hardware, building materials).
- Target users in this phase: trading / material dealer SMEs on a free trial.
- Initial focus: responsive web application. Native mobile apps are a later
  phase, not part of the MVP.
- Design with offline-friendly thinking in mind, though an online-first
  implementation is acceptable for MVP.
- Currency and timezone MUST be configurable per organization; neither may
  be hard-coded globally.
- The domain engine MUST NOT be rewritten unless a specific bug is proven
  against it with a reproducing case.
- Fixing reliability and clarity takes precedence over adding features.

## Launch Gates & Release Workflow

- **Smoke gate.** Principle XIII is a hard release gate, not a checklist
  item. A failed or skipped smoke run blocks the production announcement.
- **UI evidence required.** Work touching the core loop MUST be verified
  through the UI before being marked complete. Passing tests at the API or
  unit level satisfy regression safety but do not satisfy Principle X.
- **Loading-state review.** Any change that introduces an asynchronous data
  fetch MUST state, at review time, what its loaded, empty, and error states
  resolve to (Principle XII).
- **Trial-limit parity.** Any change to trial limits MUST change the backend
  enforcement and the UI copy in the same unit of work, or explicitly record
  why they can diverge temporarily (Principle XI).
- **Scope check.** Pull requests touching Stripe, checkout, upgrade paths, or
  paid CTAs MUST either be limited to hiding/disabling those surfaces or cite
  the completed P0 gate from Principle XIV.

## Governance

This constitution supersedes other informal practices for OrderFlow.
Amendments require: (1) a documented rationale, (2) an explicit version
bump following semantic versioning (MAJOR for incompatible principle
removals/redefinitions, MINOR for new principles or materially expanded
guidance, PATCH for clarifications/wording), and (3) a note on any
migration impact to existing specs, plans, or code.

All feature specs and plans produced via Spec Kit commands (`/speckit-specify`,
`/speckit-plan`, `/speckit-tasks`, `/speckit-implement`) MUST be checked
against these principles; any deviation MUST be called out explicitly and
justified rather than silently ignored. Complexity that conflicts with
Principle IV (Simplicity over Features) must be justified in the plan.

Principles IX through XIV are phase-scoped to the free trial / private beta.
They remain in force until paid billing is verified end-to-end, at which
point relaxing or removing them requires its own amendment under the
procedure above — they do not lapse implicitly.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-10-08
