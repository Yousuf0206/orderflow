# Quickstart: Validating the Trader Difference Kit

How to prove each story works. One section per user story, each independently runnable.

---

## Prerequisites — read this first

**Point the backend at a local database before running any of this.**

`backend/.env` currently sets `DATABASE_URL` to the hosted Supabase instance, which is production.
Every validation below creates organizations, parties, purchase orders, dispatches, and
invitations. Running them against production adds test rows to real data — that is how the current
production database came to hold several hundred machine-generated organizations.

```powershell
# backend/.env — local Postgres
# DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/orderflow
```

The landing fixture script already refuses a non-local host (`seed_landing_demo.py`
`assert_local_database`). **The e2e suite does not** — it signs up through the API and writes
wherever `DATABASE_URL` points. Treat that as the live hazard it is until a guard is added.

Then:

```powershell
cd backend; .venv\Scripts\activate; alembic upgrade head
cd ..\frontend; npm install
```

---

## Story 1 — A Viewer is never offered an action they cannot complete

**Setup**: one organization with four users, one per role. Sign in as each.

**Checks**

| As | On a purchase order with remaining balance | Expected |
| --- | --- | --- |
| Viewer | look for the dispatch form | absent; a line states Staff access or above is required |
| Staff | record a dispatch | form present, dispatch records |
| Staff | existing dispatch rows | no edit or delete controls (Staff may record, not amend) |
| Manager, Owner | record, edit, delete | all present and working |
| Viewer | parties and orders screens | no create, edit, or delete controls |

**The regression this protects against**: today a Viewer fills in the form and is refused by the
server. Nothing is wrong with what they typed.

**Unknown-role check**: block `/auth/me` (devtools offline, or stop the backend after sign-in) and
open a purchase order. Expect "we couldn't confirm your permissions" with a retry — **not** a
working form, and **not** an access-denied page.

```powershell
cd frontend
npx playwright test tests/e2e/roles.spec.ts
npm run test -- permissions
```

**Done when**: no visible control anywhere produces a refusal when pressed (SC-001).

---

## Story 2 — Recording a dispatch on a phone is comfortable

**Automated**

```powershell
cd frontend
npx playwright test tests/e2e/mobile-viewport.spec.ts
```

Asserts, at 320 / 360 / 390 / 430px: every control on the dispatch path measures ≥ 44×44 CSS px,
`document.scrollWidth <= clientWidth`, and the form's primary action spans the available width.

**Baseline before fixing**: run it first. `AppShell.tsx:138` and `:158` are 36px, so the 44px
assertion should fail on the menu buttons. A test that passes before the fix is testing the wrong
thing.

**Manual, and not skippable (R13)**

On a real Android or iPhone, on the same network as the dev server:

1. Open a purchase order. Record a dispatch one-handed.
2. With the keyboard open over the quantity field, confirm the submit control is reachable without
   dismissing it.
3. Confirm no pinch-zoom and no sideways swipe at any point.
4. Record device, browser, and outcome in the task.

Playwright models width, not a thumb or a keyboard. This pass is the only thing that answers FR-008.

**Timing (SC-002)**: stopwatch from the purchase order screen, signed in, to the new Remaining
figure. Under 30 seconds.

**Landing consequence**: if control sizes visibly change the purchase order detail screen, re-run
`npm run capture:landing` **against the local database** in the same change (Principle XIX).

---

## Story 3 — Finding the right purchase order quickly

**Setup**: an organization with ~180 purchase orders across several parties, mixed statuses.

**Performance first — this is the point of the story**

```powershell
# Time the list before and after the batched aggregate
curl -w "\n%{time_total}s\n" -H "Authorization: Bearer $TOKEN" http://localhost:8000/purchase-orders
```

Before R3 this issues one query per order. Against the hosted database that is roughly 54 seconds
at 180 orders — past the client's 12 s deadline. Locally it will look merely slow rather than
broken, which is why the parity and query-count tests matter more than the wall clock:

```powershell
cd backend; pytest tests/unit -k compute_many        # compute_many == compute, per order
pytest tests/integration -k list_query_count         # one aggregate, not n
```

**Filters**

1. Select a party → only that party's orders; the active filter is visible.
2. Type part of a PO number → partial, case-insensitive matches.
3. Combine party + status → both apply; clear each independently.
4. Search `50%` or `PO_1` → treated as literal text, not wildcards.
5. Open an order, press back → filters still applied (they are in the URL).
6. Filter to nothing → "no orders match these filters" with a clear action, **not** "No purchase
   orders yet".

**Dashboard linkage (FR-017)**

Press the Overdue figure. The list opens filtered to overdue, and the number of rows equals the
figure. With zero overdue, the figure is not a link.

**Done when**: a specific order is located among 180 in under 15 seconds (SC-005).

---

## Story 4 — Sending a party their remaining balance

**Setup**: a party with several open orders and at least one fully dispatched order.

1. Open the party. Export remaining → a CSV downloads.
2. Open it. Columns, in order: party name, PO number, material, ordered, dispatched, remaining, due
   date. Only open orders — the fully dispatched one is absent.
3. Compare every Remaining figure against the screen. They must match exactly.
4. Export as PDF → a printable document with the same figures and the party's name.
5. A party with no open orders → the control is absent or disabled with a reason.
6. Force a failure (stop the backend mid-export) → told the export did not download, and **no file
   is saved**. In particular no file named like a data file containing a JSON error — that is the
   bug recorded at `Reports.tsx:47`.
7. Press the control twice quickly → one download.
8. Check the audit log → one `export` entry with actor and timestamp.

**Cross-tenant check**: request another organization's `party_id`. Expect 404, not 403, and no rows.

**Done when**: a shareable summary is produced in under 15 seconds and every figure matches the
screen (SC-007).

---

## Story 5 — An invitation that tells the truth

**With no mail service** (leave `SMTP_HOST` unset):

1. As Owner, invite a colleague.
2. Expect: member created pending, and the interface says **no invitation email could be sent**,
   with a copyable link.
3. Open the link in a private window → accept → the colleague is active.
4. Check the database: `memberships.invitation_email_sent_at` is `NULL`.

**With a mail service** (a local catcher such as MailHog, or real SMTP):

1. Invite. Expect: "the invitation was emailed to <address>", naming it.
2. `invitation_email_sent_at` is set.

**Mid-send failure**: point `SMTP_HOST` at a closed port.

1. Invite. Expect: not reported as sent; the link is offered; the pending member remains usable.
2. `invitation_email_sent_at` stays `NULL`.

**Link edge cases**: reuse an accepted link → told it has already been accepted. Use an expired one
→ told it expired and that the owner can send a new one. These must read differently, because the
remedies differ.

```powershell
cd backend; pytest tests/integration -k invite
```

**Done when**: with no mail configured, an owner can still get a colleague onto the team, and is
never told an email was sent when none was (SC-008).

---

## Story 6 — Keeping OrderFlow on the phone's home screen

```powershell
cd frontend; npm run build; npm run preview
```

On a real phone, over the network:

1. Open the preview. Use Add to Home Screen in **both** mobile Safari and mobile Chrome.
2. The entry carries the OrderFlow name and icon — not a page title or a blank square.
3. Launch from the home screen → it opens the application, not the public landing page.
4. Sign in and record a dispatch from that launch. The full core loop works.
5. In a browser without install support, confirm nothing is broken or hidden.

**Explicitly check there is no service worker**: devtools → Application → Service Workers must be
empty. A cache that can serve a stale remaining balance violates Principle II, and FR-034 forbids
it.

---

## Whole-feature gate

Before any production deploy (Principle XIII, plus the new Phone dispatch evidence gate):

```powershell
cd backend; pytest
cd ..\frontend; npx tsc -b; npm run lint; npm run test; npx playwright test
```

Then, by hand:

- Signup → party → PO → dispatch → dashboard remaining, in a browser.
- The same loop at 390px width.
- One real-device dispatch (R13).
- Landing screenshots still match the deployed UI (Principle XIX / Landing review).

**SC-011** — three people outside the team record a dispatch on a phone without being told how —
cannot be closed by any command here, and is not marked done until three people have actually done
it.
