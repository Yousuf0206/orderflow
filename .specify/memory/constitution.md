<!--
Sync Impact Report
==================
Version change: 1.3.0 → 1.4.0 (MINOR: four new principles closing gaps that
  a production outage and a near-miss exposed; no principle removed or
  redefined)
Added sections:
  - XXIV. Verify the Deployed System, Not Only the Build
  - XXV. An Empty Export Still Says What It Is
  - XXVI. A Phone Claim Needs a Phone
  - XXVII. Tests Never Touch Production
  - Launch Gates: added "Deployed verification", "Schema before code",
    "Real-device evidence" and "Test isolation".
  - Mission restated in the "credible trial" terms of the 2026-10-10 brief.
Source of this amendment:
  - An "OrderFlow Completion (Credible Trial)" brief supplied on 2026-10-10,
    following a production outage the same day.
  - Three of its seven non-negotiables were already law and are deliberately
    not duplicated: remaining balance calculated rather than typed is II and
    XXI; no paid-plan push until Stripe is proven is IX and XIV; and the
    smoke-before-announce half of its first item is XIII. What XIII did not
    cover -- and what actually failed -- is verifying the system after it is
    deployed, which XXIV now carries.
  - Its fifth item names a task id (T022). XXVI states the substance instead,
    because a task id stops meaning anything once that feature ships while
    the rule it stands for does not.
Known gaps at amendment time (not constitution changes):
  - XXVI is unsatisfied today: no dispatch has been recorded on a real
    device, so no release may currently be pitched on mobile dispatch.
  - XXIV is unsatisfied today: nothing yet runs a smoke check against the
    deployed system after a deploy. Closing it is feature work.
Previous report (v1.2.0 → v1.3.0) follows.
==================
Version change: 1.2.0 → 1.3.0 (MINOR: four new principles on competitive
  focus, trust against spreadsheets, phone-first dispatch, and finished work
  over feature count; no existing principle removed or redefined)
Added sections:
  - XX. Own One Job, Visibly
  - XXI. Beat the Spreadsheet on Trust
  - XXII. The Phone Is Part of the Product
  - XXIII. Credibility Over Feature Count
  - Launch Gates & Release Workflow: added "Phone dispatch evidence" and
    "Sprint scope check".
Modified principles: none redefined. Four pre-existing principles are cited
  from the new ones rather than restated:
  - II. Remaining Balance is Sacred — XXI adds the user-facing consequence
    (no human re-entry of a balance), which II did not cover: II forbids the
    system storing it, not a form asking a person for it.
  - IV. Simplicity over Features — XXIII addresses breadth (how many things
    are finished), where IV addresses speed of the core workflow.
  - VIII. Mobile + Desktop Equality — XXII raises recording a dispatch on a
    phone from "works" to "comfortable", and makes phone-viewport evidence
    mandatory rather than optional.
  - XV. The Landing Page Shows the Product — XX extends the remaining-balance
    hero from the landing page to the in-app surfaces.
Removed sections: none
Deferred items / TODOs: none.
Source of this amendment:
  - A "Competitive Difference Sprint" brief supplied on 2026-10-09. Two of
    its six difference principles are already law and were deliberately not
    duplicated: "Show the product before signup" is Principle XV, and
    "Trial-first, paid later" is Principles IX, XIV, and XVI. Three of its
    four non-negotiables are likewise already law: core math is II,
    screenshots matching production is XIX, and the pre-deploy smoke run is
    XIII. Only its fourth non-negotiable (phone-viewport evidence for the
    dispatch path) was not covered, and XXII plus the new gate carry it.
  - The brief's "PWA-level" phrasing is treated as a comfort bar, not as a
    requirement to ship a web app manifest, service worker, or installable
    app. No such requirement is created here; one would need its own
    amendment, and the Constraints section still defers native mobile.
Capability check performed at amendment time (not a constitution change):
  - XXI names four capabilities. All four exist today: live remaining
    (src/services/po_calc.py), party views (frontend PartyDetail),
    export (backend/src/api/reports.py, frontend Reports.tsx), and overdue
    visibility (backend/src/api/dashboard.py, statusMeta.ts). XXI therefore
    protects shipped behaviour rather than promising unbuilt work.
Templates requiring follow-up:
  - .specify/templates/plan-template.md and spec-template.md do not
    reference principle counts or names directly; re-check during the next
    /speckit-plan run for alignment with Principles IX–XXIII.
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

**Current mission (free trial / private beta):** a stranger can sign up, log a
partial dispatch on a phone, export remaining balances, and invite a teammate
— without a spreadsheet, and without a 500 on signup. Paid billing is deferred
until that baseline is solid.

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

### XX. Own One Job, Visibly
OrderFlow's one job is the remaining balance after a partial dispatch, and
that job MUST be the most visible thing the product says about itself.
Remaining balance MUST be the hero of the public landing page (per Principle
XV) and MUST be reachable within one screen of signing in, without a search or
a filter. No new top-level module — inventory, invoicing, accounting,
payments, or a comparable adjacent domain — MAY be started while the core loop
still has open reliability or clarity defects. Extending an adjacent domain
that is already shipped is permitted; introducing a new one is not.

**Rationale:** a product that is visibly excellent at one job beats a product
that is invisibly adequate at five. A half-built inventory module does not add
a reason to buy; it adds a reason to doubt the part that works.

### XXI. Beat the Spreadsheet on Trust
A user MUST NEVER be asked to type, confirm, or carry forward a remaining
balance. Every remaining figure a user sees MUST be derived by the system from
dispatch records (Principle II); no form field, import, or reconciliation step
MAY accept a balance as human input. The four capabilities that make the
calculated number trustworthy — live remaining balance, party-level views,
export of the underlying records, and overdue visibility — are shipped
behaviour and MUST NOT be removed or degraded without an amendment.

**Rationale:** the competitor is a spreadsheet, and the spreadsheet's single
worst property is that its totals are only as true as the last person who
retyped them. Principle II stops the *system* from storing a stale balance;
this stops the *interface* from asking a human for one.

### XXII. The Phone Is Part of the Product
Recording a dispatch MUST be comfortable on a mobile browser, not merely
possible. At 390px width the dispatch form MUST be completable with no
horizontal scrolling and no pinch-zoom, every interactive control MUST present
a touch target of at least 44×44 CSS pixels, and the submit action MUST be
reachable without the on-screen keyboard covering it. Work that changes the
dispatch path MUST be verified at a phone viewport; desktop-only verification
does not satisfy this principle. Where a phone layout and a desktop aesthetic
conflict, the phone layout wins.

**Rationale:** dispatches are recorded at a gate, on a truck, in a yard — on a
phone, one-handed, in sunlight. Principle VIII asks whether the workflow
functions on mobile; this asks whether a person standing outside would
actually use it.

### XXIII. Credibility Over Feature Count
A release MUST be judged by what in it is finished, not by how much of it
exists. One dependable capability MUST be preferred over several partial ones,
and a feature MUST NOT be announced, linked from navigation, or described in
marketing until its primary path completes end to end through the user
interface. Features discovered to be partial MUST be hidden or disabled rather
than shipped visible and incomplete. Social proof MUST be real (Principle
XVII).

**Rationale:** every visible-but-unfinished surface teaches the user that
things here do not quite work, and that lesson transfers to the parts that do.
Hiding an unfinished feature costs a feature; shipping one costs the product's
credibility.

### XXIV. Verify the Deployed System, Not Only the Build
After any production deploy, signup and login MUST be exercised against the
deployed system before it is announced, linked, or relied on. A pass obtained
locally, in CI, or against any database other than production does NOT satisfy
this: it verifies the build, and the build is not what users reach.

Schema MUST reach the running code, not trail it. A deploy whose migrations
have not been applied MUST be treated as an outage in progress, not as a
pending task, and the ordering MUST be guaranteed by the system rather than by
anyone remembering.

**Rationale:** on 2026-10-09 a migration adding a column was committed, the
code was deployed, and the migration was never applied to production. Every
insert and select touching that table returned 500 — signup, and through the
session lookup, every authenticated request — behind a login that still
returned 200, so users signed in and watched every screen fail. Principle XIII
was satisfied: the smoke path had been exercised. It had been exercised against
a local database, which is exactly the hole this closes.

### XXV. An Empty Export Still Says What It Is
A file produced by an export MUST be self-describing even when it contains no
data. Column headers MUST be declared by the report rather than inferred from
its first row, so a report with no rows still downloads as a named, empty
table. An export that opens as a blank sheet MUST be treated as a defect.

**Rationale:** "Overdue Orders" with nothing overdue downloaded as two bytes —
a bare newline. Opened in a spreadsheet it is indistinguishable from a broken
export, so the one thing it must communicate, that there is nothing overdue, is
the one thing it does not. This is Principle XII applied to files: a result
that neither shows data nor explains its absence is a silent failure.

### XXVI. A Phone Claim Needs a Phone
Recording a dispatch MUST be verified on a real mobile device — a physical
phone, not a viewport, an emulator, or a device-mode window — at least once per
release train. The verification MUST record the device, the browser, and
whether the dispatch completed without zooming or panning.

No release MAY be announced, pitched, or described as supporting mobile
dispatch until that verification has been done for it. Automated phone-viewport
checks satisfy Principle XXII; they do NOT satisfy this one and MUST NOT be
cited as if they did.

**Rationale:** a viewport models width. It does not model a thumb, a real
on-screen keyboard covering the submit button, a browser's address bar moving
on scroll, or sunlight. Those are the conditions under which this product is
actually used, and a claim about them can only be earned by meeting them. This
is Principle XXIII applied to the specific claim most likely to be made before
it is true.

### XXVII. Tests Never Touch Production
No local or automated test run MAY read from or write to a production database
by default. Test configuration MUST NOT fall through to production
credentials: where a suite resolves its connection from a developer's
environment, it MUST assert the target is a local database and refuse
otherwise, and that refusal MUST be the default rather than an opt-in.

Any code path that runs automatically at application startup — schema
migration in particular — MUST be inert under test, and that MUST be enforced
in the test harness rather than left to each test to remember.

**Rationale:** this project's production database already holds several
hundred machine-generated organizations from suites that resolved their
connection from a developer's `.env`. On 2026-10-10 a startup-migration change
went further and had the test suite run `alembic upgrade head` against
production — schema changes to live customer data as a side effect of running
`pytest`. The danger is not carelessness; it is that the default path leads
there, and a default that can destroy real data is a defect regardless of who
is at the keyboard.

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
- **Phone dispatch evidence.** Any change touching the dispatch path — the
  form, its validation, its submission, or the screens that display the
  resulting remaining balance — MUST be exercised at a phone viewport before
  being marked complete, and the review MUST say so. A desktop-only pass is
  not evidence (Principle XXII).
- **Sprint scope check.** A pull request that introduces a new top-level
  module outside the core loop MUST cite why Principle XX permits it. Absent
  that, the correct outcome is to defer the module, not to review it.
- **Deployed verification.** After a production deploy, signup and login MUST
  be exercised against the deployed system and the result recorded, before any
  announcement or link (Principle XXIV). A local or CI pass is not this.
- **Schema before code.** Any change containing a migration MUST state how that
  migration reaches production ahead of the code that needs it. "It will be run
  manually" is not an answer unless someone is named and it is done in the same
  unit of work.
- **Real-device evidence.** A release train MUST carry at least one recorded
  real-device dispatch before anything in it is pitched on mobile use
  (Principle XXVI). The record names the device and browser.
- **Test isolation.** Any change touching test configuration, application
  startup, or database connection resolution MUST state what stops a test run
  reaching production (Principle XXVII), and the answer MUST be a default
  rather than a convention.

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

Principles XXIV through XXVII are not phase-scoped. Verifying the deployed
system, exports that describe themselves when empty, earning a phone claim on a
phone, and keeping tests away from production are properties of operating the
product at all, not of this beta. If anything, they get stricter once there are
customers to lose rather than beta users to apologise to.

Two of them are unsatisfied as of this amendment, and that is recorded rather
than smoothed over: nothing yet smoke-checks the deployed system after a deploy
(XXIV), and no dispatch has been recorded on a real device (XXVI), so no
release may currently be pitched on mobile dispatch. A principle the project
does not yet meet is still the standard; the gap is work, not an exemption.

Of the competitive-difference principles, one clause is phase-scoped: Principle
XX's bar on starting a new top-level module, which is tied to the core loop
having open reliability or clarity defects and lifts when it does not. The rest
of XX, and all of XXI, XXII, and XXIII, are not phase-scoped — the one job
staying visible, never asking a person for a balance, a dispatch being
comfortable on a phone, and shipping only what is finished are properties of
the product rather than of this sprint.

**Version**: 1.4.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-10
