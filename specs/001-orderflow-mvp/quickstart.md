# Quickstart Validation Guide: OrderFlow MVP Core Platform

Validates the P1 critical path end-to-end: sign up, create a party, create a PO,
record a partial dispatch, and confirm Remaining Balance/Status update live. See
[data-model.md](./data-model.md) for field details and [contracts/api.md](./contracts/api.md)
for endpoint shapes.

## Prerequisites

- Backend running locally (FastAPI + PostgreSQL), migrations applied
- Frontend dev server running, pointed at the local backend
- A clean database (or a dedicated test organization)

## Scenario A — Signup & Organization creation (User Story 3)

1. `POST /auth/signup` with email, password, organization name → expect `201` and
   an access + refresh token.
2. `GET /org` with the returned access token → expect the new organization with
   `plan_tier: "trial"` and a `trial_ends_at` in the future.

**Expected outcome**: a single Owner-role user now exists in a brand-new
organization, isolated from any other organization in the database.

## Scenario B — Core workflow: PO + partial dispatch (User Story 1, P1)

1. `POST /parties` with `party_code`, `party_name` → expect `201`.
2. `POST /purchase-orders` under that party with `material`, `ordered_qty: 100`,
   `unit`, `order_date`, `due_date` → expect `201`, response shows
   `remaining_balance: 100`, `status: "on_track"` (or `"due_soon"`/`"overdue"`
   depending on `due_date`).
3. `POST /purchase-orders/{id}/dispatches` with `qty: 40` → expect `201`;
   `GET /purchase-orders/{id}` now shows `total_dispatched: 40`,
   `remaining_balance: 60`.
4. Record a second dispatch with `qty: 60` → `GET /purchase-orders/{id}` now
   shows `remaining_balance: 0`, `status: "fully_dispatched"`.
5. Repeat steps 1–3 with a stopwatch from party-creation-complete to
   dispatch-saved — total active time should be under 60 seconds (SC-002).

**Expected outcome**: Remaining Balance and Status always match a fresh
recalculation from dispatch history (SC-003); no step required a cached balance
to be manually recalculated.

## Scenario C — Over-dispatch warning (Edge Case)

1. With a PO at `remaining_balance: 10`, `POST /purchase-orders/{id}/dispatches`
   with `qty: 15` and no `confirm` flag → expect a `warning` in the response and
   the dispatch NOT persisted.
2. Resubmit the same request with `confirm: true` → expect `201` (business
   decision: user may proceed past the warning).

## Scenario D — Multi-tenant isolation (Principle I / SC-004)

1. Create two organizations (A and B) via Scenario A, each with their own Party
   and PO.
2. Using Organization A's token, attempt `GET /purchase-orders/{B's PO id}` →
   expect `404` (not `403`, to avoid confirming existence — see contracts/api.md).
3. Using Organization A's token, attempt `GET /parties` → expect only
   Organization A's parties in the result, never Organization B's.

## Scenario E — Role enforcement (Principle V)

1. Invite a Staff-role user to Organization A.
2. As that Staff user, `POST /purchase-orders/{id}/dispatches` → expect `201`
   (Staff can add dispatches).
3. As that Staff user, `GET /billing` → expect `403` (Staff cannot manage
   billing).
4. As that Staff user, `GET /audit-log` → expect `403` (Owner/Manager only).

## Scenario F — Soft delete & audit log (Principles VI, VII)

1. `DELETE /purchase-orders/{id}` on a PO with no dispatches → expect `200`/`204`.
2. `GET /purchase-orders` (default list) → the deleted PO MUST NOT appear.
3. `GET /dashboard` KPIs → totals MUST NOT include the deleted PO.
4. `GET /audit-log` (as Owner/Manager) → an entry exists for the delete action
   with actor, timestamp, and entity reference.

## Done when

- [ ] Scenario A–F all produce the expected outcomes above
- [ ] Scenario B's core workflow is confirmed under 60 seconds
- [ ] No scenario in Scenario D ever returns another organization's data
