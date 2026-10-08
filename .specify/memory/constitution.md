<!--
Sync Impact Report
==================
Version change: 1.1.1 → 1.2.0 (MINOR: five new principles governing the
  public landing page; no existing principle removed or redefined)
Added sections:
  - XV. The Landing Page Shows the Product
  - XVI. One Primary Action on the Landing Page
  - XVII. Landing Proof Must Be Real
  - XVIII. The Landing Page Must Be Fast and Reachable on a Phone
  - XIX. Screenshots Match the Shipped UI
  - Launch Gates & Release Workflow: added the "Landing review" gate.
Modified principles: none redefined. Three pre-existing principles are now
  also cited from the new landing principles rather than restated:
  - IX. Trial-First Positioning — XVI applies it to the landing page.
  - XI. Truth Over Marketing — XVII extends it to social proof.
  - VIII. Mobile + Desktop Equality — XVIII extends it to the landing page,
    which is not a core workflow and so was not previously covered.
Removed sections: none
Deferred items / TODOs: none.
Source of this amendment:
  - A scoped "OrderFlow Landing & First Impression" brief supplied on
    2026-10-08. Its sixth non-negotiable (trial-first messaging on the
    landing, pricing linked but not sold) is not given its own principle
    because Principles IX and XIV already carry it; XVI states the landing
    consequence so a reader of the landing rules does not have to infer it.
Templates requiring follow-up:
  - .specify/templates/plan-template.md and spec-template.md do not
    reference principle counts or names directly; re-check during the next
    /speckit-plan run for alignment with Principles IX–XIX.
Known gap at amendment time (not a constitution change):
  - frontend/src/pages/marketing/Landing.tsx is 211 lines and
    frontend/public/ holds only favicon.svg and og-image.svg, so no product
    screenshot asset exists yet. Principle XV is therefore not currently
    satisfied; closing it is feature work, not governance work.
Note on the file referenced by Principle XIV:
  - Principle XIV points at a feature-scoped path. That is deliberate --
    it is where the evidence lives -- and the accompanying substance
    restatement is what keeps the gate meaningful if the path changes. A
    future amendment that supersedes those phases should update the pointer
    and may raise the bar, but may not lower it.
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

**The P0 gate.** The launch-readiness P0 items are Phases 2 through 5 of
`specs/002-market-ready-trial/tasks.md`:

- Phase 2 — Foundational: a bounded request deadline, the shared query-state
  contract, the server-owned paid-plans gate, and the billing response that
  carries limits and usage.
- Phase 3 — User Story 1: the core loop completes through the user interface
  and no screen can be left loading.
- Phase 4 — User Story 2: no reachable path to a purchase that cannot
  complete, verified by direct request as well as through the UI.
- Phase 5 — User Story 3: every limit displayed is the limit enforced.

In substance the gate asks four things, and they remain the test even if that
file is moved, renamed, or superseded: **the core loop works in the UI every
time; no screen can hang or claim something it never loaded; no reachable
control starts a purchase that cannot finish; and every number shown to a user
is the number the server enforces.** A later feature may restate these, but may
not lower them.

Releasing the gate is a separate, explicitly authorized step. Completing these
phases permits paid work to be *scoped*; it does not by itself enable paid
plans, which additionally requires checkout verified end to end per Principle
IX.

### XV. The Landing Page Shows the Product
The public landing page MUST show the product above the fold. The hero MUST
include a screenshot of a real OrderFlow screen — a purchase-order detail or a
remaining-balance view — either captured from the running application or
reproduced faithfully from it. A text-only hero MUST NOT ship to the public
landing page. "Above the fold" means visible without scrolling at 1280×800 on
desktop and within the first viewport on a 390px-wide phone.

**Rationale:** a first-time visitor decides whether this is a real product
before reading a sentence. Partial dispatches and remaining balances are
visual ideas; describing them in prose reads as a template, while one true
screen reads as software that exists.

### XVI. One Primary Action on the Landing Page
The landing page MUST present exactly one primary call to action: start the
free trial. Any secondary action MUST be soft — "See how it works", a scroll
cue, or a link to pricing — and MUST be visually subordinate to the primary
one. Competing primary calls to action MUST NOT appear, and per Principles IX
and XIV no paid call to action may be presented as available. Pricing MAY be
linked; it MUST NOT be sold on this page, and trial-first messaging stays.

**Rationale:** two primary actions are no primary action. The landing page has
one job in this phase, which is to get a real trader into a trial.

### XVII. Landing Proof Must Be Real
Social proof on the landing page MUST be true. Customer counts, company logos,
testimonials, ratings, and reviews MUST NOT be shown unless they are real,
attributable, and permitted to be shown. Until real logos exist, naming the
industries OrderFlow is built for — steel, cement, hardware, building
materials — is permitted proof, because it is a claim about the product's
focus rather than about customers it does not have.

**Rationale:** this extends Principle XI to the first screen a stranger sees.
An invented customer count is the one mistake that cannot be walked back once
a real buyer notices it.

### XVIII. The Landing Page Must Be Fast and Reachable on a Phone
The landing page MUST load fast. For v1 it MUST prefer static images over
video or animation for the product shot, and images MUST be sized and
compressed for the viewport that requests them. On mobile the layout MUST
stack to a single column, and the primary call to action MUST be reachable
without horizontal scrolling at 390px width.

**Rationale:** Principle VIII covers the core workflows but not the landing
page. A landing page that needs a sideways swipe to reach its only button
fails before the product gets a chance.

### XIX. Screenshots Match the Shipped UI
Any screenshot or UI reproduction on the landing page MUST match the
application as currently deployed: the same colors, the same layout, and the
labels Ordered / Dispatched / Remaining as the UI spells them. Features that
are not live MUST NOT appear in a landing screenshot, mockup, or caption.
When a landing screenshot and the application disagree, the screenshot is the
defect.

**Rationale:** a screenshot is a promise about what happens after signup.
Showing a screen the user will not find, or a feature that does not exist,
converts a visitor into a disappointed trial user — the most expensive kind.

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
- **Landing review.** Any change to the public landing page MUST state, at
  review time, that the hero still shows a real product screen (XV), that
  there is still exactly one primary call to action (XVI), that every proof
  claim on the page is real (XVII), that the primary call to action is
  reachable at 390px width without horizontal scroll (XVIII), and that every
  screenshot still matches the deployed UI (XIX). A change that ships a UI
  change the landing screenshots contradict MUST update those screenshots in
  the same unit of work or record why they may diverge temporarily.

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

Of the landing principles, two are phase-scoped in the same way: XVI's single
trial call to action, and XVII's allowance of industry naming in place of
logos, which a later amendment may replace with real customer proof once it
exists. Principles XV, XVIII, and XIX are not phase-scoped — showing the real
product, loading fast on a phone, and matching the shipped UI apply for as
long as OrderFlow has a public landing page.

**Version**: 1.2.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-08
