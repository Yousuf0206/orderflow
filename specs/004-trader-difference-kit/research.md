# Phase 0 Research: Trader Difference Kit

All decisions below were taken against the code as it stands on 2026-10-09, not against
assumptions. File and line references are to the state at that date.

---

## R1 — The landing workstream is already delivered, and must not be re-captured remotely

**Decision**: do no landing work in this feature. If User Story 2 visibly changes the purchase
order detail screen or the app shell, re-capture the landing assets with
`npm run capture:landing` against a **local** database, in the same change, per the constitution's
Landing review gate.

**Rationale**: `003-landing-page-upgrade` shipped the hero with a captured PO-detail screenshot, the
industry proof strip, the problem/outcome section, three feature blocks with real UI crops,
how-it-works with mini crops, the final CTA band, and a footer with Privacy and Terms. Every A1,
A2, and A3 bullet in the brief is present.

The brief's instruction "seed demo org, capture production UI" cannot be followed as written.
`backend/src/scripts/seed_landing_demo.py` now calls `assert_local_database()` and refuses any host
outside `localhost`, `127.0.0.1`, `::1`, `db`, `postgres`. That guard was added on purpose: the
script creates fixture organizations and `--recreate` hard-deletes them, and the configured
database is the hosted production instance. Seeding it would invent demo organizations in front of
real users.

**Alternatives considered**: passing `--i-know-this-is-not-local` to capture against the real
database — rejected, that override exists for a deliberate human decision, not for a routine
capture step. Capturing against a Vercel preview deployment — rejected for now, because a preview
still points at the same database.

---

## R2 — Resequencing: role gating moves from fourth to first

**Decision**: implement in the order US1 (role gating) → US2 (phone comfort) → US3 (filters) →
US4 (export) → US5 (invite honesty) → US6 (manifest), rather than the brief's psychology sequence.

**Rationale**: the brief's sequence — believe it's real, use it on the phone, replace the Excel
ritual, trust the team, stay honest on trial — is a good ordering of *new capability*. Two of its
five steps are already done (landing, trial UI), and one of the remaining three contains a live
defect rather than a missing feature: `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx`
renders the dispatch form with no role check at all, while
`backend/src/api/dispatches.py:31` restricts recording to `owner`, `manager`, `staff`. Every Viewer
therefore fills in a form and is refused.

A defect that tells a user the product is broken outranks a capability the user does not yet have.
This is Principle XXIII applied to sequencing.

**Alternatives considered**: following the brief's order and treating role gating as polish —
rejected, it leaves the most certain credibility loss in place for the length of the feature.

---

## R3 — The purchase order list and dashboard issue one query per order (blocking)

**Decision**: add `compute_many(db, pos)` to `backend/src/services/po_calc.py`, computing dispatched
totals for a set of purchase orders with a single grouped aggregate, and use it in
`list_purchase_orders`, `get_dashboard`, and the `reports.py` row builders. Keep `compute` for the
single-order case, implemented in terms of the same aggregate so the two cannot diverge.

**Rationale**: this is the most consequential finding of Phase 0.
`purchase_orders.py:15` `_to_out` calls `compute`, which calls `total_dispatched`
(`po_calc.py:22`), which issues one `SELECT coalesce(sum(qty), 0) ... WHERE purchase_order_id = ?`.
`list_purchase_orders` calls `_to_out` for every row. `get_dashboard` does the same at
`dashboard.py:28`. So listing *n* purchase orders costs *n* round trips plus one.

Against the configured database — the Supabase `ap-northeast-2` transaction pooler — a single
round trip was measured at roughly 300 ms earlier in this project. At the 180 open orders that
SC-005 names, the list would take on the order of 54 seconds and would exceed the client's 12 s
request deadline (`frontend/src/services/apiClient.ts:51`) many times over. The feature's own
success criterion — locate a specific order in under 15 seconds — is unreachable while this
pattern stands.

Filtering makes it strictly worse rather than better. Status is derived, not stored, so a status
filter must compute every order before excluding any; `purchase_orders.py:64` already filters in
Python after the full computation. Adding a party filter and a search box over that would let a
user narrow 180 rows to 3 and still wait the full 54 seconds.

**This is why the performance fix precedes the filter work rather than following it.** Shipping
filters first would deliver a feature that measurably fails SC-005 on the day it ships.

**What this must not become**: a `total_dispatched` column on `purchase_orders`. Principle II
forbids storing a balance that can drift from its dispatch rows, and the whole reason the landing
screenshots are captured rather than drawn is that the number is computed. `compute_many` keeps the
computation live; it only stops repeating the same round trip per row.

**Alternatives considered**:
- A correlated subquery or `JOIN ... GROUP BY` inside the list query — equivalent in effect and a
  reasonable implementation of `compute_many`; left to implementation, with the parity test as the
  guard.
- Caching the aggregate for a few seconds — rejected under Principle II.
- Paginating the list so *n* stays small — does not fix it: a page of 25 still costs 25 round trips,
  and the dashboard aggregates everything regardless. Pagination is a separate concern and is not
  in scope here.
- Leaving it and relaxing SC-005 — rejected; the criterion is the point of the story.

---

## R4 — Derived status filtering stays on the server

**Decision**: keep status filtering server-side, applied after `compute_many`. Do not translate the
status rules into SQL.

**Rationale**: status is a function of remaining balance, due date, and the configurable
`due_soon_days` setting (`po_calc.py:43-50`). Expressing that in SQL would create a second
definition of status that must be kept in step with the Python one, and Principle XII's sibling
concern — a number that disagrees with itself across surfaces — is exactly what FR-035 is trying to
prevent. After R3 the computation is one aggregate for the whole set, so filtering in Python costs
nothing measurable.

This also makes FR-017 structurally true rather than coincidentally true: `dashboard.py` and
`purchase_orders.py` both call the same `compute`/`compute_many`, so the dashboard Overdue count and
the filtered list count are derived from one definition and cannot disagree.

**Alternatives considered**: a SQL-side status expression for index support — rejected as a second
source of truth for a figure the constitution treats as sacred.

---

## R5 — PO-number search: server-side, with wildcards escaped

**Decision**: add a `q` query parameter to `GET /purchase-orders`, matching PO number
case-insensitively on a substring. Escape `%`, `_`, and the escape character itself before building
the pattern. `party_id` needs no work — it already exists at `purchase_orders.py:47`.

**Rationale**: FR-018 requires filtering where the data is selected, so a true count is a true
count. Searching in the browser would filter rows already delivered, which is both slower and a
lie when the list is long.

Escaping matters because an unescaped `%` in a trader's search box turns into a wildcard, and a PO
numbering scheme containing `_` (common) would silently match single characters. This is the edge
case the spec names as "a PO number search containing characters that would otherwise be read as
pattern syntax".

**Alternatives considered**: full-text search — rejected as disproportionate for substring matching
on a short identifier. Matching material and notes as well as PO number — rejected for now; the
spec asks for PO number, and a search box that also matches material needs a visible explanation
of what it searched.

---

## R6 — Filter state lives in the URL

**Decision**: hold status, party, and search in the URL query string via `useSearchParams`, not in
component state.

**Rationale**: three requirements collapse into one mechanism. FR-015 (filters survive navigating
to an order and back) becomes automatic, because the URL is restored by the browser. FR-017 (the
dashboard Overdue figure opens the filtered list) becomes an ordinary link to
`/purchase-orders?status=overdue` rather than cross-screen state passing. And a trader can send a
colleague a link to a filtered view, which is a small thing that a spreadsheet cannot do at all.

The existing list already keeps status in `useState` (`PurchaseOrdersList.tsx:27`) and loses it on
navigation; this replaces that.

**Alternatives considered**: React Query cache plus component state — rejected, it does not survive
a reload and does not give the dashboard figure a plain link. A persisted per-user filter preference
— rejected as a surprise: a trader returning to the list and seeing yesterday's filter silently
applied is worse than seeing everything.

---

## R7 — The party export reuses the organization export machinery

**Decision**: add `GET /parties/{party_id}/remaining/export?format=csv|xlsx|pdf`. Extract the CSV,
XLSX, and PDF writers from `backend/src/api/reports.py` into
`backend/src/services/exports.py`, and have both the organization reports and the new party export
call it. The frontend reuses the existing download path from
`frontend/src/pages/reports/Reports.tsx`, including its response check.

**Rationale**: the brief asks for "server-generated CSV (authoritative numbers)", which matches
FR-021 — the figures must come from dispatch rows at export time. `reports.py` already does exactly
this well: it builds the file server-side, sets a `Content-Disposition` filename, and the client at
`Reports.tsx:47` checks `resp.ok` *before* building the download, with a comment recording that
without it a 403 body landed in the user's downloads as a file named `report.csv` containing JSON.
That is FR-023 already solved. Reimplementing it for the party export would reintroduce the bug the
comment warns about.

Extracting the writer is the smaller risk. Two copies of a CSV writer is how a party export and an
organization report begin disagreeing about a number — which is the failure Principle XXI exists to
prevent.

**Audit**: FR-025 requires the party export to be logged via `log_action`. Noted while reading:
`export_report` at `reports.py:172` has no audit entry and no role restriction. Adding either is
outside this feature's stated scope, so it is **not** done here, but it is an inconsistency worth a
follow-up — a feature that logs one export and not the other invites the question of which log to
trust.

**Alternatives considered**: a client-built CSV — rejected, the brief explicitly wants server
authority and a browser-built file would derive figures from whatever the screen last fetched.

---

## R8 — The printable summary is the existing server PDF, not a print stylesheet

**Decision**: satisfy FR-020's printable summary with the existing server-side PDF path, offered
alongside CSV on the party screen. Do not add a print stylesheet or a dedicated print view.

**Rationale**: **this revises an assumption recorded in the spec**, which assumed the printable
summary would be a browser-printable page on the grounds that server PDF was already covered at the
organization level. Reading `reports.py:122` `_build_pdf` changed the answer: it is a general
`(title, org_name, fieldnames, rows) -> bytes` function, already styled with the brand colour and a
generation timestamp. Once R7 extracts it, a party PDF costs one call. A print stylesheet would be
new CSS, a new view, and a page whose output depends on the viewer's browser and paper size.

**Alternatives considered**: both — rejected as two ways to produce one document. The spec's
assumption as written — rejected for the reason above; the spec should be read as superseded on this
point.

---

## R9 — `send_email` must report what it did

**Decision**: change `backend/src/services/email.py` `send_email` to return an outcome of `sent`,
`not_configured`, or `failed` instead of `None`. Record the dispatch on the membership
(`invitation_email_sent_at`, nullable) and return the outcome, plus the invitation link, from
`POST /org/members/invite`.

**Rationale**: this is the root of the dishonesty User Story 5 describes. `email.py:21` returns
early with `logger.info("EMAIL (no SMTP configured) ...")` when `smtp_host` is unset — the
invitation link is written to the server log and nowhere else. `org.py:97` calls `send_email` and
ignores the result, then returns `201` with a `MemberOut`. The interface has no way to know an email
was never sent, so it says the invitation went out. The owner waits two days.

Returning an outcome is the minimum change that makes FR-026 possible, and it makes FR-029
(a mid-send failure must not be reported as sent) fall out of the same mechanism rather than needing
a second one.

**On returning the invitation link in the response**: the link is a 7-day single-use JWT
(`org.py:87-95`). It is returned only to an Owner, who is the person already authorised to invite,
over the same authenticated channel, and it is the only way FR-027 can be satisfied when no mail
service exists. It must not be logged by the frontend or placed in a URL.

**Alternatives considered**: raising an exception when mail is unconfigured — rejected, it would
turn a working invitation into a failed request and break the local development flow the stub was
written for. Queuing for later delivery — rejected, it needs infrastructure this phase does not
have, and a queued email is still not a sent one.

---

## R10 — One permissions table, shared by interface and server

**Decision**: add `frontend/src/hooks/usePermissions.ts`, deriving a small set of named
capabilities (`canRecordDispatch`, `canManageOrders`, `canManageParties`, `canManageTeam`,
`canManageBilling`) from the role already available via `/auth/me`. Document the role-to-action
table once in `contracts/permissions.md` and reference it from both sides.

**Rationale**: `AppShell.tsx:33-36` already makes role decisions inline, with role names written as
literals in each nav item. Spreading that pattern across the purchase order, party, and settings
screens would scatter the role rules through the interface, and the next role change would be found
by whichever screen was forgotten. One hook, one table.

**On the unknown-role case (FR-004)**: `AppShell.tsx:176` already handles a failed `/auth/me` with a
banner, deliberately not a full-page error, with a comment noting that losing the role reads as
"my permissions were taken away". The hook must return "unknown" rather than defaulting to
permissive, and screens must show the unconfirmed state rather than a working-looking form.

**Alternatives considered**: a server-provided permission list on `/auth/me` — cleaner in principle
and worth doing later, but it widens the change for no behavioural gain now, since the role is
already there and the server already enforces every action independently.

---

## R11 — Installability without a service worker

**Decision**: add `frontend/public/manifest.webmanifest` with name, short name, `start_url`,
`display: standalone`, theme and background colours matching the brand, and PNG icons at 192 and
512 px plus a maskable variant; link it and a `theme-color` meta from `index.html`.
**Add no service worker and no offline capability.**

**Rationale**: the brief's own heading is "Installability (light)", and FR-033 requires installation
to be additive. A manifest and icons deliver everything the story asks for: the home-screen entry
gets the right name and icon, and `display: standalone` drops the browser chrome.

A service worker is refused on constitutional grounds, not convenience. Principle II forbids a
remaining balance that can drift from its dispatch rows, and a cache that can serve a stale
response is precisely such a store. FR-034 states this. The one thing a service worker is for is the
one thing this product must not do.

`start_url` must point at the application, not the public landing page (FR-032). `/dashboard` is
correct: an unauthenticated visitor is redirected to login by the existing route guards, and an
authenticated one lands where they want to be.

**Alternatives considered**: a Vite PWA plugin — rejected, it brings a service worker by default and
a new build dependency for two static files. `display: fullscreen` — rejected, it hides the status
bar, and a dispatch clerk wants to see the time and signal strength.

---

## R12 — Touch targets: raise the floor, then assert it

**Decision**: audit every interactive control on the dispatch path, raise anything below 44×44 CSS
pixels, make form primary actions full-width at phone widths, and add Playwright assertions that
measure the targets and the horizontal scroll extent at 320, 360, 390, and 430 px.

**Rationale**: the gap is real and measurable today. `AppShell.tsx:138` and `:158` — the mobile menu
open and close buttons, the first controls a phone user touches — are `h-9 w-9`, which is 36 px
against the constitution's 44 px. They are the clearest instance but an audit is needed rather than
a spot fix.

The assertion matters more than the fix. The v1.3.0 amendment recorded Principle XXII as
"aspirational on those two clauses" precisely because nothing asserted them; a fix without a test
returns to that state at the next layout change. `frontend/tests/e2e/mobile-viewport.spec.ts`
already runs the dispatch path at 390 px and already measures a bounding box at several widths, so
the mechanism exists and needs extending, not inventing.

**On keyboard occlusion (FR-008)**: Playwright does not render a real on-screen keyboard, so this
clause cannot be fully automated. It is verified by the real-device pass in R13, and the automated
substitute is that the submit control sits in the document flow after the last field rather than
being pinned in a position a keyboard would cover.

**Alternatives considered**: raising the global minimum control size across the whole application —
tempting, and probably right eventually, but it changes every screen's visual rhythm and belongs in
its own change with its own review.

---

## R13 — The real-device pass is a human task and is named as such

**Decision**: keep the brief's "one real Android/iPhone test" as an explicit manual task with a
recorded outcome: device, browser, and whether a dispatch was recorded without zoom or pan. It
gates the story's completion and cannot be marked done by any automated run.

**Rationale**: Chrome device mode and Playwright viewports model width, not touch. They cannot
reproduce a thumb, a real on-screen keyboard, sunlight, or Safari's address-bar behaviour on scroll.
SC-011 — three people outside the team recording a dispatch unaided — is in the same category.
Writing these as tasks that only a person can close is more honest than writing an automated check
that appears to cover them.

**Alternatives considered**: a hosted real-device testing service — reasonable later, out of
proportion for one pass now.
