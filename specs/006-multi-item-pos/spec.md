# Feature Specification: Multi-item Purchase Orders

**Feature Branch**: `006-multi-item-pos`

**Created**: 2026-10-12

**Status**: Accepted (2026-10-12; FR-001–FR-015 frozen)

**Input**: User description: "Multi-item Purchase Orders (006). Replace the one-material-per-PO
model with header + lines so a trader can record a real multi-item PO and partial dispatches
without creating fake PO numbers." (full brief: FR-001–FR-014 and non-goals, supplied 2026-10-12)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record one paper PO as one OrderFlow PO with many items (Priority: P1)

A trader receives a purchase order listing cement, steel bars, and sand. They create one
OrderFlow purchase order with the party, PO number, dates, and notes, then add one line per
material with its quantity and unit. The PO detail shows every line with ordered, dispatched,
and remaining.

**Why this priority**: Without multi-line create there is nothing for the other stories to act
on, and today the trader must invent fake PO numbers to represent one real order.

**Independent Test**: Create a PO with three lines in different units; open its detail and see
three lines, each with remaining equal to ordered.

**Acceptance Scenarios**:

1. **Given** a party exists, **When** the user creates a PO with three lines (50 tonne steel,
   200 bag cement, 10 truck sand), **Then** one PO is saved with three lines in the entered
   order, each showing dispatched 0 and remaining equal to ordered.
2. **Given** the create form, **When** the user adds a line, then removes it, **Then** the
   removed line is not saved and the remaining lines keep their order.
3. **Given** the create form has one line, **When** the user tries to remove it, **Then** the
   form prevents removal; a PO cannot be submitted with zero lines.
4. **Given** a line with quantity 0, a negative quantity, or no material or unit, **When** the
   user submits, **Then** the error is shown on that line's field and nothing is saved.
5. **Given** a PO number already used in the organization, **When** the user submits, **Then**
   the PO number field shows a duplicate error.

---

### User Story 2 - Record one truck load against several lines (Priority: P1)

A truck leaves carrying 20 tonnes of steel and 100 bags of cement for the same PO. The user
records one dispatch with the date, vehicle, and remarks, entering a quantity for steel and
cement and leaving sand blank. Each line's remaining updates.

**Why this priority**: Partial multi-line dispatch is the reason to have lines at all; remaining
per line is the product's core promise.

**Independent Test**: On the PO from Story 1, record one dispatch for two of three lines; steel
remaining becomes 30, cement 100, sand unchanged at 10, and history shows one dispatch with two
line entries.

**Acceptance Scenarios**:

1. **Given** a three-line PO, **When** the user records one dispatch with quantities on two
   lines and the third blank, **Then** one dispatch is saved with two dispatch lines and only
   those two lines' remaining change.
2. **Given** a dispatch form with every quantity blank or 0, **When** the user submits,
   **Then** the system rejects it with a message that at least one line needs a quantity.
3. **Given** a line with 30 remaining, **When** the user enters 40 for it, **Then** the system
   warns, naming that line and its remaining, and saves nothing until the user confirms —
   the same warn-then-confirm policy used for single-material POs today.
4. **Given** quantities on two lines where only one exceeds its remaining, **When** the user
   submits, **Then** the warning names only the exceeding line.
5. **Given** a line with 30 remaining, **When** the user dispatches exactly 30, **Then** no
   warning appears and that line's remaining becomes 0.
6. **Given** a dispatch with several lines, **When** the user views dispatch history, **Then**
   the dispatch shows its date, vehicle, remarks, and each line's material, unit, and quantity.

---

### User Story 3 - Existing data keeps working after the change (Priority: P1)

An existing customer has single-material POs with dispatches recorded. After the release each
old PO appears as a PO with one line, every dispatch is still there, and every remaining
balance is exactly what it was.

**Why this priority**: Existing balances are what customers rely on; losing or changing one
breaks trust in every number (constitution XXXI).

**Independent Test**: On a copy of pre-change data, record each PO's remaining and dispatch
history, apply the change, and compare: counts, quantities, dates, and remaining are identical.

**Acceptance Scenarios**:

1. **Given** a pre-change PO for 100 bag cement with dispatches of 40 and 25, **When** the
   change is applied, **Then** the PO has one line of 100 bag cement, two dispatches each with
   one line (40, 25), and remaining 35.
2. **Given** a soft-deleted pre-change PO or dispatch, **When** the change is applied,
   **Then** it remains soft-deleted and excluded from remaining, as before.
3. **Given** the change fails partway, **When** the application starts, **Then** it refuses to
   run against the half-changed data and reports the failure, rather than serving errors.

---

### User Story 4 - See status, dashboard, and party views without mixed units (Priority: P2)

The user scans the PO list, dashboard, and a party's page. Status reflects all lines, and no
screen adds tonnes to bags.

**Why this priority**: Status and summaries are how traders find what needs chasing, but they
are usable only once Stories 1–2 exist.

**Independent Test**: With a PO whose steel line is fully dispatched but cement is not and due
date passed, the list shows it overdue; the dashboard shows counts and per-unit figures, never
a single mixed total.

**Acceptance Scenarios**:

1. **Given** a PO with every line remaining ≤ 0, **Then** its status is fully dispatched,
   regardless of due date.
2. **Given** a PO with any line remaining > 0 and due date before today, **Then** its status is
   overdue; within the existing due-soon window it is due soon; otherwise on track.
3. **Given** the PO list filtered by status, **Then** the filter uses this derived status.
4. **Given** the PO list, **Then** each PO shows its item count or a short material summary
   rather than a single material name.
5. **Given** the dashboard, **Then** it shows counts (open, overdue, due soon) and remaining
   only per unit or per line; no single remaining figure combines different units.
6. **Given** a party's page, **Then** remaining is listed per line, or per PO with totals
   grouped by unit.

---

### User Story 5 - Export one row per line (Priority: P2)

The user exports remaining or overdue orders to a spreadsheet and gets one row per PO line,
so filtering by material or unit works.

**Why this priority**: Export is one of the shipped trust capabilities (constitution XXI) and
must stay correct under the new model.

**Independent Test**: Export remaining for the Story 1 PO and get three rows with the same PO
number; export overdue with nothing overdue and get a file with only the header row.

**Acceptance Scenarios**:

1. **Given** a three-line PO, **When** the user exports remaining, **Then** the file has three
   data rows repeating PO number and party, each with material, unit, ordered, dispatched,
   remaining, due date, and status.
2. **Given** no matching data, **When** the user exports, **Then** the file contains the header
   row and no data rows — never a blank file.
3. **Given** a dispatch-history export, **Then** a multi-line dispatch appears as one row per
   dispatch line.

---

### User Story 6 - Marketing says only what production does (Priority: P3)

Landing and beta copy describe multi-item POs and per-line remaining only after the deployed
smoke check for this feature passes on production.

**Why this priority**: Required before announcement, but does not block building the feature.

**Independent Test**: Before the production smoke passes, no public copy mentions multi-item
POs (or it states the single-material limitation); after it passes, copy is updated.

**Acceptance Scenarios**:

1. **Given** the production smoke (multi-line create → partial multi-line dispatch → remaining
   per line) has not passed, **Then** no landing, beta, or announcement text claims multi-item
   support.
2. **Given** it has passed and is recorded, **Then** landing and beta copy may describe
   multi-item POs and per-line remaining, with screenshots matching the deployed UI.

### Edge Cases

- A dispatch referencing a line from a different PO, or a line of another organization, is
  rejected and nothing is saved.
- The same line entered twice in one dispatch is rejected (or its quantities are rejected as
  ambiguous); one dispatch has at most one entry per line.
- Two lines with the same material but different units are allowed and kept separate.
- Decimal quantities follow the existing rounding rules; a line with remaining within rounding
  of zero counts as fully dispatched.
- A PO at the plan's active-PO limit can still have any number of lines; creating another PO is
  blocked by the limit regardless of line count.
- Deleting (soft-deleting) a dispatch restores remaining on every line it covered.
- A user without permission to record dispatches sees per-line remaining but not the dispatch
  form, as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A purchase order MUST consist of a header — party, PO number, order date, due
  date, optional notes — belonging to one organization; tenant isolation is unchanged and the
  PO number MUST remain unique within an organization.
- **FR-002**: A purchase order MUST have one or more lines, each with material, ordered quantity
  greater than zero, unit, and a stable display position. Creating a PO MUST require at least
  one line; the user MUST be able to add and remove lines while creating. No action MAY leave
  an active PO with zero lines.
- **FR-003**: For each line, dispatched MUST equal the sum of that line's non-deleted dispatch
  quantities and remaining MUST equal ordered minus dispatched, computed live and never stored.
  Both MUST be shown on PO detail and in line-level lists and exports.
- **FR-004**: A dispatch MUST have one date, an optional vehicle/reference, optional remarks,
  one target PO, and one or more dispatch lines each naming a line of that PO and a quantity
  greater than zero. Dispatching a subset of lines and less than a line's remaining MUST be
  allowed.
- **FR-005**: Over-dispatch MUST be evaluated per line using today's policy: a quantity that
  would take a line's remaining below zero produces a warning naming each such line and its
  remaining, and nothing is saved until the user confirms.
- **FR-006**: PO status MUST be derived from its lines: fully dispatched when every line's
  remaining ≤ 0; otherwise overdue if the due date has passed, due soon within the existing
  window, else on track. Status filters MUST use this derived status.
- **FR-007**: The create-PO form MUST present header fields and an editable line table with
  add and remove actions; validation errors MUST be shown on the specific field or line.
- **FR-008**: PO detail MUST list each line's material, unit, ordered, dispatched, and remaining;
  the record-dispatch form MUST take shared date/vehicle/remarks and a quantity per line, where
  blank or 0 means the line is not on this truck; dispatch history MUST show each dispatch's
  breakdown by line.
- **FR-009**: The PO list MUST show item count or a short material summary per PO. No
  dashboard, party view, or summary MAY display a single remaining figure combining different
  units; permitted forms are counts, per-unit totals, and line-level tables.
- **FR-010**: Remaining, overdue, and dispatch-history exports MUST produce one row per PO line
  (or per dispatch line, for history) with at least PO number, party, material, unit, ordered,
  dispatched, remaining, due date, and status as applicable. An export with no data MUST still
  contain its header row.
- **FR-011**: Every existing PO MUST become a header with exactly one line carrying its
  material, ordered quantity, and unit; every existing dispatch MUST become a dispatch with one
  dispatch line on that sole line with the same quantity. Quantities, dates, soft-delete state,
  and remaining MUST be unchanged. The change MUST be rehearsed on a copy of pre-change data
  before production, and superseded per-PO and per-dispatch material/quantity fields MAY be
  retired only after that verification.
- **FR-012**: The active-PO plan limit MUST count purchase orders, not lines.
- **FR-013**: Landing and beta copy MUST NOT claim multi-item support until the production smoke
  for this feature has passed and been recorded; afterwards it MUST be updated to describe
  multi-item POs and per-line remaining.
- **FR-014**: Automated checks MUST cover multi-line create, dispatch of a subset of lines,
  per-line remaining and status, the per-line over-dispatch warning, the data change against a
  pre-change fixture, and empty and non-empty line-row export shape. The deployed smoke check
  MUST include multi-line create → partial multi-line dispatch → remaining per line.
- **FR-015**: Creating, editing, or deleting PO lines and dispatch lines MUST be audit-logged
  and use soft deletes, as for POs and dispatches today.

### Key Entities

- **Purchase Order (header)**: one real-world order from a party; PO number, order date, due
  date, notes; owns its lines and dispatches; status derived from lines.
- **Purchase Order Line**: one material on a PO; material, ordered quantity, unit, position;
  dispatched and remaining derived from dispatch lines.
- **Dispatch (header)**: one truck load / delivery event against one PO; date, vehicle or
  reference, remarks.
- **Dispatch Line**: quantity of one PO line carried on one dispatch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a three-line PO in under 90 seconds and record a dispatch
  covering two lines in under 60 seconds, on desktop and on a 390px phone viewport.
- **SC-002**: After the data change, 100% of pre-existing POs and dispatches are present with
  identical quantities, dates, and remaining, verified on a copy of production data.
- **SC-003**: Zero screens or exports display a remaining figure that combines different units.
- **SC-004**: Every export, including empty ones, opens with its column headers.
- **SC-005**: The production smoke (multi-line create → partial multi-line dispatch → per-line
  remaining) passes and is recorded before any multi-item claim is published.
- **SC-006**: A trader with a real multi-material order no longer needs more than one PO number
  to record it.

## Assumptions

- Editing lines of an existing PO (adding, removing, or changing quantity after create) is out
  of scope for 006; the minimum is create plus detail. Header editing behaves as today. A
  dedicated delete-PO flow is unchanged.
- The over-dispatch policy remains warn-then-confirm, as it is for single-material POs today.
- The existing due-soon window and rounding rules are reused unchanged.
- PDF exports follow the same line-grained layout as CSV.
- Existing role permissions apply unchanged: whoever may record a dispatch today may record a
  multi-line dispatch.
- Out of scope: split shipment across warehouses, serial/batch tracking, pricing, taxes,
  per-line due dates, inventory, and merging historical POs.
