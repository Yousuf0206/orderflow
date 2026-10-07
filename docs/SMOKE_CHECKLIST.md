# Release Smoke Checklist

Run manually against any new deploy before announcing it live. Every item here is also
covered by an automated test (noted in parentheses) — this checklist is the human
double-check before a production announcement, not a replacement for the test suite.

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
- [ ] Creating a purchase order past the plan's `max_active_pos` is rejected with a clear
      upgrade message
- [ ] Inviting a member past the plan's `max_users` is rejected with a clear upgrade message
  (`tests/integration/test_plan_limits.py`)

## Pricing & billing truth
- [ ] Numbers on `/pricing` match `GET /plans` (they're sourced from the same backend config
      — see `backend/src/models/subscription.py::PLAN_LIMITS`)
- [ ] `/privacy` and `/terms` both resolve and are linked from Signup, Pricing, and Billing

## Reports
- [ ] Each report (Remaining by Party, Overdue Orders, Dispatch History) loads with data
- [ ] CSV/Excel/PDF export downloads with a filename like `<org-slug>-<report>-<date>.<ext>`

## Trust & SEO
- [ ] Favicon shows in the browser tab (not broken/missing)
- [ ] `/`, `/pricing`, `/login`, `/signup` each have a distinct `<title>`
