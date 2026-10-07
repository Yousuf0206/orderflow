# Phase 1 Data Model: Market-Ready Trial Updates

**Date**: 2026-10-08 | **Plan**: [plan.md](./plan.md)

## Scope of change

**No schema change. No migration.** This feature alters configuration, what is
displayed, and how failures resolve. Every entity below already exists; this
document records the fields this feature *reads*, the invariants it must preserve,
and the one new non-persistent value it introduces.

Confirming the absence of a migration matters because the kit's config suggestion
implied new persisted limit values; the plan rejects those (see Complexity
Tracking), so nothing new is stored.

---

## Entities read by this feature

### Organization
`backend/src/models/organization.py`

| Field | Used for |
|-------|----------|
| `id` | Tenant scope on every read (Principle I) |
| `name` | Application shell display (FR-016) |
| `plan_tier` | Current-plan display (FR-005) |
| `trial_ends_at` | Trial end date display (FR-005) |

### Subscription
`backend/src/models/subscription.py`

The authoritative source for every limit figure shown to a user (FR-008).

| Field | Used for |
|-------|----------|
| `organization_id` | Tenant scope |
| `plan_tier` | Plan identity; gates `check_trial_expiry` |
| `trial_ends_at` | Trial end date; read-only lockout evaluation |
| `max_users` | Displayed and enforced user allowance |
| `max_active_pos` | Displayed and enforced active-PO allowance |
| `stripe_customer_id` | **Decides FR-007** — absent means billing management cannot succeed, so the control must not be offered |

**Invariant (FR-008)**: a limit figure rendered anywhere in the UI must originate
from this record for the viewing organization, never from frontend constants.

### Plan limit definitions
`backend/src/models/subscription.py:9` — `PLAN_LIMITS`, `PLAN_PRICES`

Module-level constants, not table rows. The single server-side definition of tier
allowances, consumed by signup, `enforce_usage_limits`, and `GET /plans`.

```text
trial    → 3 users,       25 active POs
starter  → 5 users,      100 active POs
business → 20 users,    1000 active POs
pro      → 1_000_000 users, 1_000_000 active POs   # sentinel for "unlimited"
```

**Invariant (FR-010)**: paid-tier entries remain **enforced** for any organization
placed on them, while being withheld from **display** whenever
`paid_plans_enabled` is false. Enforcement and display are separate concerns; this
feature changes only the latter.

**Note on the sentinel**: `1_000_000` encodes "unlimited" and is translated for
display by `formatLimit` at `frontend/src/pages/marketing/Pricing.tsx:20`. If the
Pricing page's tier cards are removed under FR-002, that translation must not be
lost anywhere else a Pro limit could surface.

### Member / User
`backend/src/models/user.py`

| Field | Used for |
|-------|----------|
| `organization_id` | Tenant scope |
| `email`, `role` | Shell bootstrap (FR-016); member list (FR-032) |
| `invited_at` | Distinguishes invited from accepted (FR-033) |

**Invariant (FR-036)**: an organization must always retain at least one owner. The
guard must hold for removal *and* for self-demotion (spec edge case).

### Party, PurchaseOrder, Dispatch

Read-only for this feature.

**Invariant (FR-022, Principle II)**: remaining balance is
`ordered_qty − SUM(dispatches)`, computed on read and never persisted. This
feature adds no cached or denormalised copy, and no screen may display a remaining
figure obtained any other way.

### Audit Entry

Read-only. Backs FR-040 and FR-041.

---

## New non-persistent value

### `paid_plans_enabled`
`backend/src/core/config.py` — `pydantic-settings`, environment-overridable

| Property | Value |
|----------|-------|
| Type | `bool` |
| Default | `False` |
| Scope | Deployment-wide; **not** tenant data |
| Env var | `PAID_PLANS_ENABLED` |
| Persisted | No |

**Why not tenant data**: it describes whether this deployment's checkout is
verified, which is a property of the deployment, not of any organization. Storing
it per organization would invite per-tenant divergence with no mechanism to keep
it honest.

**Effects when false**:
1. `GET /plans` returns `[]` (see [contracts/public-plans.md](./contracts/public-plans.md)).
2. `POST /billing/checkout-session` and `POST /billing/portal-session` refuse.
3. The UI renders the trial message and offers no paid control (FR-002 … FR-007).

### `trial_length_days` (existing, newly centralised)
`backend/src/core/config.py:27` — default `14`

Already the value signup grants (`backend/src/api/auth.py:44`). This feature makes
it the **only** determiner of trial length:

| Consumer | Now | After |
|----------|-----|-------|
| Signup grant | reads the setting | unchanged |
| `scripts/seed.py:50` | hardcodes `timedelta(days=14)` | reads the setting (FR-011a) |
| Landing copy `Landing.tsx:107` | hardcodes "14-day" | server-reported (FR-011) |
| Pricing copy (description + footnote) | hardcodes "14-day" twice | server-reported (FR-011) |

**Invariant (FR-011, SC-004a)**: changing this one setting changes the granted
length and every stated length together. No surface may state a length as fixed
copy.

**Invariant (spec edge case)**: changing it must not retroactively alter
`trial_ends_at` on organizations that already exist — the value is read at signup
and the resulting date is persisted per organization.

---

## State transitions

Unchanged by this feature, recorded because the UI must represent them honestly.

### Subscription trial lifecycle

```text
                    ┌──────────────────────────────┐
  signup ──────────▶│ trial (active)               │
                    │ trial_ends_at in the future  │
                    └───────────────┬──────────────┘
                                    │ trial_ends_at passes
                                    ▼
                    ┌──────────────────────────────┐
                    │ trial (read-only locked)     │
                    │ check_trial_expiry() blocks  │
                    │ creates and edits            │
                    └──────────────────────────────┘

  → paid tier: unreachable while paid_plans_enabled is false (Principle XIV)
```

`check_trial_expiry` is at `backend/src/services/billing.py:56`.

**UI obligation (FR-027, FR-031)**: the locked state must be communicated clearly
and must not instruct the user to upgrade, because upgrading is impossible. The
current banner at `Billing.tsx:85` says "upgrade to resume", which this feature
must replace.

### Member invitation lifecycle

```text
  invite issued ──▶ pending (invited_at set, status visible per FR-033)
                      │
                      ├── valid acceptance ──▶ active member with invited role
                      └── expired / reused / tampered ──▶ clear refusal (FR-035)
```

On a default deployment `smtp_host` is empty, so no email is delivered and
**pending is the terminal state** until an owner shares the link another way. This
makes FR-033's visible pending status the difference between a working feature and
an apparently broken one.

---

## Validation rules carried by this feature

| Rule | Source | Enforced at |
|------|--------|-------------|
| Active PO count < `max_active_pos` on create | FR-012 | `enforce_usage_limits`, `services/billing.py:49` |
| User count < `max_users` on invite | FR-012 | `enforce_usage_limits`, `services/billing.py:38` |
| Refusal message names the limit reached | FR-012, FR-013 | same, lines 41 and 52 — **wording must stop instructing "Upgrade"** while paid plans are off |
| No create/edit once trial expired | inherited | `check_trial_expiry`, `services/billing.py:56` |
| Dispatch beyond remaining requires confirmation | FR-023 | existing over-dispatch path, verified not rewritten |
| Organization retains an owner | FR-036 | `api/org.py` — extend to cover self-demotion |
| Invalid invitation refused understandably | FR-035 | `api/auth.py:155` |
