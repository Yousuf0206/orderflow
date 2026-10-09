# Contract: Role-to-Action Permissions

Covers FR-001 to FR-005. One table, read by both the interface and the server.

## The table

| Capability | Owner | Manager | Staff | Viewer | Server enforcement today |
| --- | --- | --- | --- | --- | --- |
| Read parties, orders, dispatches, reports | ✓ | ✓ | ✓ | ✓ | no restriction (reading is open to members) |
| Record a dispatch | ✓ | ✓ | ✓ | ✗ | `dispatches.py:31` — `require_role("owner","manager","staff")` |
| Edit or delete a dispatch | ✓ | ✓ | ✗ | ✗ | `dispatches.py:78` — `require_role("owner","manager")` |
| Create, edit, delete a purchase order | ✓ | ✓ | ✗ | ✗ | `purchase_orders.py:73,113,139` |
| Create, edit, archive a party | ✓ | ✓ | ✗ | ✗ | `parties.py` |
| Manage team and invitations | ✓ | ✗ | ✗ | ✗ | `org.py:58` — invite is Owner only; `org.py:40` — list members is Owner or Manager |
| Manage organization settings | ✓ | ✗ | ✗ | ✗ | `org.py:27` |
| Manage billing | ✓ | ✗ | ✗ | ✗ | `AppShell.tsx:35` gates the nav; billing endpoints restrict |

**This table describes rules the server already enforces.** This feature adds no role and widens no
permission. Every ✗ above is already a refusal; the work is making the interface agree.

Note the asymmetry worth preserving: Staff may **record** a dispatch but may not **edit or delete**
one. A Staff user therefore sees the dispatch form and does not see edit or delete controls on
existing dispatch rows.

## Interface capabilities

`frontend/src/hooks/usePermissions.ts` exposes exactly these, derived from the role on `/auth/me`:

- `canRecordDispatch`
- `canEditDispatch`
- `canManageOrders`
- `canManageParties`
- `canManageTeam`
- `canManageBilling`

Screens MUST consult these rather than comparing role strings inline. `AppShell.tsx:33-36` compares
role literals today; spreading that pattern across the order, party, and settings screens would
scatter the rules so that the next role change is found by whichever screen was forgotten (R10).

## Rendering rules

1. **A forbidden control is absent or disabled with a stated reason — never present and failing**
   (FR-001). Present-and-failing is the defect User Story 1 exists to remove: a Viewer today fills
   in the dispatch form on `PurchaseOrderDetail.tsx` and is refused by the server, with nothing
   having been wrong with what they typed.
2. **Where the forbidden action is the purpose of a region, say which role is required** (FR-002).
   An empty space where a dispatch form belongs reads as a broken page. "Recording dispatches needs
   Staff access or above" reads as a working product with a correct permission boundary.
3. **Hiding is never the only enforcement** (FR-003). The server refuses independently on every
   request. If the two ever disagree, the server is right.
4. **Unknown is a third state, not a default** (FR-004). When `/auth/me` has not resolved or has
   failed, the hook returns unknown. Screens show that permissions could not be confirmed, with a
   retry. They MUST NOT fall back to permissive — a Viewer shown a working form — nor to forbidden
   — an Owner told they lack access. `AppShell.tsx:176` already handles the failed-`/auth/me` case
   as a banner rather than a page error, with a comment noting that losing the role reads as
   "my permissions were taken away"; that judgement extends here.

## Verification

`frontend/tests/e2e/roles.spec.ts` signs in as each role against one seeded organization and asserts
that every control in the table is present or absent as specified, and that no visible control
produces a refusal when pressed (SC-001).

A unit test asserts the capability table itself, so a role rule can be read in one place and
checked without a browser.
