# API Contracts: OrderFlow MVP Core Platform

REST/JSON over HTTPS. All endpoints except `auth/*` and `signup` require a valid
JWT access token. All endpoints except Super Admin (`/admin/*`) and `auth/*`
implicitly scope to the caller's `organization_id` (resolved server-side from the
token/membership — never accepted as a client-supplied parameter). Role
requirements are noted per endpoint; enforcement happens server-side (FR-004).

## Auth

| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/auth/signup` | public | Creates User + Organization (as Owner), starts trial |
| POST | `/auth/login` | public | Returns access + refresh token |
| POST | `/auth/refresh` | public (valid refresh token) | Rotates refresh token, issues new access token |
| POST | `/auth/password-reset/request` | public | Emails a signed, time-limited reset link |
| POST | `/auth/password-reset/confirm` | public (valid reset token) | Sets new password |

## Organization & Team

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/org` | any member | Company profile (name, logo, currency, timezone, plan) |
| PATCH | `/org` | owner | Update company profile |
| GET | `/org/members` | owner, manager | List members + roles |
| POST | `/org/members/invite` | owner | Invite by email + role |
| PATCH | `/org/members/{id}` | owner | Change role |
| DELETE | `/org/members/{id}` | owner | Remove member (soft) |

## Parties

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/parties` | any member | Search/filter, excludes archived + soft-deleted by default |
| POST | `/parties` | owner, manager | Create |
| GET | `/parties/{id}` | any member | Detail view: includes that party's open orders + remaining quantities (FR-012) |
| PATCH | `/parties/{id}` | owner, manager | Edit |
| POST | `/parties/{id}/archive` | owner, manager | Archive (soft-hide, not deleted_at) |

## Purchase Orders

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/purchase-orders` | any member | Filter by party, status, date range (FR-007); each item includes computed `total_dispatched`, `remaining_balance`, `days_to_delivery`, `status` |
| POST | `/purchase-orders` | owner, manager | Create under a party; `po_number` unique per org |
| GET | `/purchase-orders/{id}` | any member | Detail incl. dispatch history |
| PATCH | `/purchase-orders/{id}` | owner, manager | Edit |
| DELETE | `/purchase-orders/{id}` | owner, manager | Soft delete |

## Dispatches

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/purchase-orders/{po_id}/dispatches` | any member | Full history (FR-008) |
| POST | `/purchase-orders/{po_id}/dispatches` | owner, manager, staff | Create partial dispatch; response includes a `warning` field if qty exceeds remaining balance (FR-009) — client must re-submit with `confirm: true` to proceed past the warning |
| DELETE | `/purchase-orders/{po_id}/dispatches/{id}` | owner, manager | Soft delete |

## Dashboard & Reports

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/dashboard` | any member | Org-wide KPIs (total remaining balance, full status breakdown: `on_track_count`, `due_soon_count`, `overdue_count`, `fully_dispatched_count`, `total_po_count`) + party-wise remaining-balance summary (FR-011) |
| GET | `/reports/remaining-by-party` | any member | FR-013 |
| GET | `/reports/overdue-orders` | any member | FR-013 |
| GET | `/reports/dispatch-history` | any member | FR-013 |
| GET | `/reports/{report}/export` | any member | `?format=csv|xlsx`, streams file download |

## Notifications

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/notifications` | any member | In-app notifications for the caller |
| POST | `/notifications/{id}/read` | any member | Mark read |

## Billing

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/billing` | owner | Current plan, trial status, usage vs. limits |
| POST | `/billing/checkout-session` | owner | Creates a Stripe Checkout session for a plan tier |
| POST | `/billing/portal-session` | owner | Creates a Stripe Customer Portal session |
| POST | `/billing/webhook` | Stripe (signature-verified, not user-authenticated) | Syncs Subscription/Plan state from Stripe events |

## Audit Log

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/audit-log` | owner, manager | Filter by entity type, user, date range (FR-016) |

## Super Admin (platform-level, separate auth scope)

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/admin/organizations` | super_admin | List all organizations across tenants |
| POST | `/admin/organizations/{id}/suspend` | super_admin | FR-018 |
| POST | `/admin/organizations/{id}/reactivate` | super_admin | FR-018 |
| GET | `/admin/metrics` | super_admin | Basic platform-wide usage metrics |

## Common error shape

```json
{
  "error": {
    "code": "string_machine_readable_code",
    "message": "human readable message",
    "field_errors": { "field_name": "message" }
  }
}
```

`403` is returned for role/permission failures and for any cross-tenant access
attempt (the API never reveals whether a resource exists in another
organization — it returns the same `404` as "not found" to avoid leaking
tenant existence, consistent with Principle I).
