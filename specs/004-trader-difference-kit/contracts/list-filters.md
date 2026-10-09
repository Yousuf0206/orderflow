# Contract: Purchase Order List Filters

Covers FR-012 to FR-018 and the R3 performance prerequisite.

## `GET /purchase-orders`

### Query parameters

| Parameter | Type | Existing? | Behaviour |
| --- | --- | --- | --- |
| `party_id` | string | **yes** (`purchase_orders.py:47`) | Restricts to that party. Unknown or other-organization id yields an empty list, never another tenant's rows. |
| `status` | string | **yes** (alias of `status_filter`) | One of `on_track`, `due_soon`, `overdue`, `fully_dispatched`. An unrecognised value yields an empty list rather than being ignored — silently returning everything would make the filter lie. |
| `date_from`, `date_to` | date | **yes** | Unchanged; not surfaced in this feature's UI. |
| `q` | string | **new** | Case-insensitive substring match on `po_number`. Trimmed. Empty or whitespace-only is treated as absent. `%`, `_`, and the escape character MUST be escaped before the pattern is built (R5). |

All parameters combine with AND. Each is independently omittable (FR-014).

### Response

Unchanged shape: a list of `PurchaseOrderOut`, ordered by `due_date`. Adding fields is out of scope.

### Tenant scoping

Every filter applies **after** `tenant.scoped(...)`. A `party_id` belonging to another organization
must not widen the result set by a single row. This is Principle I and is non-negotiable.

### Performance requirement (R3)

The handler MUST compute dispatched totals for the whole result set with a single aggregate query,
via `po_calc.compute_many`. It MUST NOT call `compute` per row.

**Why this is a contract term and not an implementation note**: the current code
(`purchase_orders.py:63` → `_to_out` → `compute` → `total_dispatched`) issues one round trip per
purchase order. At 180 orders against the configured hosted database that is roughly 54 seconds,
which exceeds the client's 12 s deadline many times over and makes SC-005 unreachable. A filter
feature built on that pattern fails its own success criterion on the day it ships.

**Forbidden fix**: a stored `total_dispatched` or `remaining_balance` column on `purchase_orders`.
Principle II forbids a balance that can drift from its dispatch rows. `compute_many` must remain a
live aggregate over `dispatches`. If a future reader optimising this file reaches for a stored
column, this paragraph is the answer.

**Parity requirement**: `compute_many(db, pos)[po.id] == compute(db, po)` for every order, asserted
as a unit test. `status` keeps exactly one definition, in `po_calc.py` (R4).

## Dashboard linkage

`GET /dashboard` MUST derive `overdue_count` from the same `compute`/`compute_many` definition it
uses today (`dashboard.py:28`), and MUST adopt the batched aggregate for the same reason.

FR-017 requires the dashboard Overdue figure and the row count of the list it opens to agree
exactly. Because both read one status definition, agreement is structural rather than coincidental.
A test asserts the two numbers against the same seeded organization, so a future change that
introduces a second definition fails rather than quietly disagreeing.

## Interface contract

- Status, party, and search are held in the URL query string (R6): `/purchase-orders?status=overdue&party_id=…&q=…`.
- The active filter state is visible on screen, and each filter is independently clearable (FR-014,
  FR-015).
- Navigating to an order and back restores the filters — a consequence of the URL, not of stored
  state.
- The dashboard Overdue figure is a link to `/purchase-orders?status=overdue` (FR-017). When the
  count is zero it is not a link, and pressing it cannot open a list presented as an error.
- A filtered list with no matches says **no orders match these filters** and offers to clear them.
  It MUST NOT say "No purchase orders yet" — that sentence means the organization is empty, and
  showing it to a trader with 180 orders reads as data loss (FR-016, Principle XII).
  `PurchaseOrdersList.tsx:75` already distinguishes these two cases for status alone; the
  distinction must survive the addition of party and search.
- Filtering is never applied by hiding rows already delivered to the browser (FR-018). A count the
  user can see must be a count the server produced.
