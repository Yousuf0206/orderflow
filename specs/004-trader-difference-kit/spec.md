# Feature Specification: Trader Difference Kit

**Feature Branch**: `004-trader-difference-kit`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "sp.specify – Features That Create Difference" — six epics (A: landing
first impression, B: mobile-first dispatch / PWA path, C: beat Excel on visibility and share,
D: minimal alerts, E: team credibility, F: trial surface honesty), with non-goals: native store
apps, stock ledger, Stripe conversion push, buyer portal, WhatsApp Business API.

## Scope Reconciliation

The brief describes six epics. Roughly half of what it asks for is already shipped, verified
against the codebase on 2026-10-09. Re-specifying shipped work would produce tasks that close
themselves and would hide the real gaps, so this specification covers **only the gaps**. What is
already in place is recorded here so the omission reads as a decision rather than an oversight.

**Already shipped — excluded from this feature:**

| Brief item | Where it already lives |
| --- | --- |
| A1, A2, A3 — entire landing epic | Delivered by `003-landing-page-upgrade`: hero with a captured PO-detail screenshot, industry proof strip, problem/outcome, three feature blocks with real UI crops, how-it-works with mini crops, final CTA band, footer with Privacy and Terms |
| B1 (partly) — collapsible phone nav | App shell already has a hamburger-triggered mobile drawer and a desktop sidebar |
| B2 (partly) — numeric keyboard, immediate update | Quantity inputs already request a numeric keypad; Dispatched and Remaining already refresh on a successful dispatch |
| C3 — org-level export | Reports already export CSV, Excel, and PDF, all three genuinely implemented server-side; no placeholder buttons exist to hide |
| D2 — empty and error states | Delivered by `002-market-ready-trial`: every fetch resolves to loaded, empty, or an actionable error; trial-cap messages exist |
| E1 (partly) — invite and accept | Invite-by-email-and-role, an accept-invite screen, and a Pending/Active member state all exist |
| E2 (partly) — server-side roles | Recording a dispatch is already restricted server-side to Owner, Manager, and Staff; a Viewer receives a refusal |
| F1 — trial surface honesty | Delivered by `002-market-ready-trial`: trial-only public pricing, billing limits read from the API, no blank plan cards |

**Out of scope, per the brief's own non-goals:** native iOS/Android store apps, stock ledger and
warehouses, any Stripe paid-conversion push, a buyer self-service portal, and the WhatsApp
Business API.

**Also out of scope, decided here:** the optional owner email digest for overdue purchase orders
(D1's second bullet). The brief marks it optional and conditions it on email infrastructure being
strong; User Story 5 establishes whether email is reliable at all, and a digest built before that
answer is a digest that may silently never arrive. It should be its own feature once email
delivery is proven.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A Viewer is never offered an action they cannot complete (Priority: P1)

A trading company adds their accountant as a Viewer so he can watch balances without changing
anything. He opens a purchase order, sees the "Add dispatch" form, fills in a date and a quantity,
presses the button, and is refused. Nothing was wrong with what he typed; he was never allowed to
do it. He concludes the product is broken and tells the owner so.

After this story, the form is not there for him. In its place is a short line saying that
recording dispatches needs Staff access or above, so he understands the product is working
correctly and he is simply not the person who records dispatches.

**Why this priority**: this is the cheapest credibility loss in the product and the most certain —
it happens to every Viewer on their first visit to a purchase order, and the server already
behaves correctly, so only the interface is lying. It is also the clearest case of a visible
control whose primary path cannot complete.

**Independent Test**: sign in as a Viewer, open a purchase order, and confirm no dispatch form is
offered and an explanation appears instead. Then sign in as Staff and confirm the form is present
and works. Delivers value with nothing else in this feature built.

**Acceptance Scenarios**:

1. **Given** a signed-in Viewer, **When** they open a purchase order with remaining balance,
   **Then** no dispatch entry form or submit control is rendered, and a message states which role
   is required.
2. **Given** a signed-in Staff, Manager, or Owner user, **When** they open the same purchase
   order, **Then** the dispatch form is present and a dispatch can be recorded.
3. **Given** a signed-in Viewer, **When** they open any screen offering create, edit, or delete of
   parties or purchase orders, **Then** those controls are absent or disabled with a stated
   reason, never present-and-failing.
4. **Given** a user whose role could not be loaded, **When** they open a purchase order,
   **Then** the interface does not silently assume the most permissive role; it states that
   permissions could not be confirmed and offers a retry.

---

### User Story 2 — Recording a dispatch on a phone is comfortable (Priority: P1)

A dispatch clerk is standing at a gate with a truck in front of him, phone in one hand. He opens
the purchase order, enters the quantity loaded, the vehicle number, and submits. He does this
twenty times a day, outdoors, often one-handed.

After this story, every control he touches is big enough to hit without aiming, the submit button
spans the width of the screen, the keyboard never hides the button he needs to press next, and
nothing requires a sideways swipe.

**Why this priority**: this is the product's core act performed in its real setting, and it is the
one Principle XXII explicitly governs — the constitution now requires phone-viewport evidence for
this path, and that evidence does not exist today.

**Independent Test**: at a 390px-wide viewport, record a dispatch end to end and measure every
interactive control, the horizontal scroll extent, and whether the submit control is reachable
with the keyboard open.

**Acceptance Scenarios**:

1. **Given** a 390px-wide viewport, **When** a user records a dispatch, **Then** every
   interactive control in that path presents a touch target of at least 44×44 CSS pixels.
2. **Given** a 390px-wide viewport, **When** any screen in the dispatch path is displayed,
   **Then** the document does not scroll horizontally.
3. **Given** a 390px-wide viewport with the on-screen keyboard open over a focused quantity field,
   **When** the user looks for the submit control, **Then** it is reachable without dismissing the
   keyboard first.
4. **Given** a 390px-wide viewport, **When** a primary action is displayed in a form,
   **Then** it spans the available width rather than sitting as a small inline button.
5. **Given** a stopwatch started at the purchase order screen, **When** an experienced user
   records a dispatch, **Then** the dispatch is recorded and the new Remaining figure is visible
   within 30 seconds.

---

### User Story 3 — Finding the right purchase order quickly (Priority: P2)

A trader has 180 open purchase orders. A party calls asking about one of them. Today he can filter
by status and then read down the list. He wants to type the PO number, or pick the party, and see
only what matters. He also wants the Overdue figure on his dashboard to be something he can press.

**Why this priority**: this is the "beat Excel" claim in its most concrete form — in a spreadsheet
he would filter in two seconds. It does not block the core loop, which is why it sits below the
two P1 stories, but it is what makes the product usable at real volume.

**Independent Test**: load an organization with many purchase orders across several parties, then
narrow the list by party and by PO number, and reach a filtered list by pressing the dashboard
Overdue figure.

**Acceptance Scenarios**:

1. **Given** a purchase order list with orders from several parties, **When** the user selects a
   party, **Then** only that party's orders are listed, and the active filter is visible.
2. **Given** a purchase order list, **When** the user types part of a PO number, **Then** only
   matching orders are listed, and matching is case-insensitive and partial.
3. **Given** a party filter and a status filter both set, **When** the list renders, **Then** both
   are applied together, and each can be cleared independently.
4. **Given** a dashboard showing a non-zero Overdue count, **When** the user presses it,
   **Then** the purchase order list opens filtered to overdue orders, and the count shown on the
   dashboard equals the number of rows listed.
5. **Given** filters that match nothing, **When** the list renders, **Then** it says no orders
   match those filters and offers to clear them — never "no purchase orders yet".
6. **Given** a filtered list, **When** the user navigates to an order and returns,
   **Then** the filters are still applied.

---

### User Story 4 — Sending a party their remaining balance (Priority: P2)

A party asks what is still pending against their orders. The trader opens that party, presses one
control, and gets a file he can attach to an email or hand over — party name, each PO number, the
material, ordered, dispatched, remaining, and the due date.

**Why this priority**: this is the single most common thing a trader does with this data that the
product cannot do today, and it is the reason the data would otherwise be copied back into a
spreadsheet — which is where the retyped-balance problem starts.

**Independent Test**: open a party with several open orders, export, and verify the downloaded file
opens and contains exactly the specified columns with figures matching the screen.

**Acceptance Scenarios**:

1. **Given** a party with open orders, **When** the user exports their remaining balances,
   **Then** a file downloads containing party name, PO number, material, ordered quantity,
   dispatched quantity, remaining balance, and due date for each open order.
2. **Given** a downloaded export, **When** its figures are compared with the party screen,
   **Then** every remaining figure matches, because both are derived from dispatch records.
3. **Given** a party with no open orders, **When** the user looks for the export control,
   **Then** it is either absent or disabled with a stated reason, and pressing it never produces
   an empty or malformed file.
4. **Given** an export that fails, **When** the failure occurs, **Then** the user is told the
   export did not download and no file is saved — in particular, no file containing an error
   message is saved under a data filename.
5. **Given** a user who wants to hand the figures over rather than attach a file, **When** they
   choose the printable summary, **Then** a page suitable for printing or saving as PDF is
   produced with the same figures and the party's name.

---

### User Story 5 — An invitation that tells the truth (Priority: P3)

An owner invites a colleague by email and role. The screen says the invitation was sent. The
colleague never receives anything, because no mail service is configured. The owner waits two days
and then concludes the product's team feature does not work.

After this story, the owner is told plainly whether the email actually went out, and if it did
not, is given the invitation link to pass on himself.

**Why this priority**: it affects every self-hosted or partly configured deployment and costs two
days of a customer's trust each time, but it affects fewer users per day than the P1 and P2
stories, and the invitation itself already works — only the reporting of it is wrong.

**Independent Test**: with mail delivery unconfigured, invite a member and confirm the interface
says the email was not sent and supplies a usable link; configure delivery and confirm it says the
email was sent.

**Acceptance Scenarios**:

1. **Given** no working mail delivery, **When** an owner invites a member, **Then** the member is
   created in a pending state and the interface states that no invitation email could be sent.
2. **Given** that same situation, **When** the owner reads the result, **Then** an invitation link
   is offered that the colleague can use to accept, and copying it requires no technical knowledge.
3. **Given** working mail delivery, **When** an owner invites a member, **Then** the interface
   states the invitation was emailed, and names the address it went to.
4. **Given** a pending member, **When** the owner views the team list, **Then** that member's
   pending state is distinguishable from an active one, and the invitation can be resent or its
   link retrieved.
5. **Given** mail delivery that fails mid-send, **When** the failure occurs, **Then** the
   invitation is not reported as sent, and the pending member and link remain usable.

---

### User Story 6 — Keeping OrderFlow on the phone's home screen (Priority: P3)

The dispatch clerk uses OrderFlow twenty times a day. He wants it on his home screen, opening
without browser chrome, with a recognisable icon — not a bookmark among forty others.

**Why this priority**: it is real convenience for the heaviest user, and it is the lightest work in
this feature, but no capability is unavailable without it. It is explicitly "installability, light"
— the core loop must keep working in a normal mobile browser, and nothing here may depend on being
installed.

**Independent Test**: open the application in mobile Safari and mobile Chrome, use the browser's
add-to-home-screen action, and confirm the installed entry has the correct name and icon and opens
to a working core loop.

**Acceptance Scenarios**:

1. **Given** the application open in a mobile browser, **When** the user adds it to their home
   screen, **Then** the entry carries the OrderFlow name and icon rather than a generic page title
   or a blank icon.
2. **Given** the application launched from the home screen, **When** the user signs in and records
   a dispatch, **Then** the full core loop works exactly as it does in the browser.
3. **Given** a browser that does not support installation, **When** the user visits,
   **Then** nothing is broken, hidden, or degraded — installation is additive only.
4. **Given** the installed entry, **When** it opens, **Then** it opens to the application rather
   than to the public landing page.

### Edge Cases

- A Viewer who had the dispatch form open when their role was changed to Staff, or the reverse —
  the interface must reflect the role it last confirmed and must not submit on a stale assumption.
- A party filter naming a party that was soft-deleted after the filter was applied.
- A PO number search containing characters that would otherwise be read as pattern syntax.
- An export for a party with hundreds of open orders, where the file takes noticeable time to
  produce and the user presses the control twice.
- A dispatch recorded on a phone where the request exceeds the client's deadline — the user must be
  told the dispatch may not have been recorded, and must not be shown a Remaining figure implying
  it was.
- An invitation to an email address that already belongs to a member of the same organization.
- An invitation link retrieved and shared after it has already been used, or after it has expired.
- A home-screen launch after the stored session has expired.
- An organization whose dashboard Overdue count is zero — pressing it must not open an empty list
  presented as an error.

## Requirements *(mandatory)*

### Functional Requirements

**Role-aware interface (US1)**

- **FR-001**: The interface MUST NOT render a control whose action the signed-in user's role
  forbids; such controls MUST be absent or disabled with a stated reason.
- **FR-002**: Where a forbidden action is the main purpose of a region, the interface MUST state
  which role is required instead of simply showing nothing.
- **FR-003**: Role-based hiding MUST NOT be the only enforcement; every action MUST remain refused
  on the server for users whose role forbids it.
- **FR-004**: When the signed-in user's role cannot be determined, the interface MUST NOT assume a
  permissive role; it MUST say permissions are unconfirmed and offer a retry.
- **FR-005**: Role rules enforced MUST be: a Viewer MAY read but MUST NOT create, edit, or delete
  parties, purchase orders, or dispatches; Staff MAY record dispatches; Owner and Manager MAY
  manage parties and purchase orders; Owner alone MAY manage billing and organization settings.

**Phone comfort on the dispatch path (US2)**

- **FR-006**: Every interactive control in the dispatch path MUST present a touch target of at
  least 44×44 CSS pixels at 390px viewport width.
- **FR-007**: No screen in the dispatch path MAY scroll horizontally at 390px viewport width.
- **FR-008**: The submit control of a form MUST remain reachable while the on-screen keyboard is
  displayed over a focused field.
- **FR-009**: A form's primary action MUST span the available width at phone viewport widths.
- **FR-010**: Quantity and numeric fields MUST request a numeric keypad.
- **FR-011**: The dispatch path MUST be verified at phone viewport widths of 320px, 360px, 390px,
  and 430px, and that verification MUST be automated so it cannot silently lapse.

**Finding purchase orders (US3)**

- **FR-012**: Users MUST be able to narrow the purchase order list by party.
- **FR-013**: Users MUST be able to narrow the purchase order list by a partial, case-insensitive
  match on PO number.
- **FR-014**: Status, party, and PO-number filters MUST combine, and each MUST be clearable
  independently of the others.
- **FR-015**: The active filter state MUST be visible, and MUST survive navigating to an order and
  back.
- **FR-016**: A filtered list with no matches MUST say that no orders match the current filters and
  offer to clear them, distinctly from the organization having no orders at all.
- **FR-017**: The dashboard Overdue figure MUST open the purchase order list filtered to overdue
  orders, and the figure MUST equal the number of rows that list shows.
- **FR-018**: Filtering MUST be applied where the data is selected, not by hiding rows already
  delivered to the browser, so that a filtered count is a true count.

**Party remaining export (US4)**

- **FR-019**: Users MUST be able to export a party's open orders with exactly these fields: party
  name, PO number, material, ordered quantity, dispatched quantity, remaining balance, and due
  date.
- **FR-020**: The export MUST be offered in a spreadsheet-readable form at minimum, and
  additionally as a printable summary.
- **FR-021**: Every figure in an export MUST be derived from dispatch records at the time of
  export, never from a stored or cached balance.
- **FR-022**: An export MUST be scoped to the requesting user's organization, and MUST refuse a
  party belonging to another organization.
- **FR-023**: A failed export MUST report the failure and MUST NOT save a file; in particular an
  error response MUST NOT be saved under a data filename.
- **FR-024**: The export control MUST be absent or disabled, with a reason, when the party has no
  open orders.
- **FR-025**: Exporting MUST be recorded in the audit trail as an action with an actor and a
  timestamp.

**Honest invitations (US5)**

- **FR-026**: After an invitation, the interface MUST state whether an invitation email was
  actually dispatched, and MUST NOT report success for an email that was only logged or dropped.
- **FR-027**: When no email was dispatched, the interface MUST supply the invitation link in a form
  the owner can copy and send by other means.
- **FR-028**: A pending member MUST be visually distinguishable from an accepted one, and the team
  list MUST offer either resending the invitation or retrieving its link.
- **FR-029**: An invitation whose email dispatch fails MUST leave the pending member and the link
  usable, and MUST NOT be reported as sent.
- **FR-030**: An invitation link MUST remain single-use, and an expired or used link MUST produce a
  clear explanation rather than a generic failure.

**Light installability (US6)**

- **FR-031**: The application MUST declare an installable identity carrying the OrderFlow name, a
  short name suitable for a home screen, and icons at the sizes mobile browsers request.
- **FR-032**: Launching from the home screen MUST open the application, not the public landing
  page, and the full core loop MUST work there.
- **FR-033**: Installability MUST be additive: no capability may require installation, and
  browsers that do not support it MUST be unaffected.
- **FR-034**: Nothing in this feature MAY introduce offline behaviour or background caching of
  business data; a remaining balance MUST never be served from a cache that could be stale.

**Status consistency (D1, in-app only)**

- **FR-035**: Overdue, due-soon, on-track, and fully-dispatched states MUST be labelled and
  coloured identically everywhere they appear — dashboard, purchase order list, party detail, and
  purchase order detail — and MUST be derived from one shared definition.

### Key Entities

- **Membership**: ties a user to an organization with a role and a pending/accepted state. This
  feature reads its role for interface decisions and surfaces its pending state honestly; it
  introduces no new role.
- **Invitation**: the pending state of a membership plus a single-use acceptance link and a record
  of whether an email was dispatched for it. The dispatch outcome is the only new fact.
- **Purchase Order List Filter**: the user's current combination of status, party, and PO-number
  search. Held for the session, not stored as organization data.
- **Party Remaining Export**: a point-in-time derived view of one party's open orders. Not stored;
  computed when requested, from dispatch records.
- **Installable Identity**: the application's name, short name, icons, and launch target as a
  mobile browser needs them in order to add it to a home screen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Viewer encounters zero controls that refuse them after being pressed, across
  purchase orders, parties, and dispatches.
- **SC-002**: An experienced user records a dispatch on a 390px-wide phone viewport, from opening
  the purchase order to seeing the updated Remaining figure, in under 30 seconds.
- **SC-003**: Every interactive control in the dispatch path measures at least 44×44 CSS pixels at
  390px width, with no exceptions.
- **SC-004**: No screen in the dispatch path scrolls horizontally at 320px, 360px, 390px, or 430px.
- **SC-005**: A trader locates a specific purchase order among 180 open orders in under 15 seconds
  by party or PO number.
- **SC-006**: The dashboard Overdue figure and the number of rows in the list it opens agree
  exactly, in every organization tested.
- **SC-007**: A trader produces a shareable remaining-balance summary for one party in under 15
  seconds, and every figure in it matches the figures on screen.
- **SC-008**: In an environment with no mail delivery configured, an owner can still get a
  colleague onto the team, and is never told an email was sent when none was.
- **SC-009**: The application can be added to the home screen of mobile Safari and mobile Chrome
  with the correct name and icon, and the core loop completes from that launch.
- **SC-010**: Status labels and colours are identical across all four surfaces that show them,
  verified by comparison rather than by inspection of one surface.
- **SC-011**: Three people outside the team, given a phone and a purchase order, record a dispatch
  without being told how.

## Assumptions

- Role names and their meanings are unchanged: Owner, Manager, Staff, Viewer. This feature makes
  the interface agree with rules the server already enforces; it does not redefine any role.
- The signed-in user's role is already available to the interface — it is used today to decide
  which navigation items to show — so no new mechanism is assumed for obtaining it.
- "Spreadsheet-readable at minimum" for the party export is taken to mean the same format the
  existing organization-level reports already produce, so a trader gets one familiar file type
  rather than two.
- ~~The printable summary is taken to mean a page the browser can print or save as PDF, not a
  server-generated document.~~ **Superseded by plan research R8**: the existing organization-level
  PDF builder turned out to be a general `(title, org_name, columns, rows)` function, so the party
  PDF costs one call to it, while a print stylesheet would be new CSS, a new view, and output that
  varies by browser and paper size. The printable summary is therefore the server-generated PDF.
- "Dispatch in under 30 seconds" is measured from the purchase order screen with the user already
  signed in, not from a cold start, and excludes time spent waiting on a network slower than a
  normal mobile connection.
- 390px is the reference phone width, consistent with the constitution's Principles XVIII and XXII;
  320px is treated as the narrowest supported width.
- "Installability, light" is taken to exclude a service worker and any offline capability.
  Principle II forbids a stale remaining balance, and a cache that can serve one is a defect, so
  nothing here caches business data.
- Email delivery may be unconfigured in any given deployment. This feature assumes that is a
  normal state to report honestly, not an error to fix.
- Existing audit, organization-scoping, and soft-delete behaviour are reused unchanged; the only
  new audit action is exporting a party's remaining balances.
- The optional overdue email digest is deferred to a later feature, pending the outcome of User
  Story 5.

## Constitution Alignment

This feature is governed by `.specify/memory/constitution.md` v1.3.0.

- **XXII (The Phone Is Part of the Product)** — User Story 2 and FR-006 to FR-011 exist to satisfy
  it. The constitution's amendment note records that XXII's 44px and keyboard clauses are currently
  unproven; FR-011 makes the proof automated.
- **XXIII (Credibility Over Feature Count)** — User Story 1 is the clearest instance: a visible
  control whose primary path cannot complete. FR-001 enacts "hide rather than ship visible and
  incomplete". User Story 5 applies the same rule to a message rather than a control.
- **XXI (Beat the Spreadsheet on Trust)** — FR-021 keeps the export derived rather than stored, and
  User Story 4 removes the reason a trader would otherwise retype balances into a spreadsheet.
- **II (Remaining Balance is Sacred)** — FR-021 and FR-034 both defend it: no exported figure and
  no cached response may carry a balance that did not come from dispatch records.
- **V (Role-Based Access)** — FR-003 keeps server enforcement primary; the interface changes are
  additive.
- **XX (Own One Job, Visibly)** — every story here serves the core loop or the trust in its
  numbers. No new top-level module is introduced, so the sprint scope check is satisfied.
- **XII (No Silent Failures)** — FR-023, FR-026, and FR-029 are its application to exports and
  invitations.
- **XIII (Smoke Test Before Every Production Deploy)** — unchanged and still required; User Story 2
  adds a phone-viewport pass to what must be exercised.
- **XIV (Paid Work Is Gated)** — nothing here touches Stripe, checkout, or paid calls to action.
- **IX / XVI** — untouched; this feature adds no call to action to the landing page.
