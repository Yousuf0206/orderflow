# Contract: Public plans and the paid-plans gate

**Endpoints**: `GET /plans`, `POST /billing/checkout-session`, `POST /billing/portal-session`

**Satisfies**: FR-002, FR-003, FR-006, FR-007, FR-010, FR-011

**Source today**: `backend/src/api/plans.py`, `backend/src/api/billing.py`

---

## `GET /plans`

Public, unauthenticated. Consumed by the marketing Pricing page.

### When `paid_plans_enabled` is false (the default, and the state for this feature)

```http
GET /plans
200 OK
```

```json
{
  "paid_plans_enabled": false,
  "trial_length_days": 14,
  "plans": []
}
```

### When `paid_plans_enabled` is true

```json
{
  "paid_plans_enabled": true,
  "trial_length_days": 14,
  "plans": [
    { "tier": "starter",  "price": "$29/mo",  "max_users": 5,       "max_active_pos": 100 },
    { "tier": "business", "price": "$79/mo",  "max_users": 20,      "max_active_pos": 1000 },
    { "tier": "pro",      "price": "$199/mo", "max_users": 1000000, "max_active_pos": 1000000 }
  ]
}
```

### Contract rules

1. **Shape change is intentional and breaking.** The endpoint currently returns a
   bare array (`backend/src/api/plans.py:8`). It becomes an object so the trial
   length can ride along, avoiding a second public endpoint (research R4, R6). The
   only consumer is `frontend/src/pages/marketing/Pricing.tsx:33`, which this
   feature rewrites anyway.
2. **`plans` MUST be empty whenever `paid_plans_enabled` is false.** Not omitted,
   not populated-but-flagged. An empty list means a client cannot render a tier
   card even by ignoring the flag (FR-010).
3. **`trial_length_days` MUST come from `settings.trial_length_days`**, the same
   value signup grants (FR-011). It is reported regardless of the flag, because
   the trial message is shown in both states.
4. **`max_users: 1000000` is the "unlimited" sentinel**, matching `PLAN_LIMITS`.
   Clients translate it for display; the API does not.
5. **Still unauthenticated.** No tenant data is exposed — these are deployment-wide
   tier definitions, so Principle I is unaffected.

---

## `POST /billing/checkout-session`

### When `paid_plans_enabled` is false

```http
POST /billing/checkout-session
403 Forbidden
```

```json
{ "detail": "Paid plans are not available yet." }
```

### Contract rules

1. **MUST refuse before any Stripe call.** The gate precedes the existing
   `stripe_secret_key` check at `backend/src/api/billing.py:40`, so no Stripe
   object is created and no API key is required to get a correct refusal.
2. **The message MUST be user-presentable.** The current failure path surfaces
   "Set STRIPE_SECRET_KEY and price IDs on the backend" to end users via
   `Billing.tsx:37` — an FR-031 breach (research R3). The refusal text above names
   no environment variable, no vendor, and no server internal.
3. **403, not 404 or 501.** The route exists and the caller is not permitted to use
   it yet. 403 is what the frontend already special-cases for billing access
   (`Billing.tsx:50`), so the error path stays uniform.
4. **This closes the direct-request path.** FR-003 forbids a *reachable* checkout.
   Hiding the button alone would leave the endpoint callable by URL.

---

## `POST /billing/portal-session`

### When `paid_plans_enabled` is false

```http
403 Forbidden
{ "detail": "Billing management is not available yet." }
```

### When enabled but the organization has no `stripe_customer_id`

```http
400 Bad Request
{ "detail": "No billing account on file for this organization." }
```

### Contract rules

1. **A trial organization never has a `stripe_customer_id`**, so this control
   could never succeed for the beta audience. FR-007 therefore resolves to *not
   offering it at all* rather than offering it and failing.
2. **The 400 message MUST NOT instruct an upgrade.** The current fallback says
   "upgrade to a paid plan first" (`Billing.tsx:46`), directing the user to an
   action FR-006 forbids.

---

## `GET /billing` (unchanged shape, one addition)

Already the limits source of truth and already compliant with FR-008. One field is
added so the in-app surface can reason about paid availability without a second
call:

```json
{
  "plan_tier": "trial",
  "trial_ends_at": "2026-10-22T09:14:00Z",
  "is_read_only_locked": false,
  "max_users": 3,
  "max_active_pos": 25,
  "paid_plans_enabled": false
}
```

See [billing-info.md](./billing-info.md) for the full obligations of this response.

---

## Contract tests required

| Test | Asserts |
|------|---------|
| `GET /plans` with flag off | `plans == []`, `paid_plans_enabled == false`, `trial_length_days` present |
| `GET /plans` with flag on | three tiers, each with price and both limits from `PLAN_LIMITS` |
| `GET /plans` trial length tracks the setting | overriding `trial_length_days` changes the response (SC-004a) |
| `POST /billing/checkout-session` with flag off | 403, and no Stripe call is attempted even with `stripe_secret_key` set |
| `POST /billing/portal-session` with flag off | 403 with the non-instructional message |
| Refusal messages | contain no environment variable name, no vendor name, and no "upgrade" instruction |
| `GET /billing` | includes `paid_plans_enabled`; limits still match the organization's `Subscription` row |
