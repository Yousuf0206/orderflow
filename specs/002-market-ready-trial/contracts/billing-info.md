# Contract: Billing info as the single limits source

**Endpoint**: `GET /billing`

**Satisfies**: FR-005, FR-007, FR-008, FR-009, FR-012, FR-013

**Source today**: `backend/src/api/billing.py`, consumed by
`frontend/src/pages/billing/Billing.tsx:24`

---

## Response

```json
{
  "plan_tier": "trial",
  "trial_ends_at": "2026-10-22T09:14:00Z",
  "is_read_only_locked": false,
  "max_users": 3,
  "max_active_pos": 25,
  "current_users": 2,
  "current_active_pos": 7,
  "paid_plans_enabled": false,
  "has_billing_account": false
}
```

### Field obligations

| Field | Obligation |
|-------|-----------|
| `plan_tier` | The organization's actual tier. Displayed as the current plan (FR-005). |
| `trial_ends_at` | Persisted per organization at signup. Null for non-trial tiers. Displayed as the trial end date (FR-005). |
| `is_read_only_locked` | True once the trial has expired, per `check_trial_expiry`. |
| `max_users` | **From the organization's `Subscription` row**, never a client constant (FR-008). |
| `max_active_pos` | Same obligation. |
| `current_users` | **New.** Present usage, so the UI can show "2 of 3" without counting client-side. |
| `current_active_pos` | **New.** Same rationale. |
| `paid_plans_enabled` | **New.** Deployment flag, so the UI need not infer paid availability. |
| `has_billing_account` | **New.** Whether a `stripe_customer_id` exists. Decides FR-007 without exposing the identifier itself. |

### Contract rules

1. **This response is the only limits source for authenticated UI.** No screen may
   render a limit from a frontend constant or from `GET /plans`. `Billing.tsx:98`
   already complies; the obligation now applies to any limit warning too (FR-009).
2. **`current_*` counts MUST be computed the same way enforcement counts.** If
   `enforce_usage_limits` counts active POs by a given definition
   (`backend/src/services/billing.py:49`), this endpoint must use that same
   definition. A display count that diverges from the enforcement count would show
   "7 of 25" to a user who is actually blocked — the precise failure FR-008 exists
   to prevent.
3. **`has_billing_account` MUST NOT expose the Stripe customer identifier.** The
   UI needs only the boolean to decide whether to offer billing management.
4. **Owner-only access is preserved.** The existing 403 for non-owners and the
   `AccessDenied` treatment at `Billing.tsx:50` stay as they are (Principle V).

---

## Limit refusal contract

When `enforce_usage_limits` blocks a create, the refusal must be presentable
as-is. Current messages instruct an unavailable action (research R5):

| Situation | Now (`services/billing.py`) | Required |
|-----------|------------------------------|----------|
| User limit reached | `"User limit (3) reached for the trial plan. Upgrade to add more users."` | `"User limit reached — your trial includes 3 users."` |
| Active PO limit reached | `"Active PO limit (25) reached for the trial plan. Upgrade to add more."` | `"Active PO limit reached — your trial includes 25 active purchase orders."` |

### Rules

1. **The message MUST name the limit that was reached**, with the number (FR-012).
2. **The message MUST NOT instruct an upgrade** while `paid_plans_enabled` is
   false (FR-006, FR-013). It may state what the trial includes.
3. **The number in the message MUST equal the enforced value**, which means
   interpolating from the `Subscription` row, not from copy (FR-008).
4. **The blocked record MUST NOT be created** (FR-012).
5. **The UI MUST surface the server's message**, not a generic fallback.
   `describeApiError` (`frontend/src/services/apiClient.ts:36`) already returns a
   string `detail` verbatim, so this works once the message text is right.

### Status code

Limit refusals are **403**. `describeApiError` returns the `detail` string for any
status below 500, so the message reaches the user either way; 403 is chosen over
422 because the request is well-formed and the refusal is about entitlement, not
validation. The kit suggested "403/422"; this contract settles on one so the
frontend has a single path to handle.

---

## Read-only lockout copy

When `is_read_only_locked` is true and `paid_plans_enabled` is false, the UI must
not instruct an upgrade. The current banner reads "upgrade to resume creating and
editing records" (`Billing.tsx:85`).

Required: state the condition and what remains possible — the user can still read
their data — without naming an action they cannot take.

---

## Contract tests required

| Test | Asserts |
|------|---------|
| `GET /billing` as owner on trial | all fields present; `max_users`/`max_active_pos` match the `Subscription` row |
| `GET /billing` as non-owner | 403 |
| `current_users` / `current_active_pos` | equal the counts `enforce_usage_limits` uses, verified by creating records up to the limit |
| Invite at user limit | 403; message names the limit; contains no "upgrade"; member not created |
| Create PO at active-PO limit | 403; message names the limit; contains no "upgrade"; order not created |
| `has_billing_account` on a trial org | false |
| Expired trial | `is_read_only_locked` true; creates refused |
