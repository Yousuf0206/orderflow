# Data Model: Trader Difference Kit

This feature is overwhelmingly about surfaces, not storage. One nullable column is added. Nothing
else in the schema changes, and no existing column changes meaning.

---

## Changed: `memberships`

One column added.

| Field | Type | Nullable | Default | Meaning |
| --- | --- | --- | --- | --- |
| `invitation_email_sent_at` | `timestamptz` | yes | `NULL` | When an invitation email was successfully handed to a mail service for this membership. `NULL` means no email has been successfully dispatched — because none was attempted, because no mail service is configured, or because the attempt failed. |

**Why a timestamp rather than a boolean**: a boolean answers "did it send", a timestamp also answers
"when", which is what an owner asks when a colleague says they never received it. It also
distinguishes a resend from the original.

**Why nullable with no default**: existing memberships predate the column and nothing can be
asserted about whether their invitations were emailed. `NULL` is the honest value for them, and it
is the same value a failed send produces, which is correct — in both cases the truthful statement to
the owner is "we cannot confirm an email reached them".

**Invariant**: `invitation_email_sent_at` MUST NOT be set unless a mail service accepted the
message. It is not set when `email.py` takes the unconfigured path, and it is not set when sending
raises. Setting it optimistically would recreate the exact dishonesty User Story 5 exists to remove.

**Relationship to `invited_at`**: unchanged and distinct. `invited_at` records that the invitation
was created; `invitation_email_sent_at` records that it was delivered to a mail service. The gap
between them is the thing the owner needs to see.

**Migration**: one Alembic revision after `0001_initial`, adding the column. Additive and nullable,
so it is backward compatible and needs no data backfill.

---

## Unchanged, but read differently

### `memberships.role`

Roles remain exactly `owner`, `manager`, `staff`, `viewer` (`models/membership.py:9`). This feature
adds no role and changes no role's powers. What changes is that the interface now reads the role to
decide what to render, through one shared table (`contracts/permissions.md`) rather than inline
literals.

### `dispatches.qty`

Still the sole source of a dispatched total. R3 changes how many queries read it, never that it is
read. There is no new column holding a dispatched or remaining total anywhere in this design, and
`contracts/list-filters.md` records that adding one would be a defect under Principle II.

### `purchase_orders.po_number`

Gains a new access pattern: case-insensitive substring search (R5). No column change. Worth noting
for whoever later looks at indexes: a leading-wildcard `ILIKE` cannot use the existing B-tree index
on `(organization_id, po_number)`. At the organization sizes in scope — hundreds of orders, already
filtered to one tenant — a sequential scan over that subset is cheaper than the round trips R3
removes, so no index is added now. If an organization reaches tens of thousands of orders, a
trigram index is the answer, not a change to the search semantics.

---

## Derived, not stored

These are computed per request and deliberately have no table.

### Purchase Order Calculation

Produced by `services/po_calc.py` as `total_dispatched`, `remaining_balance`, `days_to_delivery`,
`status`. R3 adds a batched producer, `compute_many`, for a set of orders.

**Required invariant**: `compute_many(db, pos)[po.id]` MUST equal `compute(db, po)` for every order,
for every input. This is the one thing in this feature that could silently corrupt a number the
constitution calls sacred, so it is asserted directly as a unit test rather than inferred from
endpoint tests.

`status` has exactly one definition, in `po_calc.py`, parameterised by the organization's
`due_soon_days`. Values: `fully_dispatched`, `overdue`, `due_soon`, `on_track`. FR-035's
cross-surface consistency and FR-017's count agreement both rest on there being no second
definition.

### Purchase Order List Filter

The user's current `status`, `party_id`, and `q` (PO-number search). Held in the URL query string
(R6), not persisted. Not organization data — it is where one person is looking right now.

### Party Remaining Export

A point-in-time view of one party's open orders, computed when requested and not stored. Columns,
fixed by FR-019: party name, PO number, material, ordered quantity, dispatched quantity, remaining
balance, due date. "Open" means `remaining_balance > 0`, matching how the party detail screen and
the existing `remaining-by-party` report already select rows.

### Interface Permissions

Named capabilities derived from the signed-in user's role: `canRecordDispatch`,
`canManageOrders`, `canManageParties`, `canManageTeam`, `canManageBilling`. Derived, never stored,
and never authoritative — the server decides independently on every request (FR-003).

A fourth state matters: the role may be **unknown**, when `/auth/me` has not resolved or has
failed. Unknown MUST NOT collapse to either permitted or forbidden. It renders as "we could not
confirm your permissions" with a retry (FR-004), because a Viewer shown a working form and an Owner
shown a locked one are both wrong, and silently guessing picks one of them.

### Installable Identity

The application's name, short name, icons, theme colour, and launch target, as a mobile browser
needs them to add it to a home screen. Static build output, no runtime state, no storage. Nothing
here caches business data (FR-034).

---

## What is deliberately not modelled

- **No stored dispatched or remaining total.** Principle II.
- **No invitation table.** The pending state is `accepted_at IS NULL` on the membership, which
  already works; a separate invitation entity would duplicate it.
- **No stored invitation token.** The link is a signed, expiring, single-use JWT derived from the
  membership id (`org.py:87`); storing it would create a second thing to expire.
- **No persisted filter preference.** R6.
- **No offline or cached copy of any business record.** R11, FR-034.
