# Release Smoke Checklist

**This is a release gate, not a formality.** If any item fails, the build is not announced
to beta users — regardless of what else in the release is ready.

The checklist has two halves, and the split matters. Everything under **Before the deploy**
is run against a local stack and tells you the *build* works. Everything under
[**After the deploy**](#after-the-deploy) is run against the *deployment* and tells you what
users actually reach.

That distinction is not pedantry. On 2026-10-09 this checklist passed, every automated test
passed, and production returned 500 from signup and from every authenticated request for
hours — a migration had been deployed without being applied. The build was fine. Nothing had
looked at the running system.

Most items are also covered by an automated test, noted in parentheses; where no test is named
the check is manual only, either because it needs a real browser at a real viewport, or a
stalled connection that jsdom cannot simulate, or a physical device.

---

# Before the deploy

Run the suites first:

```bash
cd backend  && pytest
cd frontend && npm run test -- --run && npm run build && npm run test:e2e
```

**If the e2e suite refuses to run**, the backend is pointed at a non-local database. That is
the guard working. Fix the configuration rather than overriding it.

The migration tests need a real PostgreSQL and skip silently without one:

```bash
docker run -d --name pg -e POSTGRES_USER=orderflow -e POSTGRES_PASSWORD=orderflow \
  -e POSTGRES_DB=orderflow -p 5434:5432 postgres:16
cd backend && TEST_PG_URL=postgresql+psycopg://orderflow:orderflow@localhost:5434/orderflow pytest -q
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
  (`tests/unit/QueryState.test.tsx`, `coreLoopFailureStates.test.tsx`, `noSilentFailures.test.tsx`)

## Mobile viewport (Principle VIII and XXII)
- [ ] Public pages, the empty dashboard, Billing, error states, and the whole core loop
      at 390px wide — no sideways scrolling, and the loop is completable
- [ ] Every interactive control on the dispatch path is at least 44×44 CSS pixels at
      320 / 360 / 390 / 430px
  (`tests/e2e/mobile-viewport.spec.ts` — automated; run `npm run test:e2e`)

> **This section does not settle mobile.** It measures width, and a viewport has no thumb and
> no on-screen keyboard. Whether the submit control is reachable with the keyboard open is
> unanswered by everything above, and Constitution Principle XXVI explicitly forbids citing
> these automated checks as if they covered it. The real-device record under
> [After the deploy](#after-the-deploy) is the gate for any mobile claim.

## Trust & SEO
- [ ] Favicon shows in the browser tab (not broken/missing)
- [ ] `/`, `/pricing`, `/login`, `/signup` each have a distinct `<title>`

---

# After the deploy

Everything above verifies the build. These verify the deployment — the thing users reach.
**None of these can be satisfied by a local run.**

## Deployed smoke (Principle XXIV)

```bash
python backend/src/scripts/smoke_deployed.py https://purchaseorderflow.vercel.app
```

Signs up, reads the account back, creates a party and a purchase order, records a dispatch,
and checks the remaining balance. The authenticated read is the step that matters: during the
2026-10-09 outage login returned 200 the whole time, and it was the read that failed.

Exit codes carry meaning, so read them rather than just "did it go green":

| Code | Meaning | What to do |
| --- | --- | --- |
| 0 | Passed | Proceed |
| 1 | The deployment answered and a step failed | It is broken. Do not announce |
| 2 | Could not be reached | Nothing was learned. Re-run; if it persists, it is down |

**Only exit 2 justifies a re-run.** Re-running a 1 until it goes green is how an outage gets
announced.

- [ ] Exits 0 against the production alias
- [ ] A duplicate email returns 409 with the error on the Email field, not a banner, and not a 500

It runs automatically on every successful production deployment
(`.github/workflows/post-deploy-smoke.yml`). It creates one organization named
`SMOKE <timestamp>` per run and prints the ids — deliberate, because checking anywhere else
does not verify what users reach.

## Real-device dispatch (Principle XXVI) — no command closes this

- [ ] A dispatch recorded on a physical **Android** device against the deployment
- [ ] A dispatch recorded on a physical **iPhone in Safari** against the deployment
- [ ] Both records filed at `docs/qa/records/<release-tag>.md` from the template at
      `docs/qa/mobile-dispatch.md`, with device, OS, browser and outcome named

**Until both pass for this release, it may not be announced or described as supporting
mobile dispatch.** A Playwright run does not substitute. A record from a previous release
does not carry over.

## Spreadsheet acceptance (Principle XXV) — manual, once per release

Download from the **deployed** product, not a local one:

- [ ] Party remaining export, in every offered format
- [ ] All three organization reports, in every offered format
- [ ] Each opened in **both** Excel and Google Sheets — they disagree about type inference,
      so one is half a check
- [ ] Columns land in their own columns; the first row reads as a header
- [ ] **Selecting a quantity column shows a sum in the status bar** — numbers stored as text
      look identical and make `SUM` return zero, which a trader finds while reconciling
- [ ] Dates read as dates; a party name with a comma or quote renders intact
- [ ] A report with no matching rows still shows its header row and reads as an empty report,
      not a blank file

Applications used: ______________________

Anything that renders wrongly is filed as a defect against the export, not worked around by
whoever found it — the next person to download it will not know about the workaround.
