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

### XXVIII. A Purchase Order Is a Header With Lines
One real-world purchase order MUST map to exactly one OrderFlow purchase order,
which MAY contain many materials. The header MUST carry party, PO number,
order date, due date, notes, and organization; each line MUST carry material,
ordered quantity, unit, and its position in the order. An active purchase order
MUST have at least one line at all times — no path MAY leave it with zero.

Plan limits MUST count purchase orders, not lines: `max_active_pos` counts
headers, and a fifty-line purchase order consumes one slot.

**Rationale:** a trader's PO lists cement, steel, and sand on one sheet of
paper. Forcing that into three OrderFlow orders makes the product disagree with
the document it is meant to track, and charging plan slots per line would
punish exactly the customers with the largest orders.

### XXIX. Remaining Is Per Line, and Units Never Mix
Principle II applies at line grain: for each line, remaining = ordered quantity
− SUM(dispatch quantities recorded against that line), computed live and never
stored. Quantities in different units MUST NEVER be added together. No
dashboard, summary, party view, or export MAY present a single cross-unit
"total remaining" as if tonnes, bags, and pieces were comparable.

A purchase order's status MUST be derived from its lines. It is fully
dispatched only when every line has remaining ≤ 0 under the product's rounding
rules. Open, due-soon, and overdue status MUST consider only open lines against
the PO due date, and the worst open line drives the severity shown.

Exports MUST be line-grained: one spreadsheet row per PO line, with PO number
and party repeated across rows as needed. Principle XXV still holds — an empty
report MUST still carry its header row.

**Rationale:** "12 remaining" means nothing if it is 10 tonnes plus 2 bags. A
summed figure across units is not a simplification, it is a wrong number, and
Principle XXI exists so that the system's numbers are the ones a trader can
trust over their spreadsheet.

### XXX. One Truck, Many Lines
A dispatch MUST have one date, one vehicle or reference, and one set of
remarks, and MAY record quantities against one or more lines of the same
purchase order. A line MAY be omitted from a dispatch. A dispatch MUST NOT
record quantities against lines of a different purchase order. Over-dispatch
rules MUST be evaluated per line; a PO-level total within limit MUST NOT mask a
single line that exceeds its own ordered quantity.

**Rationale:** one truck leaving the yard carries several materials for one
order. Making the user record that as several dispatches turns one real event
into several records and breaks the 60-second workflow of Principle IV.

### XXXI. Migration Keeps Every Record
Moving to header-and-line purchase orders MUST NOT lose or alter history.
Every existing single-material purchase order MUST become a header with exactly
one line, and every existing dispatch MUST become a dispatch header with one
dispatch line against that sole line. Quantities, units, and dates MUST be
identical before and after, and every pre-migration remaining balance MUST
equal its post-migration line remaining.

The migration MUST be rehearsed against a copy of the pre-migration schema and
data before it reaches production. Startup migration MAY apply it only after
that rehearsal has passed, and a migration failure MUST stop startup loudly
rather than let code run against a half-migrated schema (Principle XXIV).

**Rationale:** existing customers' balances are the product. A migration that
silently drops a dispatch or rounds a quantity rewrites the one number they
rely on, and nobody notices until a truck is short.

### XXXII. Multi-Item Is Claimed Only When It Works in Production
Multi-item purchase orders MUST NOT be announced, described on the landing
page, or mentioned in beta messaging until multi-line create, detail view,
multi-line dispatch, and line-grained export all complete end to end on the
deployed production system. Until then, OrderFlow MUST either hold the
announcement or state the single-material limitation explicitly.

The deployed smoke check for a release containing this capability MUST
exercise at least: create a multi-line purchase order → record a partial
dispatch covering more than one line → confirm remaining per line.

**Rationale:** this is Principles XXIII and XXIV applied to the next claim most
likely to be made before it is true. A trader who signs up because the page says
"multi-item" and finds one material per order has been lied to once, and will
assume the remaining balances are lying too.

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
- Multi-item purchase orders (XXVIII–XXXII) carry a PO-level due date only.
  Per-line due dates, inventory or stock on hand, a buyer portal, invoicing,
  and native mobile apps are out of scope for that work, and it MUST NOT change
  the trial-first strategy of Principles IX and XIV.

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
- **Migration rehearsal.** A migration that reshapes business data — the
  header-and-line migration in particular — MUST be run against a copy of the
  pre-migration schema and data, with before/after quantities and remaining
  balances compared, before it reaches production (Principle XXXI).
- **Unit check.** Any change that sums, aggregates, or totals quantities MUST
  state at review time how it avoids adding across units (Principle XXIX).
- **Multi-line smoke.** A release containing multi-item purchase orders MUST
  record a deployed run of multi-line create → partial multi-line dispatch →
  per-line remaining before any multi-item claim is made (Principle XXXII).

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

Principles XXVIII through XXXII are not phase-scoped. A purchase order matching
its paper, never adding across units, recording a truck as one dispatch, and
migrating without loss are properties of the data model. XXXII's hold on the
multi-item claim lapses once its conditions are met for a release, and is
re-earned by any later release that breaks them.

**Version**: 1.5.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-12
