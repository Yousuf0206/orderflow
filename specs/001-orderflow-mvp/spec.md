# Feature Specification: OrderFlow MVP Core Platform

**Feature Branch**: `001-orderflow-mvp` (no git repository initialized yet; directory name doubles as the feature identifier)

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "OrderFlow is a multi-tenant SaaS that helps trading companies manage parties, purchase orders, and partial dispatches while automatically calculating remaining balances and delivery status." (full feature list: Organizations, Parties, Purchase Orders, Dispatches, Calculated Fields, Live Dashboard, Party Detail View, Reports & Export, Notifications, Billing, Audit Log, Super Admin)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a PO and Record a Partial Dispatch (Priority: P1)

A Manager or Staff user opens a party's record, creates a new Purchase Order for a
material and quantity, and later records one or more partial dispatches against it.
At every step they can see the remaining balance and delivery status update
automatically.

**Why this priority**: This is the sacred, non-negotiable core workflow of OrderFlow
(per the project constitution). Without fast, accurate PO creation and dispatch
recording, the product has no value. Everything else (dashboard, reports,
notifications) is built on top of this data.

**Independent Test**: Can be fully tested by creating a PO under an existing party,
recording two partial dispatches that together are less than the ordered quantity,
and confirming the remaining balance and status are correct after each dispatch —
without needing the dashboard, reports, or billing to exist.

**Acceptance Scenarios**:

1. **Given** a party exists in the organization, **When** a Manager creates a PO with
   Material, Ordered Qty, Unit, Order Date, and Due Date, **Then** the PO is saved
   with a unique PO Number (unique per organization), status "On Track", and
   Remaining Balance equal to the full Ordered Qty.
2. **Given** an open PO with Remaining Balance > 0, **When** a Staff user records a
   partial dispatch with a Dispatch Date and Qty less than the remaining balance,
   **Then** the system recalculates Total Dispatched and Remaining Balance in real
   time and the dispatch appears in the PO's dispatch history.
3. **Given** a PO with Remaining Balance equal to the dispatch quantity being
   entered, **When** the dispatch is saved, **Then** the PO status becomes "Fully
   Dispatched" and Remaining Balance becomes 0.
4. **Given** a PO with Remaining Balance less than the quantity a user is about to
   dispatch, **When** the user attempts to save that dispatch, **Then** the system
   shows a warning that the dispatch exceeds the remaining balance before allowing
   confirmation.
5. **Given** a user completes PO creation and first dispatch entry under normal
   conditions, **When** measured end-to-end, **Then** the combined action takes
   under 60 seconds for an experienced user.

---

### User Story 2 - Manage Parties (Priority: P2)

A Manager creates, edits, archives, and searches Party records (customers/suppliers)
that Purchase Orders are created against.

**Why this priority**: Parties are the organizing entity that POs hang off of; they
must exist before User Story 1 can be exercised with real data, but the party
management screens themselves are simple CRUD and can be built and tested on their
own.

**Independent Test**: Can be fully tested by creating a party with Party Code, Party
Name, City, Contact Person, and Phone, editing its fields, archiving it, and
confirming it no longer appears in active search/filter results — independent of
POs, dashboard, or any other feature.

**Acceptance Scenarios**:

1. **Given** a Manager is on the Parties screen, **When** they create a party with a
   Party Code, Name, City, Contact Person, and Phone, **Then** the party is saved
   and appears in the party list.
2. **Given** an existing party, **When** a Manager edits its fields, **Then** the
   updated values are saved and reflected immediately in the party list and detail
   view.
3. **Given** an existing party with no open POs, **When** a Manager archives it,
   **Then** the party is hidden from default lists/search but remains viewable in
   archived/history views.
4. **Given** multiple parties exist, **When** a user searches or filters by name or
   code, **Then** only matching, non-archived parties are returned by default.

---

### User Story 3 - Organization Setup & Team Access (Priority: P3)

An Owner signs up, creates their organization with a company profile (name, logo,
currency, timezone), invites teammates by email, and assigns each a role (Owner,
Manager, Staff, Viewer).

**Why this priority**: Required before more than one person can use an
organization, but a single-user organization can exercise User Stories 1 and 2
without it, so this is sequenced after the core workflows.

**Independent Test**: Can be fully tested by signing up, completing the company
profile, inviting a teammate by email, assigning them a role, and confirming the
invited user can log in with exactly the permissions their role allows.

**Acceptance Scenarios**:

1. **Given** a new user signs up, **When** they complete signup, **Then** a new
   organization is created with that user as Owner and a default currency/timezone
   set on the company profile.
2. **Given** an Owner is on the organization settings screen, **When** they update
   company name, logo, currency, or timezone, **Then** the changes apply across the
   organization (e.g., new amounts/dates display in the updated currency/timezone).
3. **Given** an Owner invites a new user by email and assigns a role, **When** the
   invited user accepts, **Then** that user can access only the screens and actions
   permitted by their assigned role (Owner / Manager / Staff / Viewer).
4. **Given** a Staff user is logged in, **When** they attempt to access billing or
   user management, **Then** access is denied.
5. **Given** two different organizations exist, **When** a user from Organization A
   is logged in, **Then** they cannot view, search, or otherwise access any Party,
   PO, Dispatch, or report belonging to Organization B under any circumstance.

---

### User Story 4 - Live Dashboard & Party Detail View (Priority: P4)

A user opens the dashboard to see overall KPIs (total open value, overdue count,
due-soon count) and can drill into a single party to see only that party's open
orders and remaining quantities.

**Why this priority**: High daily-use value once PO/dispatch data exists, but it is
a read-only view over data already produced by User Stories 1–2, so it is
sequenced after them.

**Independent Test**: Can be fully tested by seeding a few POs and dispatches across
two parties and confirming the dashboard KPIs and the party detail view match the
expected totals and overdue/due-soon classifications.

**Acceptance Scenarios**:

1. **Given** an organization has open and fully-dispatched POs, **When** a user
   opens the dashboard, **Then** they see aggregate KPIs including total remaining
   balance, count of overdue POs, and count of due-soon POs, scoped to their
   organization only.
2. **Given** a user selects a specific party, **When** the party detail view loads,
   **Then** only that party's open orders and remaining quantities are shown.
3. **Given** a PO's Due Date has passed with Remaining Balance > 0, **When** the
   dashboard or party detail view renders, **Then** that PO is classified and
   counted as "Overdue".

---

### User Story 5 - Reports & Export (Priority: P5)

A Manager generates and exports reports: Remaining by Party, Overdue Orders, and
Dispatch History, downloadable as Excel/CSV.

**Why this priority**: Valuable for external sharing and offline analysis, but
depends on the data already surfaced by Stories 1, 2, and 4, so it is lower
priority than the live, in-app views.

**Independent Test**: Can be fully tested by generating each of the three report
types against seeded data and confirming the exported file's row counts and totals
match what the dashboard/party views show.

**Acceptance Scenarios**:

1. **Given** PO and dispatch data exists, **When** a user runs the "Remaining by
   Party" report, **Then** it lists each party with its total remaining balance,
   scoped to the user's organization.
2. **Given** overdue POs exist, **When** a user runs the "Overdue Orders" report,
   **Then** it lists exactly the POs classified as Overdue at run time.
3. **Given** a PO has dispatch history, **When** a user runs "Dispatch History" for
   that PO (or organization-wide), **Then** every recorded dispatch appears with its
   date, quantity, and reference.
4. **Given** any of the three reports, **When** a user chooses to export, **Then**
   a CSV or Excel file downloads containing the same data shown on screen.

---

### User Story 6 - Notifications & Alerts (Priority: P6)

Users receive in-app notifications and email alerts when POs become overdue or
enter the "due soon" window.

**Why this priority**: Improves responsiveness but is not required for the core
transactional workflow or for an MVP demo; it depends on the status calculations
from Story 1.

**Independent Test**: Can be fully tested by advancing a PO's due date into the
"due soon" and then "overdue" windows and confirming an in-app notification and an
email alert are generated for the responsible users.

**Acceptance Scenarios**:

1. **Given** a PO's Due Date enters the "due soon" window with Remaining Balance >
   0, **When** the system evaluates PO statuses, **Then** an in-app notification is
   created for users with access to that PO's organization.
2. **Given** a PO becomes Overdue, **When** the system evaluates PO statuses,
   **Then** an email alert is sent to the organization's notified users in addition
   to the in-app notification.
3. **Given** a PO becomes Fully Dispatched before its due date, **When** the system
   evaluates PO statuses, **Then** no overdue/due-soon notification is generated for
   that PO.

---

### User Story 7 - Audit Log (Priority: P7)

Managers and Owners can review a log of who created, edited, or deleted Parties,
POs, and Dispatches, and when.

**Why this priority**: Important for trust and compliance (per the project
constitution's "Audit Everything Important" principle) but is a secondary,
investigative feature that depends on the primary workflows already existing to
generate events worth logging.

**Independent Test**: Can be fully tested by creating, editing, and deleting
(archiving) a Party, PO, and Dispatch, then confirming each action appears in the
audit log with actor, action, timestamp, and before/after values.

**Acceptance Scenarios**:

1. **Given** a user creates, edits, or archives a Party, PO, or Dispatch, **When**
   the action completes, **Then** an audit log entry is recorded with the actor,
   action type, timestamp, and affected record.
2. **Given** an Owner or Manager opens the audit log, **When** they filter by
   record type, user, or date range, **Then** only matching entries are shown.
3. **Given** a Staff or Viewer user, **When** they attempt to open the audit log,
   **Then** access is denied (Owner/Manager only).

---

### User Story 8 - Billing & Subscription (Priority: P8)

A new organization starts on a free trial, and an Owner can view and change plans
(Starter / Business / Pro) with usage limits on users and active POs, backed by
Stripe.

**Why this priority**: Required for the business to charge customers, but an
organization can fully exercise the product workflow during a trial without
billing enforcement being built first, so this is sequenced near the end of the
MVP scope.

**Independent Test**: Can be fully tested by signing up a new organization,
confirming trial status and expiry date are visible, upgrading to a paid plan
through Stripe checkout, and confirming usage limits for that plan are enforced.

**Acceptance Scenarios**:

1. **Given** a new organization signs up, **When** signup completes, **Then** the
   organization starts on a free trial with a visible trial end date.
2. **Given** an Owner is on the billing screen, **When** they select a plan
   (Starter / Business / Pro), **Then** they are taken through Stripe checkout and,
   on success, the organization's plan and usage limits update accordingly.
3. **Given** an organization is at its plan's user or active-PO limit, **When** an
   Owner or Manager attempts to exceed that limit, **Then** the system prevents the
   action and explains which limit was hit and how to upgrade.

---

### User Story 9 - Super Admin Console (Priority: P9)

An internal Super Admin views all organizations on the platform, suspends or
reactivates an organization's access, and sees basic platform-wide metrics.

**Why this priority**: Internal/operational tooling, not customer-facing value; it
depends on organizations existing from Story 3 and is the lowest priority for
initial launch.

**Independent Test**: Can be fully tested by logging in as a Super Admin, viewing
the list of all organizations across tenants, suspending one, confirming its users
can no longer access the product, then reactivating it.

**Acceptance Scenarios**:

1. **Given** a Super Admin is logged in, **When** they open the platform console,
   **Then** they see a list of all organizations with basic status and usage info.
2. **Given** a Super Admin suspends an organization, **When** any user of that
   organization attempts to log in or act, **Then** access is blocked with a clear
   suspended-account message.
3. **Given** a suspended organization, **When** a Super Admin reactivates it,
   **Then** that organization's users regain normal access immediately.

---

### Edge Cases

- What happens when a dispatch quantity would make Remaining Balance negative? The
  system MUST warn before allowing it (see User Story 1, Scenario 4); it is an
  assumption (see Assumptions) whether it can ever be force-confirmed past the
  warning.
- How does the system handle two users recording dispatches against the same PO at
  nearly the same time (concurrent partial dispatches)? Remaining Balance MUST
  reflect both dispatches correctly with no lost updates.
- What happens when a party with open (non-fully-dispatched) POs is archived? The
  party and its POs remain visible on those POs and in history, but the party no
  longer appears when creating new POs.
- How is "due soon" distinguished from "overdue" when the Due Date is exactly
  today? Today's date counts as "due soon," not yet "overdue."
- What happens to in-flight data (dashboard counts, reports) when a PO or dispatch
  is soft-deleted? Soft-deleted records MUST be excluded from all balance
  calculations, counts, and reports, per the constitution's "No Hard Deletes" and
  "Remaining Balance is Sacred" principles.
- What happens when an organization's free trial expires without upgrading? The
  organization MUST switch to read-only mode (view/export only, no create/edit)
  until it upgrades to a paid plan (see FR-021).
- What happens when currency or timezone is changed after POs already exist? Existing
  records are interpreted/displayed under the organization's current currency and
  timezone settings; no historical currency conversion is performed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST isolate all business data (Parties, Purchase Orders,
  Dispatches, Audit Log, Reports) by organization; no user MUST be able to view,
  search, export, or otherwise access another organization's data.
- **FR-002**: System MUST allow creation of an organization during signup, with a
  company profile including name, logo, currency, and timezone.
- **FR-003**: System MUST allow an Owner to invite users by email and assign one of
  the roles: Owner, Manager, Staff, Viewer.
- **FR-004**: System MUST enforce role-based permissions on every action: Owner
  (full access + billing + user management), Manager (full operational access to
  Parties/POs/Dispatches/Reports), Staff (add dispatches, view data), Viewer
  (read-only). Enforcement MUST happen on the server/data-access side, not only in
  the UI.
- **FR-005**: System MUST allow creating, editing, and archiving Party records with
  Party Code, Party Name, City, Contact Person, and Phone, and MUST support search
  and filter over active parties.
- **FR-006**: System MUST allow creating a Purchase Order under a party with PO
  Number (unique per organization), Material, Ordered Qty, Unit, Order Date, Due
  Date, and Notes.
- **FR-007**: System MUST support filtering Purchase Orders by Party, Status, and
  Date range.
- **FR-008**: System MUST allow recording multiple partial dispatches against a
  single Purchase Order, each with Dispatch Date, Qty, Vehicle/Reference, and
  Remarks, and MUST maintain full dispatch history per PO. The system MUST NOT
  require or force a single full-delivery dispatch.
- **FR-009**: System MUST warn the user when a dispatch quantity would exceed the
  PO's current Remaining Balance, before the dispatch is confirmed.
- **FR-010**: System MUST calculate, in real time and never as a stored/cached
  static value: Total Dispatched (sum of non-deleted dispatches), Remaining
  Balance (Ordered Qty − Total Dispatched), Days to Delivery, and Status (Fully
  Dispatched | Overdue | Due Soon | On Track).
- **FR-011**: System MUST provide a live dashboard showing organization-wide KPIs
  (e.g., total remaining balance, overdue count, due-soon count) and a party-wise
  remaining-balance summary.
- **FR-012**: System MUST provide a party detail view showing only that party's
  open orders and remaining quantities.
- **FR-013**: System MUST provide exportable reports for Remaining by Party,
  Overdue Orders, and Dispatch History, each exportable to Excel/CSV.
- **FR-014**: System MUST generate in-app notifications and email alerts for POs
  entering the Overdue or Due Soon status.
- **FR-015**: System MUST start new organizations on a free trial and support
  Starter, Business, and Pro subscription plans via Stripe, with configurable
  usage limits on number of users and number of active Purchase Orders per plan.
- **FR-016**: System MUST record an audit log entry (actor, action, timestamp,
  affected record) whenever a Party, Purchase Order, or Dispatch is created,
  edited, or deleted, and MUST restrict audit log access to Owner and Manager
  roles.
- **FR-017**: System MUST use soft deletes (a `deleted_at`-style marker) for
  Parties, Purchase Orders, and Dispatches instead of hard deletes, and MUST
  exclude soft-deleted records from active views, calculations, counts, and
  reports while preserving them for audit/history.
- **FR-018**: System MUST provide a Super Admin capability (separate from
  organization roles) to list all organizations, suspend or reactivate an
  organization's access, and view basic platform-wide usage metrics.
- **FR-019**: System MUST allow currency and timezone to be configured
  independently per organization, with no value hard-coded globally.
- **FR-020**: System MUST support the core "create a PO, then record a dispatch"
  workflow (User Story 1) in under 60 seconds of active user time for an
  experienced user, on both desktop and mobile viewports.
- **FR-021**: System MUST switch an organization to read-only mode when its free
  trial ends without an upgrade: existing data remains fully viewable (dashboard,
  reports, history) but creating or editing Parties, Purchase Orders, and
  Dispatches is blocked until the organization upgrades to a paid plan.

### Key Entities

- **Organization**: A tenant of the platform. Attributes: name, logo, currency,
  timezone, plan/subscription status, trial end date. Owns all Parties, Purchase
  Orders, Dispatches, and Users within it.
- **User**: A person with access to one organization (see Assumption on
  single-organization membership) and a role (Owner, Manager, Staff, Viewer), or a
  platform-level Super Admin.
- **Party**: A customer/supplier entity belonging to an Organization. Attributes:
  Party Code, Party Name, City, Contact Person, Phone, archived flag.
- **Purchase Order (PO)**: Belongs to a Party within an Organization. Attributes:
  PO Number (unique per organization), Material, Ordered Qty, Unit, Order Date,
  Due Date, Notes, soft-delete marker. Derives Total Dispatched, Remaining
  Balance, Days to Delivery, and Status from its Dispatches.
- **Dispatch**: Belongs to a Purchase Order. Attributes: Dispatch Date, Qty,
  Vehicle/Reference, Remarks, soft-delete marker.
- **Subscription/Plan**: Belongs to an Organization. Attributes: plan tier
  (Starter/Business/Pro or Trial), usage limits (max users, max active POs),
  billing status.
- **Notification**: Generated for a PO event (Due Soon, Overdue) and delivered
  in-app and/or by email to relevant Organization users.
- **Audit Log Entry**: Records actor, action (create/edit/delete), affected
  entity and record, timestamp, and organization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can sign up, create their organization, and invite a
  teammate in under 5 minutes.
- **SC-002**: An experienced user can create a Purchase Order and record its first
  dispatch in under 60 seconds.
- **SC-003**: Remaining Balance and Status shown to users always match a fresh
  recalculation from dispatch history — verified with zero discrepancies across
  test scenarios that include concurrent dispatches and soft-deleted records.
- **SC-004**: Zero cross-tenant data exposures occur across all tested access
  paths (UI, search, export, reports) for any organization's data.
- **SC-005**: Dashboard KPIs and the party detail view load in under 2 seconds for
  an organization with up to 10,000 Purchase Orders.
- **SC-006**: Users can export any of the three standard reports (Remaining by
  Party, Overdue Orders, Dispatch History) in under 10 seconds for up to 5,000
  rows.
- **SC-007**: At least 95% of POs crossing into Due Soon or Overdue status
  generate a visible in-app notification within 1 hour of the status change.
- **SC-008**: Core workflows (create PO, record dispatch, view dashboard) are
  fully usable on a mobile-sized viewport with no loss of functionality compared
  to desktop.
- **SC-009**: 90% of self-serve organizations can complete a plan upgrade through
  checkout without contacting support.

## Assumptions

- Each User belongs to exactly one Organization (no cross-organization user
  membership) for the MVP; Super Admin accounts are platform-level and separate
  from any single organization.
- "Due Soon" means a PO's Due Date is within the next 3 days (and not yet past);
  "Overdue" means the Due Date has passed with Remaining Balance > 0. This
  threshold is configurable later but defaults to 3 days for MVP.
- The free trial defaults to 14 days unless an Owner is offered a longer
  promotional trial; exact length is a business/configuration decision, not a
  hard product constraint.
- No historical currency conversion is performed if an organization changes its
  currency setting after POs already exist; existing amounts are simply displayed
  under the new setting going forward.
- Mobile support in this MVP means a responsive web application usable on mobile
  browsers, not a native mobile app (native apps are explicitly out of scope).
- Offline usage is not required for MVP; an online connection is assumed, though
  the architecture should not actively preclude future offline support.
- Audit log access is limited to Owner and Manager roles; Staff and Viewer cannot
  view it.
- Notification "relevant organization users" defaults to Owner and Manager roles
  for overdue/due-soon alerts, since they are responsible for delivery follow-up.

## Out of Scope

- Native mobile apps
- WhatsApp / SMS notifications
- Multi-branch / multi-warehouse support
- Custom fields on Parties, POs, or Dispatches
- Public API for customers
- Advanced analytics beyond the defined dashboard KPIs and reports
