# API Request/Response Examples (frozen for launch hardening)

Captured from the actual Pydantic schemas and live endpoints as of the launch-hardening
pass (2026-10-07). These are the contracts the frontend is built against — if a backend
schema changes, this doc and the frontend payloads must be updated together.

## Auth

### `POST /auth/signup`
```json
// Request
{ "email": "owner@acme.com", "password": "password123", "organization_name": "Acme Trading" }

// 201 Response
{ "access_token": "<jwt>", "refresh_token": "<jwt>", "token_type": "bearer" }

// 409 — duplicate email
{ "detail": "Email already registered" }

// 422 — validation (e.g. password < 8 chars)
{ "detail": [ { "loc": ["body", "password"], "msg": "String should have at least 8 characters", "type": "string_too_short" } ] }
```

### `POST /auth/login`
```json
// Request
{ "email": "owner@acme.com", "password": "password123" }

// 200 Response — same TokenPair shape as signup
// 401 — bad credentials
{ "detail": "Invalid email or password" }
```

### `GET /auth/me` (Bearer token required)
```json
{
  "user": { "id": "...", "email": "owner@acme.com" },
  "organization": { "id": "...", "name": "Acme Trading" },
  "role": "owner",
  "is_super_admin": false
}
```

### `POST /auth/refresh`
```json
// Request
{ "refresh_token": "<jwt>" }
// 200 Response — new TokenPair
// 401 — expired/invalid/wrong-type token
```

## Parties

### `POST /parties`
```json
// Request (city/contact_person/phone optional)
{ "party_code": "P-001", "party_name": "Steel Traders Ltd", "city": "Lahore", "contact_person": "Ali", "phone": "+92..." }

// 201 Response
{ "id": "...", "party_code": "P-001", "party_name": "Steel Traders Ltd", "city": "Lahore", "contact_person": "Ali", "phone": "+92...", "archived_at": null }

// 409 — duplicate party_code
{ "detail": "party_code already in use" }
```

## Purchase Orders

### `POST /purchase-orders`
```json
// Request
{
  "party_id": "...",
  "po_number": "PO-1001",
  "material": "Steel",
  "ordered_qty": 100,
  "unit": "ton",
  "order_date": "2026-01-01",
  "due_date": "2026-02-01",
  "notes": "optional"
}

// 201 Response
{
  "id": "...", "party_id": "...", "po_number": "PO-1001", "material": "Steel",
  "ordered_qty": 100, "unit": "ton", "order_date": "2026-01-01", "due_date": "2026-02-01",
  "notes": null, "total_dispatched": 0, "remaining_balance": 100,
  "days_to_delivery": 25, "status": "on_track"
}

// 403 — plan limit reached (max_active_pos)
{ "detail": "Purchase order limit reached — your trial includes 25 purchase orders. Get in touch and we'll raise it." }

// 403 — read-only lockout (trial expired)
{ "detail": "Your trial has ended, so creating and editing is paused. Your records are still here to view and export — get in touch and we can extend your trial." }
```

## Dispatches

### `POST /purchase-orders/{id}/dispatches`
```json
// Request
{ "dispatch_date": "2026-01-15", "qty": 40, "vehicle_ref": "TRK-12", "remarks": "optional", "confirm": false }

// 200 Response — normal dispatch
{ "dispatch": { "id": "...", "purchase_order_id": "...", "dispatch_date": "2026-01-15", "qty": 40, "vehicle_ref": "TRK-12", "remarks": null }, "warning": null }

// 200 Response — over-dispatch without confirm (not persisted)
{ "dispatch": null, "warning": "This dispatch of 1000 is more than the 60 still remaining on this order. Confirm to record it anyway." }

// 200 Response — over-dispatch with confirm=true (persisted)
{ "dispatch": { "...": "..." }, "warning": null }
```

## Dashboard

### `GET /dashboard`
```json
{
  "total_remaining_balance": 360,
  "overdue_count": 1,
  "due_soon_count": 0,
  "on_track_count": 1,
  "fully_dispatched_count": 0,
  "total_po_count": 2,
  "party_summary": [
    { "party_id": "...", "party_name": "Cement Supply Co", "remaining_balance": 300 }
  ]
}
```

## Billing & Plans

### `GET /billing` (owner only)
```json
{
  "plan_tier": "trial",
  "trial_ends_at": "2026-10-21T00:00:00Z",
  "is_read_only_locked": false,
  "max_users": 3,
  "max_active_pos": 25,
  "current_users": 2,
  "current_active_pos": 7,
  "trial_length_days": 14,
  "paid_plans_enabled": false,
  "has_billing_account": false
}
```

The `current_*` counts are produced by the same helpers that enforce the limits,
so the figures shown to a user are the ones their creates are refused at.
`has_billing_account` is a boolean rather than the Stripe customer id, which
stays server-side.

### `GET /plans` (public, no auth)

An object, not a bare array: the trial length travels with it, because the
marketing Pricing page is served to anonymous visitors who have no `/billing`
to read it from.

```json
// PAID_PLANS_ENABLED=false (the default)
{ "paid_plans_enabled": false, "trial_length_days": 14, "plans": [] }
```

```json
// PAID_PLANS_ENABLED=true
{
  "paid_plans_enabled": true,
  "trial_length_days": 14,
  "plans": [
    { "tier": "starter", "price": "$29/mo", "max_users": 5, "max_active_pos": 100 },
    { "tier": "business", "price": "$79/mo", "max_users": 20, "max_active_pos": 1000 },
    { "tier": "pro", "price": "$199/mo", "max_users": 1000000, "max_active_pos": 1000000 }
  ]
}
```

`plans` is empty while gated rather than populated-and-flagged, so a client
can't render a purchasable tier even by ignoring the flag.

### `POST /billing/checkout-session` and `POST /billing/portal-session`

Both refuse while paid plans are gated, before any Stripe call — so the path is
closed even to a direct request, and configuring a Stripe key doesn't reopen it.

```json
// 403
{ "detail": "Paid plans are not available yet." }
{ "detail": "Billing management is not available yet." }
```

### `POST /org/members/invite` (owner only)
```json
// Request
{ "email": "staff@acme.com", "role": "staff" }
// 403 — plan limit reached (max_users)
{ "detail": "User limit reached — your trial includes 3 users. Remove a member to free up a seat, or get in touch and we'll raise it." }
```

Refusal messages are shown to users verbatim, so they name the limit that
stopped them and avoid instructing an upgrade, which is not currently possible.
