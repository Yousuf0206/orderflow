# Quickstart: Validating Market-Ready Trial Updates

**Date**: 2026-10-08 | **Plan**: [plan.md](./plan.md)

This is the validation runbook for feature 002. It proves the feature works
end to end and supplies the pre-deploy gate required by constitution Principle
XIII. It is not an implementation guide — see `tasks.md` (produced by
`/speckit-tasks`) for that.

**Principle X obligation**: an API-level pass does **not** discharge these
scenarios. Every core-loop check below must be performed through the browser.

---

## Prerequisites

```bash
# Backend — from backend/
python -m venv .venv && .venv/Scripts/activate      # Windows
pip install -e ".[dev]"
alembic upgrade head

# Frontend — from frontend/
npm install
```

### Environment for this feature

```bash
PAID_PLANS_ENABLED=false     # the state this feature validates
TRIAL_LENGTH_DAYS=14         # already defaults to 14 in config.py
```

Leave `STRIPE_SECRET_KEY` **unset**. The refusal path must be correct without
it — if a Stripe key is needed to get a correct refusal, the gate is in the wrong
place (see [contracts/public-plans.md](./contracts/public-plans.md) rule 1).

Leave `SMTP_HOST` unset for the invitation scenario, so the pending-member path
is what gets validated — that is the default-deployment reality
(research [R7](./research.md)).

### Run

```bash
# backend/
uvicorn src.main:app --reload --port 8000

# frontend/
npm run dev
```

---

## Scenario 1 — The core loop (FR-014 … FR-026, SC-001, SC-002, SC-008)

**Must be performed in a browser, against a brand-new organization.**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open `/signup`, register with a new email and an organization name | Session established; lands on onboarding or dashboard — not a blank page |
| 2 | Observe the application shell | Organization name, role, and email are populated (FR-016) |
| 3 | Open the dashboard before creating anything | Empty state naming the next action — **not** a blank panel or a persistent skeleton (FR-025) |
| 4 | Create a party | Party detail opens showing the saved party (FR-018) |
| 5 | Create a purchase order, ordered quantity **100**, selecting that party from the dropdown | Order created; detail shows Ordered 100, Dispatched 0, Remaining 100 (FR-019, FR-020) |
| 6 | Record a dispatch of **30** | Without reloading: Dispatched 30, Remaining 70, and the dispatch appears in history (FR-021) |
| 7 | Attempt a dispatch of **80** | Over-dispatch warning; explicit confirmation required (FR-023) |
| 8 | Cancel that attempt, then open the dashboard | Totals and party-wise remaining agree with 30 dispatched (FR-024, SC-008) |
| 9 | Compare Remaining on dashboard, party detail, and order detail | All three agree (SC-008) |
| 10 | Log out | Session cleared; no authenticated route reachable; `localStorage` has no `orderflow_tokens` (FR-017) |

**SC-002 requires 10 consecutive passes on clean organizations.** Run this
automated:

```bash
# frontend/
npm run test:e2e
```

---

## Scenario 2 — No reachable paid path (FR-001 … FR-007, FR-010)

| # | Action | Expected |
|---|--------|----------|
| 1 | Open `/` as an anonymous visitor | Only free-trial CTAs; no Buy or Subscribe (FR-001) — already passing today |
| 2 | Open `/pricing` | Single trial message stating trial length, no credit card, paid plans coming soon (FR-002) |
| 3 | Look for a tier selector on `/pricing` | No Starter / Business / Pro card, and no enabled control that begins checkout (FR-003, FR-010) |
| 4 | `curl` the public plans endpoint | `plans: []`, `paid_plans_enabled: false`, `trial_length_days` present |
| 5 | Sign in as an owner, open `/billing` | Current plan "Trial" and the trial end date (FR-005) |
| 6 | Look for an upgrade action on `/billing` | Absent, or visibly disabled and labelled coming soon, and not activatable (FR-006) |
| 7 | Look for "Manage billing" | Absent — a trial org has no billing account (FR-007) |
| 8 | Attempt checkout directly, bypassing the UI | 403 with a user-presentable message; **no** mention of `STRIPE_SECRET_KEY` (FR-003, FR-031) |

```bash
curl -s localhost:8000/plans | jq
curl -s -X POST localhost:8000/billing/checkout-session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_tier":"starter"}' | jq
```

**Step 8 is the one step here that must be done outside the browser**, because its
purpose is to prove the path is closed even when the UI is bypassed.

---

## Scenario 3 — Nothing loads forever (FR-027 … FR-031, SC-005)

The defect being fixed: when a query fails, `isLoading || !data` is still true, so
the loading header renders permanently (research [R1](./research.md)).

**Induce each failure with the backend running**, using browser devtools → Network
to block or stall the request, or by stopping the backend between steps.

| # | Screen | Condition | Expected |
|---|--------|-----------|----------|
| 1 | Party detail | request fails | Error message + retry. **Never** "Loading party…" |
| 2 | Purchase order detail | request fails | Error message + retry. **Never** "Loading purchase order…" |
| 3 | Dashboard | request fails | Error + retry |
| 4 | Parties list | request fails | Error + retry |
| 5 | Purchase orders list | request fails | Error + retry |
| 6 | Purchase order form | party dropdown request fails | Error surfaced — not an empty dropdown that looks like "no parties" |
| 7 | Any of the above | request **stalls** (never settles) | Terminal error state within 15 s (SC-005) |
| 8 | Any error state | activate retry | Request re-issued; resolves to data or error again (FR-029) |
| 9 | Every list and detail screen | request succeeds, zero records | Empty state naming a next action (FR-030) |
| 10 | Every error message above | read as a non-technical trader | Understandable; no status code alone, no stack trace, no "AbortError", no env var name (FR-031) |

**Step 7 is the stall case** and is the one most likely to be missed: a screen can
handle `isError` correctly and still hang forever if the request never settles.
Verify the request is actually **aborted**, not merely ignored.

**Mobile check (Principle VIII)**: repeat steps 1, 3, and 9 at a phone viewport.
Error and empty states must render without horizontal overflow.

---

## Scenario 4 — Limits tell the truth (FR-008 … FR-013, SC-004)

Trial allowances are 3 users and 25 active POs
(`backend/src/models/subscription.py:9`).

| # | Action | Expected |
|---|--------|----------|
| 1 | Open `/billing` | Limits shown are 3 users / 25 active POs, from the API not from copy (FR-008) |
| 2 | Compare against any limit warning elsewhere | Identical figures (FR-009) |
| 3 | Invite members until the 3rd user exists, then invite one more | Refused with a message naming the user limit; **no "Upgrade"** instruction; member not created (FR-012, FR-013) |
| 4 | Create active POs up to 25, then create one more | Refused with a message naming the PO limit; no "Upgrade"; order not created (FR-012) |
| 5 | Read both refusals | Trader-readable; names the number; does not instruct an unavailable action |
| 6 | Check displayed usage counts against the blocking point | "n of 3" agrees with where enforcement actually blocked (contract rule 2) |

### Trial-length coupling (FR-011, FR-011a, SC-004a)

| # | Action | Expected |
|---|--------|----------|
| 7 | Set `TRIAL_LENGTH_DAYS=21`, restart the backend, reload `/pricing` | Public copy states 21 days — **no surface still says 14** |
| 8 | Sign up a new organization | Trial end date is 21 days out |
| 9 | Run the seed script | Seeded orgs get 21 days, not a hardcoded 14 (FR-011a) |
| 10 | Check an organization created before the change | Its existing `trial_ends_at` is unchanged (spec edge case) |

Reset to 14 afterwards.

---

## Scenario 5 — The beta bar is honest (FR-032 … FR-043)

| # | Action | Expected |
|---|--------|----------|
| 1 | Open Team as an owner | Members listed with role and status (FR-032) |
| 2 | Invite by email with a role, **`SMTP_HOST` unset** | Invite issued; invitee appears with a clearly pending status (FR-033). No email arrives — the pending status is what must carry the information |
| 3 | Accept the invitation using the link | Access granted with the invited role; status reflects acceptance (FR-034) |
| 4 | Re-use the same invitation link | Clear refusal, not an unhandled error (FR-035) |
| 5 | As the sole owner, attempt to remove yourself | Refused with an explanation (FR-036) |
| 6 | As the sole owner, attempt to **demote** yourself | Also refused — the guard must cover demotion, not only removal (spec edge case) |
| 7 | Open Reports | Remaining by party visible (FR-037) |
| 8 | Export CSV, then Excel, then PDF | All three download real files of the right type (FR-038, FR-039) — all three work server-side today |
| 9 | Export while the backend returns an error (stop it, or revoke the token) | Error shown; **no file downloaded**. A JSON error body must never land as `report.csv` (FR-031) |
| 10 | Export a report with no rows | Valid empty file or a clear message — not a corrupt download (spec edge case) |
| 11 | Open Audit Log after creating records | Readable list of recent creates and updates (FR-040) |
| 12 | Open Audit Log on a fresh organization | Readable empty state (FR-041) |
| 13 | Walk onboarding | Steps describe things that exist (FR-042); primary action leads to creating a party; skip leads to the dashboard (FR-043) |

---

## Scenario 6 — Trust and polish (FR-044 … FR-046)

| # | Action | Expected |
|---|--------|----------|
| 1 | From signup, pricing, billing, and a page footer | Privacy and Terms both reachable from each (FR-044) |
| 2 | Read both documents | Internally consistent; no placeholder contact address where a real one exists (FR-045) — note `email_from` defaults to `no-reply@orderflow.example` |
| 3 | Inspect each public page | Title, description, social preview, and site icon present (FR-046) |

---

## Scenario 7 — Expired trial (spec edge case)

| # | Action | Expected |
|---|--------|----------|
| 1 | Set an organization's `trial_ends_at` to the past | — |
| 2 | Sign in and open the dashboard | Clear statement that the trial ended and what state the account is in |
| 3 | Attempt to create a party | Refused with an understandable message, not a silent failure |
| 4 | Read the lockout message | Must **not** instruct an upgrade, since upgrading is impossible (FR-006). The current text says "upgrade to resume" and must change |
| 5 | Confirm read access | Existing data still viewable |

---

## Pre-deploy gate (Principle XIII, FR-026, SC-010)

Before any production deploy:

```bash
# backend/
pytest

# frontend/
npm run test -- --run
npm run build
npm run test:e2e        # the core loop, in a real browser
```

Then walk `docs/SMOKE_CHECKLIST.md` manually.

**If any of this fails, the build is not announced to beta users** — regardless of
what else in the release is ready.

### Required updates to `docs/SMOKE_CHECKLIST.md`

The existing checklist predates this feature and two items now contradict it:

| Line | Says | Must become |
|------|------|-------------|
| 40–42 | plan-limit rejection shows "a clear **upgrade** message" | a clear message naming the limit, with no upgrade instruction (FR-013) |
| 46–47 | "Numbers on `/pricing` match `GET /plans`" | `/pricing` shows the trial message only, and `GET /plans` returns no paid tiers while the flag is off (FR-002, FR-010) |

Items to add: the stall case from Scenario 3 step 7; the trial-length coupling
from Scenario 4 steps 7–9; the failed-export case from Scenario 5 step 9; and the
expired-trial copy from Scenario 7 step 4.

---

## Done when

- [ ] Scenario 1 passes in a browser, 10 consecutive times on clean organizations (SC-002)
- [ ] Scenario 2 shows zero reachable paid paths, including the direct request (SC-003)
- [ ] Scenario 3 leaves no screen in a loading state under failure or stall (SC-005)
- [ ] Scenario 4 shows zero limit discrepancies and a single trial-length source (SC-004, SC-004a)
- [ ] Scenario 5 shows no visible-but-non-functional control (SC-007)
- [ ] Scenario 6 passes (SC-009)
- [ ] Scenario 7 communicates the locked state without instructing a dead action
- [ ] `docs/SMOKE_CHECKLIST.md` updated per the table above (SC-010)
