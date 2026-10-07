# Phase 0 Research: Market-Ready Trial Updates

**Date**: 2026-10-08 | **Plan**: [plan.md](./plan.md)

This phase resolved every open technical question by reading the existing code
rather than by surveying external options, because the feature is a hardening pass
over a working application. Each finding below names the file and line that
establishes it, so the plan's effort revisions are traceable.

---

## R1. Why two screens show a loading message forever

**Decision**: Fix the shared cause in two places — a timeout in the request layer
and a reusable query-state wrapper — rather than patching each screen's condition.

**Finding**: The constitution names "Loading party…" and "Loading purchase
order…" as defects. Both are reproducible, and the mechanism is a single
expression repeated across the codebase:

```tsx
// frontend/src/pages/parties/PartyDetail.tsx:35
if (isLoading || !data) {
  return <PageHeader title="Loading party…" />;
}
```

When the query **fails**, TanStack Query sets `isLoading` false and leaves `data`
undefined. The condition `isLoading || !data` is therefore still true, so the
loading header renders permanently. `isError` is never read. The same shape
appears at `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx:82`.

**Scale**: 15 modules call `useQuery`; only `settings/TeamMembers.tsx` reads an
error state. The other 14 share this defect class:

```text
components/AppShell.tsx            pages/parties/PartiesList.tsx
components/Notifications.tsx       pages/parties/PartyDetail.tsx
pages/admin/SuperAdmin.tsx         pages/purchase-orders/PurchaseOrderDetail.tsx
pages/audit/AuditLog.tsx           pages/purchase-orders/PurchaseOrderForm.tsx
pages/billing/Billing.tsx          pages/purchase-orders/PurchaseOrdersList.tsx
pages/dashboard/Dashboard.tsx      pages/reports/Reports.tsx
pages/marketing/Pricing.tsx        pages/settings/CompanySettings.tsx
```

**Second, independent cause**: `frontend/src/services/apiClient.ts` calls `fetch`
with no timeout and no `AbortSignal`. A request that never settles leaves every
consumer pending indefinitely regardless of error handling, so FR-028 cannot be
satisfied in the screens alone.

**Rationale**: Two root causes, two central fixes, 14 adoptions. Repairing
conditions screen by screen would leave the stall case unfixed and would make
FR-027 a 14-way audit on every future screen.

**Alternatives considered**: Per-screen `isError` branches (leaves the stall case
open, repeats presentation 14 times); a TanStack Query global error boundary
(catches render-time throws, but these queries do not throw — they resolve to an
error state the screen ignores); raising `retry` in `main.tsx:10` (retries a
failure more times, then still renders the same stuck header).

---

## R2. Where the paid affordances actually are

**Decision**: Four surfaces change. The landing page needs no CTA work.

**Finding**: Stream A item 4 is a landing CTA audit. It passes already —
`frontend/src/pages/marketing/Landing.tsx` offers "Start free trial" / "Start your
free trial" at lines 80, 97, and 179, all routing to `/signup`, with no Buy or
Subscribe anywhere. The paid pressure is elsewhere:

| Surface | What is there now | Required |
|---------|-------------------|----------|
| `pages/marketing/Pricing.tsx:52-63` | Three live tier cards with prices and limits from `GET /plans`, each with a CTA | Replace with the single trial message (FR-002, FR-010) |
| `pages/billing/Billing.tsx:107-113` | "Choose starter / business / pro" buttons calling `POST /billing/checkout-session` | Remove (FR-003, FR-006) |
| `pages/billing/Billing.tsx:100-102` | "Manage billing" button, shown unconditionally | Remove for trial orgs (FR-007) |
| `backend/src/api/plans.py:8` | Public endpoint returning Starter/Business/Pro with prices | Gate behind the flag (FR-010) |

**Rationale**: FR-003 says no *reachable* control may initiate checkout. Hiding a
button while `POST /billing/checkout-session` stays open leaves the path reachable
by direct request, so the endpoint is gated too.

---

## R3. The two error messages a user should never see

**Decision**: Both are deleted along with the controls that produce them, not
reworded.

**Finding**: `Billing.tsx` fails paid actions with text written for a developer:

```tsx
// frontend/src/pages/billing/Billing.tsx:37
setNotice("Stripe is not configured on this deployment yet. Set STRIPE_SECRET_KEY and price IDs on the backend.");
```

This is shown to end users and names a server environment variable — a direct
FR-031 breach. The portal fallback at line 46 says "upgrade to a paid plan first",
instructing the user toward an action FR-006 forbids.

A third instance is subtler. The read-only lockout banner reads "upgrade to resume
creating and editing records" (`Billing.tsx:85`), which will be the primary
message an expired-trial user sees while upgrading is impossible. It needs copy
that does not instruct a dead action.

**Rationale**: Once the controls are gone, these strings are unreachable; deleting
them together avoids leaving developer-facing copy in the bundle.

---

## R4. Whether the paid-plans flag belongs on the server or in the build

**Decision**: Backend setting `paid_plans_enabled: bool = False` in
`backend/src/core/config.py`, exposed over the API. Not a Vite variable.

**Rationale**: A build-time frontend constant can disagree with a server that
still honours `POST /billing/checkout-session`. The flag's purpose is that no paid
path is reachable, and only the server can guarantee that. Deriving the UI from a
server-reported value keeps one source of truth, per Principle XI.

**Shape**: `GET /plans` returns an empty list when the flag is off, letting the
Pricing page render the trial message without a separate capability call.
`POST /billing/checkout-session` and `POST /billing/portal-session` refuse with a
clear error when the flag is off, closing the direct-request path. See
[contracts/public-plans.md](./contracts/public-plans.md).

**Alternatives considered**: `VITE_PAID_PLANS_ENABLED` (drift risk above; also
requires a rebuild to change); a new `GET /config` endpoint (an extra public
endpoint when `/plans` already carries exactly this meaning); removing the plans
endpoint entirely (loses the ability to re-enable paid plans without a code
change, and Principle XIV anticipates re-enabling after P0).

---

## R5. Whether limits are already honest

**Decision**: Stream C is smaller than estimated. Billing already complies;
the gap is paid-tier display and the trial-length string.

**Finding**:
- `Billing.tsx:98` renders `data.max_users` and `data.max_active_pos` straight
  from `GET /billing`, so FR-008 is already satisfied there.
- `Onboarding.tsx` displays **no** limit figures at all, so FR-009 has nothing to
  reconcile — a search for limit copy there returned nothing.
- `enforce_usage_limits` (`backend/src/services/billing.py:34`) already blocks at
  the enforced value and already returns a message naming the limit and plan.
- The actual violations are FR-010 (Pricing shows Starter 5/100 and Business
  20/1000 as available entitlements) and FR-011 (trial length is hardcoded as
  "14-day" in copy).

**Open item for Stream C**: the limit-refusal messages end with "Upgrade to add
more users." / "Upgrade to add more."
(`backend/src/services/billing.py:41,52`). While paid plans are disabled, that
sentence instructs a dead action and must change, the same issue as R3.

---

## R6. How the trial length should flow to public copy

**Decision**: One server value feeds signup, seeding, and public copy.

**Finding**: `trial_length_days: int = 14` already exists at
`backend/src/core/config.py:27` and is what signup grants
(`backend/src/api/auth.py:44`). Two places restate it independently:

- `backend/src/scripts/seed.py:50` hardcodes `timedelta(days=14)`.
- Frontend copy hardcodes "14-day" at `Landing.tsx:107` and twice in
  `Pricing.tsx` (the page description and the footnote).

**Rationale**: The user's clarification chose derivation over pinning. Seeding
reads the setting (FR-011a); public copy reads a server-reported value. Because
the Pricing page already calls a public endpoint, the trial length rides along on
that response rather than requiring a new one.

**Alternatives considered**: Pinning the setting to a constant (rejected by the
user); computing the length client-side from `trial_ends_at` (only works for
signed-in users, and the Pricing page serves anonymous visitors).

---

## R7. Whether Team and Reports need building

**Decision**: Neither. Stream D is verification plus two defect fixes.

**Finding**:
- Invitation issuance exists (`backend/src/api/org.py:54`) and sends a link to
  `/accept-invite`; acceptance exists (`backend/src/api/auth.py:148`) and rejects
  invalid or reused invites.
- Export already supports all three formats server-side
  (`backend/src/api/reports.py:172-220`), and the frontend downloads all three via
  a direct `fetch` with `.blob()` (`Reports.tsx:34-50`), bypassing the shared
  client. So CSV does not need "implementing or wiring", and no format needs
  hiding under FR-039.

**Two real defects found instead**:

1. **Export never checks `resp.ok`** (`Reports.tsx:39-42`). A 403 or 500 response
   body is handed to `URL.createObjectURL` and downloaded as a file named
   `report.csv` containing a JSON error. There is also no `catch` — only a
   `finally` — so a network failure produces an unhandled rejection and no user
   feedback. This is FR-031 and FR-039 in one.
2. **SMTP is unconfigured by default** (`smtp_host: str = ""` at
   `config.py:21`), so on a default deployment the invitation email never
   arrives. The pending-member state is therefore the primary path, exactly as the
   kit's "else pending state" anticipated, and FR-033's visible status is what
   makes it usable.

---

## R8. What the smoke path should be

**Decision**: Promote the existing written checklist to an executable Playwright
run, and keep the written list as the human-facing gate.

**Finding**: Playwright is already a dependency with a `test:e2e` script
(`frontend/package.json`), and `docs/smoke-checklist.md` already exists from
commit `0f4df3b`. Principle XIII requires the smoke path to pass before a
production announcement, and Principle X requires UI-level proof — a written list
satisfies neither on its own if nobody runs it.

**Rationale**: SC-002 asks for 10 consecutive clean-organization passes. That is
only practical automated.

**Alternatives considered**: Manual-only checklist (cannot deliver SC-002, and
Principle XIII becomes an honour system); backend integration test of the same
path (explicitly insufficient under Principle X, which rejects an API-level pass
as evidence).

---

## Resolved unknowns

| Unknown from Technical Context | Resolution |
|--------------------------------|------------|
| Where the paid-plans flag lives | Backend setting, exposed via `GET /plans` (R4) |
| How public copy learns the trial length | Server-reported on the same public response (R6) |
| Whether CSV export needs building | No — all three formats work; fix unchecked status (R7) |
| Whether limits need a new config source | No — `PLAN_LIMITS` stays authoritative (R5, plan Complexity Tracking) |
| How to satisfy the 15-second resolution guarantee | Timeout in `apiClient.ts` plus shared `QueryState` (R1) |
| What "smoke test" means operationally | Playwright run of the core loop, gating the announcement (R8) |

No NEEDS CLARIFICATION markers remain.
