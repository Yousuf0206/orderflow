# Contract: UI query states — three terminal states

**Scope**: every screen that fetches data (15 modules calling `useQuery`)

**Satisfies**: FR-027, FR-028, FR-029, FR-030, FR-031

**Root causes addressed**: research [R1](../research.md)

---

## The contract

Every data-backed view resolves into **exactly one of three terminal states**, and
"loading" is not one of them:

```text
                    ┌─────────────┐
   mount ──────────▶│   loading   │  transient only — never terminal
                    └──────┬──────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌─────────────┐   ┌──────────┐
    │   data   │    │ empty state │   │  error   │
    │          │    │ + next      │   │ + retry  │
    └──────────┘    │   action    │   └────┬─────┘
                    └─────────────┘        │ retry
                                           └──▶ back to loading
```

### Rules

1. **Loading MUST be bounded.** A request that neither resolves nor rejects must
   still reach the error state. Enforced in the request layer, not per screen.
2. **A failed query MUST render the error state**, never the loading state. The
   condition `isLoading || !data` is forbidden, because it renders loading
   whenever a query has failed (`data` is undefined and `isLoading` is false) —
   the mechanism behind the two loading messages the constitution names.
3. **Error states MUST offer retry** that re-runs the query (FR-029).
4. **Empty states MUST name the next action** (FR-030).
5. **Error text MUST be trader-readable** (FR-031): no status code alone, no stack
   trace, no server environment variable, no bare "Something went wrong".
6. **Both error and empty states MUST render correctly at mobile width**
   (Principle VIII).

---

## Request-layer obligation

`frontend/src/services/apiClient.ts` currently calls `fetch` with no timeout and
no `AbortSignal`, so a stalled request leaves every consumer pending forever.

**Required**: a timeout applied centrally in `request()`, aborting the underlying
fetch and rejecting with an error that `describeApiError` turns into readable
text.

| Property | Value |
|----------|-------|
| Budget | 15 s, matching SC-005's user-observable guarantee |
| Mechanism | `AbortSignal`, so the in-flight request is actually cancelled, not merely ignored |
| Applies to | every call through `api.get/post/patch/delete` |
| On abort | reject with a timeout error distinguishable from an HTTP error |
| Message | network-failure wording, e.g. "Couldn't reach the server. Check your connection and try again." — never "AbortError" |

**Interaction with retry**: `main.tsx:10` sets `retry: 1`. A timeout counts as one
failure, so worst-case time to the error state is two attempts. The 15 s budget is
therefore **per attempt**, and the retry count must be set so that total time to a
terminal state still meets SC-005 — either a shorter per-attempt budget or no
retry on timeout. This must be decided during implementation and asserted by test,
not left to default behaviour.

**Not in scope**: the raw `fetch` in `Reports.tsx:39` bypasses `api` deliberately
to stream a blob. It needs its own `resp.ok` check (below) rather than the shared
timeout.

---

## Shared component obligation

A single `QueryState` wrapper renders the three states from a TanStack Query
result, so the contract is satisfied once and adopted 14 times rather than
re-implemented 14 times (Principle IV).

Required capabilities:

| Capability | Why |
|------------|-----|
| Accepts `isLoading`, `isError`, `error`, `data`, `refetch` | The full query result drives the state machine |
| Renders a caller-supplied skeleton while loading | Preserves each screen's existing layout |
| Renders error + retry, with text from `describeApiError` | FR-029, FR-031 |
| Renders a caller-supplied empty state when data is present but empty | FR-030 — emptiness is screen-specific |
| Never renders loading when `isError` is true | Rule 2 |

`describeApiError` (`apiClient.ts:36`) already produces appropriate text for 422
field errors, string `detail` values, and 5xx responses. It needs one addition:
a branch for the new timeout/network error so the fallback is not reached.

---

## Adoption inventory

14 modules currently lack an error state. `settings/TeamMembers.tsx` already
handles one and is the reference.

| Module | Current defect | Priority |
|--------|----------------|----------|
| `pages/parties/PartyDetail.tsx:35` | `isLoading \|\| !data` → "Loading party…" forever | **P1** — named in constitution |
| `pages/purchase-orders/PurchaseOrderDetail.tsx:82` | same → "Loading purchase order…" forever | **P1** — named in constitution |
| `pages/dashboard/Dashboard.tsx` | no error state | **P1** — core loop |
| `pages/parties/PartiesList.tsx` | no error state | **P1** — core loop |
| `pages/purchase-orders/PurchaseOrdersList.tsx` | no error state | **P1** — core loop |
| `pages/purchase-orders/PurchaseOrderForm.tsx` | no error state; party dropdown fails silently | **P1** — core loop (FR-019) |
| `components/AppShell.tsx` | no error state; shell bootstrap | **P1** — FR-016; failure degrades every screen |
| `pages/audit/AuditLog.tsx` | no error state | P2 |
| `pages/reports/Reports.tsx` | no error state; plus unchecked export status | P2 |
| `pages/settings/CompanySettings.tsx` | no error state | P2 |
| `components/Notifications.tsx` | no error state | P3 |
| `pages/admin/SuperAdmin.tsx` | no error state | P3 |
| `pages/marketing/Pricing.tsx:51` | `isLoading \|\| !plans` → infinite skeleton | **moot** — rewritten by Stream A |
| `pages/billing/Billing.tsx:59` | `isLoading \|\| !data` | **partly moot** — Stream A rewrites this screen, but the remaining trial card still needs the contract |

**Sequencing consequence**: the last two are rewritten by Stream A, so Stream A
must land first to avoid repairing code about to be replaced (see plan Workstream
Mapping).

---

## Export download obligation

`Reports.tsx:34-50` does not check `resp.ok` and has no `catch`:

```tsx
const resp = await fetch(url, { headers: { Authorization: `Bearer ${tokens?.access_token}` } });
const blob = await resp.blob();          // a 403/500 JSON body becomes the "file"
link.download = filenameMatch?.[1] ?? `${selected}.${format}`;
```

**Required**:
1. Check `resp.ok` before constructing the download; on failure show the error
   state instead of downloading anything (FR-031).
2. Add a `catch` so a network failure surfaces a message rather than an unhandled
   rejection — `finally` alone only clears the spinner.
3. Keep all three formats offered. All three work server-side
   (`backend/src/api/reports.py:172-220`), so FR-039 requires no format to be
   hidden; it requires the ones offered to behave.

---

## Tests required

| Test | Asserts |
|------|---------|
| Each P1 module with a failing query | renders error + retry, not a loading message |
| Each P1 module with a stalled query | reaches the error state within the SC-005 budget |
| Retry | re-issues the request and can resolve to data |
| Each list/detail module with an empty result | renders an empty state naming a next action |
| `apiClient` timeout | aborts the in-flight request and rejects with a readable error |
| `describeApiError` on a timeout | returns network wording, never "AbortError" |
| Error and empty states at mobile width | render without overflow (Principle VIII) |
| Export with a 403 response | shows an error; downloads no file |
| Export with a network failure | shows an error; no unhandled rejection |
