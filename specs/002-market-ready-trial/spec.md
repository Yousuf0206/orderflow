# Feature Specification: Market-Ready Trial Updates

**Feature Branch**: `002-market-ready-trial`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Ship a stable free-trial experience. Pause paid subscription as a market offer until the product is approved by real use." (sp.specify – Market-Ready Trial Updates, Epics 1–4)

## Context

This is a **hardening and verification** feature, not new product construction. A
survey of the existing codebase confirms that every surface named in Epics 1–4
already exists, and that several capabilities the kit lists as "minimum viable"
are already implemented:

- Landing, Pricing, Billing, Onboarding, Team, Reports, Audit Log, Privacy, and
  Terms screens all exist.
- Member invite and invite-acceptance both exist end to end.
- Report export already supports CSV, PDF, and XLSX.
- Trial limits (3 users / 25 active POs) are already enforced server-side, as is
  read-only lockout on trial expiry.

The work therefore divides into three kinds: **remove or disable** paid paths that
cannot complete, **align copy** with limits the backend actually enforces, and
**prove in the UI** that behaviour the API already supports is reachable by a real
user every time. Where a requirement below restates existing behaviour, it is
there because the governing constitution (Principle X) treats an API-level pass as
insufficient evidence, and the requirement is satisfied by demonstrated UI
behaviour rather than by code that appears correct.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A trader completes the core loop and trusts the number (Priority: P1)

A trading SME owner signs up, is placed in a working application shell, creates
their first party, raises a purchase order against that party, records a partial
dispatch against that order, and sees the remaining balance fall by exactly the
dispatched quantity — on the dashboard, on the party, and on the order. They do
this through the user interface only, with no knowledge of the API, and it behaves
the same way on every attempt.

**Why this priority**: This loop is the entire product promise. If it works, the
product is demonstrable to a beta user even with every other story unshipped. If
it fails, nothing else in this feature has value.

**Independent Test**: Fully testable by performing signup → party → PO → partial
dispatch → dashboard in a browser against a clean organization, and confirming the
remaining balance agrees with the dispatch records at each step. Delivers the
complete demonstrable product on its own.

**Acceptance Scenarios**:

1. **Given** a visitor with no account, **When** they complete signup with an
   organization name, **Then** a session is established and they land on
   onboarding or the dashboard with their organization name, role, and email
   visible in the application shell.
2. **Given** a newly signed-up user with no data, **When** they open the
   dashboard, **Then** they see an empty state naming the next action rather than
   an empty or indefinitely loading screen.
3. **Given** a signed-in user, **When** they create a party, **Then** the party
   detail screen opens and shows the saved party.
4. **Given** at least one party exists, **When** the user creates a purchase order
   and selects that party from the party selector, **Then** the order is created
   and its detail screen shows Ordered, Dispatched, and Remaining quantities.
5. **Given** a purchase order with ordered quantity 100 and no dispatches, **When**
   the user records a dispatch of 30, **Then** the order immediately shows
   Dispatched 30 and Remaining 70, and the dispatch appears in that order's
   history without the user reloading the page.
6. **Given** a purchase order with ordered quantity 100 and 30 already dispatched,
   **When** the user attempts to dispatch 80, **Then** they are warned that the
   dispatch exceeds the remaining balance and must explicitly confirm before it is
   accepted.
7. **Given** dispatches recorded across several parties and orders, **When** the
   user opens the dashboard, **Then** the displayed totals and the party-wise
   remaining figures agree with the sum of the recorded dispatches.
8. **Given** a signed-in user, **When** they log out, **Then** the session is
   fully cleared and no authenticated screen is reachable without signing in
   again.

---

### User Story 2 - No visitor is offered a paid plan that cannot complete (Priority: P1)

A prospective customer browsing the public site, and a trial user looking at their
billing screen, are offered exactly one commercial action: start or continue a free
trial. No button, card, or link invites them toward a purchase or billing-management
path that will fail, because paid checkout is not yet verified end to end.

**Why this priority**: Equal to US1 in priority but independent of it. A broken
upgrade path costs more trust than a missing one, and the failure is most visible
precisely when a user has decided to pay. This story is also the cheapest
risk reduction in the feature, since it removes surface rather than adding it.

**Independent Test**: Testable by walking every public and in-app surface
(landing, navigation, pricing, billing, footer) as both an anonymous visitor and a
trial user, and confirming that no reachable control initiates checkout or a
billing portal session.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor on the landing page, **When** they read the
   primary calls to action in the hero and the navigation, **Then** the only
   offered commercial action is starting a free trial, with no competing "Buy" or
   "Subscribe" emphasis.
2. **Given** an anonymous visitor, **When** they open the pricing page, **Then**
   they see a single clear trial message stating the trial length, that no credit
   card is required, and that paid plans are coming soon.
3. **Given** an anonymous visitor on the pricing page, **When** they look for a
   way to select a paid tier, **Then** no enabled control exists that would begin
   checkout for Starter, Business, or Pro.
4. **Given** a trial user, **When** they open the in-app billing screen, **Then**
   it identifies their current plan as Trial and shows the date the trial ends.
5. **Given** a trial user on the billing screen, **When** they look for an upgrade
   action, **Then** any upgrade affordance is absent, or is visibly disabled and
   labelled as coming soon, and cannot be activated.
6. **Given** a trial organization that has no payment relationship on file,
   **When** they open the billing screen, **Then** no "Manage billing" control is
   offered, because such a control could not succeed for them.
7. **Given** any user on any surface in this story, **When** a paid control has
   been disabled rather than removed, **Then** activating it is impossible and it
   produces no error, no navigation, and no network request.

---

### User Story 3 - Displayed limits match enforced limits (Priority: P2)

A trial user reads their usage limits on the billing screen and during onboarding,
reaches one of those limits during normal work, and finds that the number they were
shown is exactly the number that stopped them — with a message that explains what
happened and what to do next.

**Why this priority**: Below US1 and US2 because it affects users who are already
succeeding with the product, but above the beta-bar stories because a limit that
understates or overstates reality converts directly into a support incident and a
credibility loss.

**Independent Test**: Testable by reading the limits shown in the UI, then
creating users and purchase orders up to and past those counts, and confirming the
blocking point and the message match what was displayed.

**Acceptance Scenarios**:

1. **Given** a trial organization, **When** the user views their limits on the
   billing screen, **Then** the user and active-purchase-order limits shown are the
   values the server actually enforces for that organization.
2. **Given** a trial organization, **When** limits appear during onboarding or in
   any limit warning, **Then** those figures are identical to the ones on the
   billing screen.
3. **Given** a trial organization at its user limit, **When** an owner invites
   another member, **Then** the attempt is refused with a clear in-app message
   naming the limit that was reached, and the member is not created.
4. **Given** a trial organization at its active-purchase-order limit, **When** a
   user creates another purchase order, **Then** the attempt is refused with a
   clear in-app message naming the limit that was reached, and the order is not
   created.
5. **Given** any limit refusal, **When** it occurs, **Then** the user sees an
   explanatory message rather than a silent no-op, an unexplained validation
   error, or a raw server response.
6. **Given** paid tier limits are not purchasable, **When** any public or in-app
   surface displays limit figures, **Then** it does not present paid tier limits
   as available entitlements alongside the trial's.

---

### User Story 4 - Nothing loads forever (Priority: P2)

A user on a slow or failing connection always learns the state of the screen they
opened. Every screen that fetches data resolves into data, an explicit empty state,
or an error they can understand and retry — never an indefinite progress message.

**Why this priority**: Shares the reliability intent of US1 but applies across
every screen, including ones outside the core loop, so it is broader and less
immediately critical than the loop itself.

**Independent Test**: Testable by exercising each data-backed screen under induced
failure and latency (request failure, server error, and a stalled request) and
confirming each reaches a terminal state with a usable retry.

**Acceptance Scenarios**:

1. **Given** a user opening party detail, purchase order detail, the dashboard, or
   any list screen, **When** the underlying request fails, **Then** they see an
   understandable error message and a retry control, not a persistent loading
   message.
2. **Given** a user on any of those screens, **When** the underlying request does
   not complete within a bounded time, **Then** the screen stops waiting and
   presents the same error-and-retry treatment.
3. **Given** a failed screen, **When** the user activates retry, **Then** the
   request is attempted again and the screen resolves to data, empty state, or the
   error treatment again.
4. **Given** a request that succeeds but returns no records, **When** the screen
   renders, **Then** the user sees an empty state that names the next action, such
   as creating a first party.
5. **Given** any error shown to a user in this story, **When** they read it,
   **Then** it is phrased for a non-technical trader and does not consist solely of
   a status code, a stack trace, or an unqualified "Something went wrong".

---

### User Story 5 - The beta bar is honest about what works (Priority: P3)

A beta user exploring beyond the core loop finds that Team, Reports, Audit Log, and
Onboarding each either work or are not offered. Nothing in these areas is a control
that looks functional and is not.

**Why this priority**: These areas support evaluation rather than the core promise,
and much of the underlying capability already exists; the remaining risk is
unverified UI reachability and non-functional controls.

**Independent Test**: Testable by exercising each of the four areas in the UI as an
owner and confirming every visible control either completes its action or is absent.

**Acceptance Scenarios**:

1. **Given** an owner, **When** they open team management, **Then** they see the
   current members of their organization with each member's role and status.
2. **Given** an owner, **When** they invite a person by email address with a role,
   **Then** the invitation is issued and the invitee appears in the member list
   with a status that makes clear the invitation is not yet accepted.
3. **Given** an invited person with a valid invitation, **When** they accept it,
   **Then** they gain access to that organization with the role they were invited
   as, and their status in the member list reflects acceptance.
4. **Given** an owner who is the only owner of their organization, **When** they
   attempt to remove themselves, **Then** the attempt is refused with an
   explanation, so the organization cannot be left without an owner.
5. **Given** a user with recorded dispatch data, **When** they open reports,
   **Then** remaining balance by party is visible.
6. **Given** a user on reports, **When** they export, **Then** at least a
   comma-separated export downloads a file containing the data they were shown.
7. **Given** a user on reports, **When** an export format is offered, **Then**
   activating it produces a file in that format; any format that cannot do so is
   not offered as a control.
8. **Given** a user who has created and edited parties, purchase orders, and
   dispatches, **When** they open the audit log, **Then** they see a readable list
   of those recent actions.
9. **Given** a user whose organization has no recorded activity, **When** they open
   the audit log, **Then** they see a readable empty state rather than a blank
   screen.
10. **Given** a newly signed-up user in onboarding, **When** they choose to get
    started, **Then** they are taken to creating a party; **and When** they choose
    to skip, **Then** they are taken to the dashboard.
11. **Given** a user reading the onboarding steps, **When** they follow them,
    **Then** each step describes something that actually exists in the product.

---

### User Story 6 - The product looks legitimate to a stranger (Priority: P3)

A prospective customer evaluating whether to trust an unfamiliar product with their
order book can find the privacy policy and terms from wherever they are, and the
product presents itself correctly when shared or found.

**Why this priority**: Necessary for a credible public beta and legally expected,
but it does not affect whether the product works for a user who has already signed
up.

**Independent Test**: Testable by locating the legal documents from each required
surface and inspecting the public pages' presentation metadata.

**Acceptance Scenarios**:

1. **Given** a visitor or user on signup, pricing, billing, or any page footer,
   **When** they look for legal documents, **Then** both the privacy policy and the
   terms of service are reachable from that surface.
2. **Given** a reader of either legal document, **When** they read it, **Then** its
   contents are internally consistent and contain no placeholder contact details
   where a real one is available.
3. **Given** any public page, **When** it is loaded or shared, **Then** it carries a
   page title, a description, social preview information, and a site icon.

---

### Edge Cases

- **Trial already expired.** A user whose trial has ended opens the application.
  They must be told clearly that the trial has ended and what state their account
  is in, and must not be offered a purchase path that cannot complete (US2) nor be
  left on an indefinite loading screen (US4).
- **Dispatch exactly equal to remaining.** Dispatching precisely the remaining
  quantity must complete without an over-dispatch warning and must drive remaining
  to zero, with the order reflecting full fulfilment.
- **Dispatch recorded by another session.** A user viewing a purchase order whose
  remaining balance was changed elsewhere must not be able to act on a stale figure
  in a way that silently produces a wrong balance.
- **Last owner removal via role change.** The guard against leaving an
  organization ownerless must also hold when the final owner demotes their own role
  rather than deleting their own membership.
- **Invitation accepted after the organization reached its user limit.** An
  invitation issued while capacity existed, accepted after capacity was exhausted,
  must resolve to a clear outcome rather than silently exceeding the enforced limit
  or failing without explanation.
- **Invitation that is expired, already used, or tampered with.** Acceptance must
  fail with an understandable message rather than an unhandled error.
- **Export of an empty report.** Exporting a report with no rows must produce a
  valid empty file or a clear message, not a corrupt download or a silent failure.
- **Zero-quantity or negative dispatch.** Must be rejected with an explanatory
  validation message.
- **Session expiry mid-task.** A user whose session expires while filling a form
  must be told to sign in again rather than losing the attempt to an unexplained
  failure.
- **Trial length changed after organizations already exist.** A change to the
  configured trial length must leave existing organizations' already-granted end
  dates intact, while public copy reflects the new length for new signups.

## Requirements *(mandatory)*

> Requirement identifiers in this document are scoped to feature 002. Feature
> 001 maintains its own independent FR series; an `FR-0nn` reference in code or
> commits that predates this document belongs to 001.

### Functional Requirements

#### Trial-only positioning

- **FR-001**: The landing page and primary navigation MUST present starting a free
  trial as the only commercial call to action, with no competing purchase or
  subscription emphasis.
- **FR-002**: The public pricing page MUST present a single trial message stating
  the trial length, that no credit card is required, and that paid plans are
  coming soon.
- **FR-003**: No reachable control on any public surface may initiate checkout for
  a paid tier.
- **FR-004**: Where a paid control is retained in a disabled state rather than
  removed, it MUST be labelled as coming soon, MUST be impossible to activate, and
  MUST produce no navigation, error, or server request when a user attempts to
  activate it.
- **FR-005**: The in-app billing screen MUST identify the organization's current
  plan as Trial and MUST display the date the trial ends.
- **FR-006**: The in-app billing screen MUST NOT offer an enabled upgrade action.
- **FR-007**: A billing-management action MUST be offered only when it would
  actually succeed for the viewing organization; for an organization with no
  payment relationship on file it MUST be absent or disabled.

#### Honest limits

- **FR-008**: Usage limits displayed on the billing screen MUST be the limits the
  server enforces for that organization, obtained from the server rather than
  stated as fixed copy.
- **FR-009**: Limit figures shown during onboarding and in any limit warning MUST
  be identical to those shown on the billing screen.
- **FR-010**: Public and in-app surfaces MUST NOT present paid tier limits as
  available entitlements while those tiers cannot be purchased.
- **FR-011**: The trial length stated in public copy MUST be derived from the same
  configured value that signup uses to grant the trial, so the two can never
  contradict each other. No surface may state a trial length as fixed copy.
- **FR-011a**: Any other place that independently determines a trial length,
  including data-seeding routines, MUST read that same configured value rather
  than restating a duration of its own.
- **FR-012**: When a limit is reached, the refusal MUST be surfaced to the user as
  an explanatory in-app message naming the limit, and the blocked record MUST NOT
  be created.
- **FR-013**: Limit refusals MUST NOT present as a silent no-op, an unexplained
  validation error, or a raw server response.

#### Core loop

- **FR-014**: Signup MUST submit every field the server requires, including the
  organization name, so that a valid submission never fails for a reason the user
  cannot see or correct.
- **FR-015**: On successful signup the session MUST be established and the user
  MUST arrive at onboarding or the dashboard.
- **FR-016**: The application shell MUST populate the signed-in user's
  organization name, role, and email address from the server's account
  representation.
- **FR-017**: Logging out MUST clear the session completely, leaving no
  authenticated screen reachable without signing in again.
- **FR-018**: Users MUST be able to create a party through the interface and be
  shown that party's detail screen.
- **FR-019**: Users MUST be able to create a purchase order through the interface,
  selecting an existing party from a selector.
- **FR-020**: Purchase order detail MUST display ordered, dispatched, and remaining
  quantities.
- **FR-021**: Recording a dispatch MUST update the displayed dispatched and
  remaining quantities and the order's dispatch history without requiring the user
  to reload.
- **FR-022**: Every remaining balance displayed anywhere in the interface MUST be
  derived from dispatch records, and no screen may display a remaining figure
  obtained by any other means.
- **FR-023**: A dispatch exceeding the remaining balance MUST warn the user and
  require explicit confirmation before being accepted.
- **FR-024**: The dashboard MUST display totals and party-wise remaining balances
  that agree with recorded dispatches.
- **FR-025**: The dashboard MUST show an empty state naming the next action when
  the organization has no purchase orders.
- **FR-026**: The complete core loop — signup, party creation, purchase order
  creation, partial dispatch, and dashboard remaining-balance update — MUST be
  demonstrated through the user interface. An API-level pass alone does not satisfy
  this requirement.

#### No silent failures

- **FR-027**: Every screen that fetches data MUST resolve into one of exactly three
  terminal states: loaded data, an explicit empty state, or an error.
- **FR-028**: Every data fetch MUST be bounded in time, so that a stalled request
  resolves to the error state rather than leaving a loading message in place
  indefinitely.
- **FR-029**: Error states MUST offer a retry that re-attempts the request.
- **FR-030**: Empty states MUST name the next action available to the user.
- **FR-031**: Errors shown to users MUST be understandable to a non-technical
  trader and MUST NOT consist solely of a status code, a stack trace, or an
  unqualified failure message with no recourse.

#### Beta bar

- **FR-032**: Owners MUST be able to view their organization's members with each
  member's role and invitation status.
- **FR-033**: Owners MUST be able to invite a person by email address with an
  assigned role, and the invitee MUST appear with a status showing the invitation
  is not yet accepted.
- **FR-034**: An invited person MUST be able to accept a valid invitation and gain
  access with the role they were invited as.
- **FR-035**: Acceptance of an expired, already-used, or invalid invitation MUST
  fail with an understandable message.
- **FR-036**: An organization MUST NOT be left without an owner; an attempt by a
  sole owner to remove or demote themselves MUST be refused with an explanation.
- **FR-037**: Reports MUST make remaining balance by party visible.
- **FR-038**: At least a comma-separated export MUST produce a downloadable file
  containing the data the user was shown.
- **FR-039**: Any export format offered as a control MUST produce a file in that
  format; a format that cannot MUST NOT be offered.
- **FR-040**: The audit log MUST present a readable list of recent creations and
  updates of parties, purchase orders, and dispatches.
- **FR-041**: The audit log MUST present a readable empty state when there is no
  recorded activity.
- **FR-042**: Onboarding steps MUST describe capabilities that exist in the
  product.
- **FR-043**: Onboarding's primary action MUST lead to creating a party, and its
  skip action MUST lead to the dashboard.

#### Trust and polish

- **FR-044**: The privacy policy and terms of service MUST be reachable from
  signup, pricing, billing, and page footers.
- **FR-045**: Legal document contents MUST be internally consistent and MUST NOT
  contain placeholder contact details where a real one is available.
- **FR-046**: Public pages MUST carry a page title, a description, social preview
  information, and a site icon.

### Key Entities

- **Organization**: The tenant a trader works within. Carries the plan tier
  currently in effect and the date any trial ends.
- **Subscription**: The commercial state of an organization — its tier, its trial
  end date, and the user and active-purchase-order allowances enforced against it.
  It is the authoritative source for every limit figure displayed to a user.
- **Member**: A person's access to an organization, carrying a role and an
  invitation status distinguishing invited from accepted.
- **Party**: A counterparty a trader transacts with, against which purchase orders
  are raised.
- **Purchase Order**: An ordered quantity placed with a party, against which
  dispatches accumulate. Its remaining balance is derived, never stored.
- **Dispatch**: A recorded partial or full fulfilment against a purchase order. The
  dispatch records are the sole basis for every remaining balance shown.
- **Audit Entry**: A record of who changed which business record, when, used to
  reconstruct history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new trader can go from landing page to a visible, correct remaining
  balance — signup, party, purchase order, partial dispatch, dashboard — in under
  10 minutes on their first attempt, without assistance and without consulting
  documentation.
- **SC-002**: The full core loop completes successfully through the interface on 10
  consecutive clean-organization attempts, with zero failures.
- **SC-003**: Zero reachable controls across all public and in-app surfaces
  initiate a purchase or billing-management action that cannot complete.
- **SC-004**: Every limit figure shown to a user matches the enforced limit for
  that organization, verified across every surface that displays one, with zero
  discrepancies.
- **SC-004a**: Changing the configured trial length changes the length stated on
  every public surface and the length granted at signup together, with no surface
  left stating the previous value.
- **SC-005**: Every data-backed screen reaches a terminal state within 15 seconds
  under induced request failure, server error, and stalled-request conditions,
  with zero screens left in a loading state.
- **SC-006**: Every error message a user can encounter in the core loop is
  understandable to a reader with no technical background, assessed by review
  against all four screens in the loop.
- **SC-007**: Zero controls in Team, Reports, Audit Log, and Onboarding are visible
  but non-functional.
- **SC-008**: Remaining balance shown on the dashboard, party detail, and purchase
  order detail agrees with the sum of recorded dispatches in 100% of checked cases.
- **SC-009**: The privacy policy and terms of service are reachable within one
  action from signup, pricing, billing, and every page footer.
- **SC-010**: The pre-deploy smoke path required by the project constitution passes
  before the build is announced to beta users.

## Assumptions

- **Existing surfaces are retained, not rebuilt.** Landing, Pricing, Billing,
  Onboarding, Team, Reports, Audit Log, and both legal pages already exist and are
  modified in place. The domain engine is not rewritten; per the project
  constitution it is changed only where a bug is proven with a reproducing case.
- **The preferred pricing-page treatment is adopted.** The kit offered a single
  trial message as preferred and disabled preview cards as an alternative; this
  spec requires the preferred treatment. FR-004 governs the alternative should
  individual disabled controls be retained elsewhere.
- **Paid tier limits stay enforced server-side.** Starter, Business, and Pro
  allowances remain defined and enforced for any organization placed on those
  tiers. FR-010 restricts only what is *displayed* to users while those tiers
  cannot be purchased; it does not require removing enforcement.
- **Trial allowances are those the server already enforces** — three users and
  twenty-five active purchase orders — and this feature aligns displayed copy to
  them rather than changing the allowances themselves.
- **A trial organization never has a payment relationship on file**, so FR-007
  resolves to removing or disabling billing management for every trial user in
  practice.
- **Existing invitation and export capability is verified, not built.** Invitation
  issuance, invitation acceptance, and comma-separated, spreadsheet, and
  portable-document exports already exist; the work is confirming each is reachable
  and functional through the interface, and removing any control that is not.
- **Sample-data loading during onboarding is deferred.** The kit marked it
  optional; it is excluded from this feature's scope and may be specified
  separately.
- **Trial expiry behaviour is inherited.** Read-only lockout after trial expiry is
  already implemented; this feature governs only how that state is communicated,
  under FR-027 and FR-031.
- **Bounded fetch timing is a user-visible resolution guarantee**, not a
  prescribed network configuration; FR-028 is satisfied by any means that
  guarantees resolution.
- **Email delivery for invitations is assumed functional** where invitations are
  verified; diagnosing mail infrastructure is outside this feature.

## Out of Scope

- Completing or verifying paid checkout as a launch feature.
- New paid plan packaging or pricing work.
- Native mobile applications.
- Messaging-channel integrations, including WhatsApp and SMS.
- Multi-branch inventory.
- Marketing redesign beyond the trial-only messaging required above.
- Loading sample demonstration data during onboarding.
