# Release Smoke Checklist

**This is a release gate, not a formality.** If any item fails, the build is not announced
to beta users — regardless of what else in the release is ready.

Run manually against any new deploy. Most items are also covered by an automated test,
noted in parentheses; where no test is named the check is manual only, either because it
needs a real browser at a real viewport or because it needs a stalled connection that
jsdom cannot simulate. Run the suites first:

```bash
cd backend  && pytest
cd frontend && npm run test -- --run && npm run build && npm run test:e2e
```

## Core loop
- [ ] Sign up with a new email → lands on `/onboarding` (not a blank page or error)
  (`tests/integration/test_tenant_isolation.py::test_signup_creates_isolated_organization`)
- [ ] Create a party from onboarding or `/parties/new`
- [ ] Create a purchase order, party selectable from dropdown
- [ ] Record a partial dispatch → remaining balance updates live on the PO detail page
- [ ] Attempt to over-dispatch past the remaining balance → warning shown, not silently
      accepted or silently rejected
- [ ] Confirm the over-dispatch anyway → it's recorded, balance goes to the expected value
  (`tests/integration/test_core_workflow.py`)

## Auth
- [ ] Log out → redirected to `/login`, and `localStorage` no longer has `orderflow_tokens`
- [ ] Visit a protected route (e.g. `/dashboard`) while logged out → redirected to
      `/login?next=/dashboard`, and logging in lands back on `/dashboard`
- [ ] Visit `/login` or `/signup` while already logged in → redirected to `/dashboard`
- [ ] Sign up with an email that's already registered → error attaches to the Email field
      specifically, not a generic banner
- [ ] An expired/invalid access token is rejected and the app recovers (refresh or logout)
  (`tests/integration/test_auth_session.py`)

## Multi-tenant isolation
- [ ] User A cannot see user B's parties, purchase orders, or dispatches
  (`tests/integration/test_tenant_isolation.py::test_cross_tenant_po_access_returns_404`)

## Roles
- [ ] A staff/viewer account cannot create a party or see Billing
- [ ] A non-owner does not see "Team" or "Super Admin" in the sidebar nav if their role
      doesn't permit it, and visiting those URLs directly shows an access-denied message,
      not an infinite loading spinner
  (`tests/integration/test_rbac.py`)

## Plan limits
- [ ] Creating a purchase order past `max_active_pos` is rejected with a message that names
      the limit and does **not** tell the user to upgrade (they can't)
- [ ] Inviting a member past `max_users` is rejected the same way
- [ ] The usage figures on `/billing` ("2 of 3") agree with where creates actually start
      being refused
  (`tests/integration/test_plan_limits.py`, `test_limits_truth.py`, `test_billing_contract.py`)

## Trial-only positioning
- [ ] `/pricing` shows the single trial message — trial length, no credit card, paid plans
      coming soon — and **no** Starter/Business/Pro card or price
- [ ] `GET /plans` returns `"plans": []` while `PAID_PLANS_ENABLED=false`
- [ ] `/billing` shows plan Trial, the trial end date, and usage — with no upgrade button
      and no "Manage billing"
- [ ] A direct `POST /billing/checkout-session` returns 403, and the message names no
      environment variable or vendor
  (`tests/integration/test_paid_plans_gate.py`, `tests/unit/paidSurfaceGated.test.tsx`)

## Trial length is stated from one place
- [ ] Set `TRIAL_LENGTH_DAYS=21`, restart, reload `/` and `/pricing` → both say 21 days,
      nothing still says 14
- [ ] A new signup gets a 21-day trial; an organization created earlier keeps its original
      end date
  (`tests/integration/test_limits_truth.py`)

## Expired trial
- [ ] A locked-out organization is told the trial ended, that records remain viewable and
      exportable, and is **not** told to upgrade
- [ ] A blocked create shows that message rather than failing silently

## Legal & truth
- [ ] `/privacy` and `/terms` both resolve and are linked from Signup, Pricing, Billing, and
      the footer
- [ ] Neither document describes paid billing, checkout, or card handling as live

## Reports
- [ ] Each report (Remaining by Party, Overdue Orders, Dispatch History) loads with data
- [ ] CSV/Excel/PDF export downloads with a filename like `<org-slug>-<report>-<date>.<ext>`
- [ ] A **failed** export (stop the backend, or use an expired token) shows an error and
      downloads **nothing** — never a file containing a JSON error
  (`tests/unit/noSilentFailures.test.tsx`)

## Nothing loads forever
Open each of these, then block or kill the request in devtools → Network:
- [ ] Party detail → error + Try again, never "Loading party…"
- [ ] Purchase order detail → error + Try again, never "Loading purchase order…"
- [ ] Dashboard, Parties, Purchase Orders, Reports, Audit Log, Team, Company Settings →
      error + Try again
- [ ] A **stalled** request (one that never settles, not one that fails) resolves to an
      error within ~12s — this is the case a screen can still hang on after `isError` is
      handled
- [ ] Notifications panel on failure does **not** say "You're all caught up"
- [ ] An empty list shows an empty state naming a next action, not a false error
- [ ] Repeat party detail, dashboard, and one empty state at phone width — no sideways
      scrolling
  (`tests/unit/QueryState.test.tsx`, `coreLoopFailureStates.test.tsx`, `noSilentFailures.test.tsx`)

## Trust & SEO
- [ ] Favicon shows in the browser tab (not broken/missing)
- [ ] `/`, `/pricing`, `/login`, `/signup` each have a distinct `<title>`
