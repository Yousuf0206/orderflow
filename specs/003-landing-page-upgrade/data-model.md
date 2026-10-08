# Phase 1 Data Model: Landing Page Upgrade

**Date**: 2026-10-08 | **Plan**: [plan.md](./plan.md)

**No database schema changes.** No table, column, index, or migration is added, altered, or removed.
The entities below are of two kinds: a build-time **content model** that lives in TypeScript, and a
**capture fixture** that writes rows through existing models into a development or staging database
so the screenshots have something true to show.

---

## Part 1 — Content model (`frontend/src/content/landing.ts`)

All copy, chips, and asset bindings live in one module so that wording review, the truthfulness test,
and the one-primary-action test each have a single target.

### `LandingContent`

The page's whole content tree. One exported constant.

| Field | Type | Rules |
|-------|------|-------|
| `nav` | `NavContent` | exactly one `primaryAction` |
| `hero` | `HeroContent` | — |
| `proof` | `ProofContent` | — |
| `problemOutcome` | `PainOutcomePair[]` | exactly 3 |
| `features` | `FeatureBlockContent[]` | exactly 3 |
| `steps` | `HowItWorksStep[]` | exactly 3 |
| `trust` | `TrustContent` | exactly 3 statements |
| `finalCta` | `CtaContent` | — |
| `footer` | `FooterContent` | MUST include Privacy and Terms |

### `Action`

| Field | Type | Rules |
|-------|------|-------|
| `label` | `string` | non-empty |
| `to` | `string` | a route path, or an `#anchor` for soft actions |
| `emphasis` | `"primary" \| "soft"` | **At most one `"primary"` may exist in the whole tree** (FR-013) |

### `HeroContent`

| Field | Type | Rules |
|-------|------|-------|
| `eyebrow` | `string` | short, no claim about customers |
| `headline` | `string` | MUST name purchase orders and partial dispatch or remaining balance |
| `subcopy` | `string` | plain language, no jargon (FR-019) |
| `primaryAction` | `Action` | `emphasis: "primary"`, `to: "/signup"` |
| `secondaryAction` | `Action` | `emphasis: "soft"`, `to: "#how-it-works"` |
| `trialMicrocopy` | `(trialDays?: number) => string` | MUST return a numberless string when `trialDays` is undefined (FR-016) |
| `image` | `ImageAssetRef` | MUST be the PO-detail asset |

### `ProofContent`

| Field | Type | Rules |
|-------|------|-------|
| `heading` | `string` | "Built for teams who deliver in parts" |
| `industries` | `string[]` | editable list; seeded as Steel, Cement, Hardware, Pipes, Chemicals (FR-005) |
| `subline` | `string \| null` | optional Excel/WhatsApp line; no customer claim |

### `PainOutcomePair`

| Field | Type | Rules |
|-------|------|-------|
| `pain` | `string` | what goes wrong today, in a trader's words |
| `outcome` | `string` | MUST describe a capability live in the application (FR-006, FR-020) |

### `FeatureBlockContent`

| Field | Type | Rules |
|-------|------|-------|
| `title` | `string` | non-empty |
| `copy` | `string` | 2–3 lines when rendered (FR-007) |
| `bullet` | `string \| null` | optional |
| `image` | `ImageAssetRef` | one of the dashboard, dispatch-history, or party assets |
| `imageSide` | `"left" \| "right"` | alternates down the page at desktop width; ignored when stacked |

### `HowItWorksStep`

| Field | Type | Rules |
|-------|------|-------|
| `number` | `1 \| 2 \| 3` | unique, ordered |
| `title` | `string` | non-empty |
| `text` | `string` | non-empty |
| `image` | `ImageAssetRef` | a small crop of the screen that step happens on |

### `TrustContent`

| Field | Type | Rules |
|-------|------|-------|
| `statements` | `{ title: string; text: string }[]` | exactly 3: roles, audit trail, organization isolation |
| `legalLinks` | `Action[]` | Privacy and Terms, both `emphasis: "soft"` (FR-009) |

### `ImageAssetRef`

| Field | Type | Rules |
|-------|------|-------|
| `src` | imported module URL | 1x WebP, imported so Vite fingerprints it |
| `src2x` | imported module URL | 2x WebP |
| `width` / `height` | `number` | intrinsic 1x dimensions; both required (FR-023) |
| `alt` | `string` | describes what the screen shows, not "screenshot" (FR-025) |
| `loading` | `"eager" \| "lazy"` | `"eager"` permitted only for the hero asset (R4) |

### Content invariants the unit test enforces

1. Exactly one `Action` in the tree has `emphasis: "primary"`, and its `to` is `/signup`.
2. No `Action` points at a checkout, upgrade, or plan-purchase route (FR-014).
3. Rendered copy matches none of the banned proof patterns: a customer count, "trusted by",
   "customers", "reviews", "rating", "testimonial" (FR-015, SC-007).
4. Rendered copy contains none of the banned jargon terms, including "orchestration" and "synergy"
   (FR-019).
5. Every `ImageAssetRef` has a non-empty `alt` and both dimensions, and exactly one is `eager`.
6. `trialMicrocopy(undefined)` contains no digits.
7. `footer.links` includes both Privacy and Terms.

---

## Part 2 — Capture fixture (`backend/src/scripts/seed_landing_demo.py`)

Writes through the existing `Organization`, `User`, `Membership`, `Subscription`, `Party`,
`PurchaseOrder`, and `Dispatch` models. Separate from `seed.py`, which must keep producing what local
development expects (see research R5).

**Organization**: `OrderFlow Demo` — currency USD, timezone UTC, plan tier `trial`. Distinct name
from `seed.py`'s `Demo Trading Co`, so the two fixtures coexist and neither short-circuits the other.

**Owner**: `demo@orderflow.example` / a fixture password, Owner role, invite accepted. The
`.example` domain cannot route mail, which keeps the fixture account from ever receiving anything.

**Parties**: `P-101` `Northgate Steel Works` (Lahore) and `P-102` `Civic Cement Traders` (Karachi),
both fictional (FR-018). The second party was added during implementation: with one party the
dashboard's by-party panel showed a single bar, which the asset contract forbids.

**Purchase order** — the hero subject:

| Field | Value |
|-------|-------|
| `po_number` | `PO-2001` |
| `material` | `TMT Steel Bars 12mm` |
| `ordered_qty` | `1000` |
| `unit` | `ton` |
| `order_date` | today − 18 days |
| `due_date` | today + 12 days (a future due date, so the screenshot reads as live, not overdue) |

**Dispatches** — two rows, so Dispatch History shows a history rather than one line:

| Dispatch date | Qty |
|---------------|-----|
| today − 11 days | 250 |
| today − 4 days | 150 |

**Derived, never stored** (Principle II): total dispatched 400, remaining balance 600. The screenshots
show these because the application computes them, which is the whole point of capturing rather than
drawing.

**Supporting rows for the other three assets**: two further purchase orders — `PO-2002` against
`P-101` and `PO-2003` against `P-102` — each partially dispatched and none overdue, so the
dashboard's Total Remaining Balance and Remaining Balance by Party sections and the party's
open-orders table each have more than one row.

**Idempotence**: the script exits without writing if `OrderFlow Demo` already exists, matching
`seed.py`'s behavior, and accepts a flag to drop and recreate so a re-capture starts from known
numbers.

---

## State transitions

None. The landing page holds no state. Its one asynchronous value, the trial length, is read-only and
already owned by the server (FR-016).
