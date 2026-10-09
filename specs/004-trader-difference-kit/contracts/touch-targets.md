# Contract: Phone Comfort on the Dispatch Path

Covers FR-006 to FR-011 and Principle XXII.

## What "the dispatch path" means

Every screen and control a user touches between opening the application on a phone and seeing the
updated Remaining figure:

1. The app shell — menu open and close, navigation entries.
2. The purchase order list — filters and the row link.
3. The purchase order detail screen — the dispatch form (date, quantity, vehicle, remarks) and its
   submit control.
4. The resulting summary — Ordered, Dispatched, Remaining.

## Measurable requirements

| # | Requirement | How it is measured |
| --- | --- | --- |
| FR-006 | Every interactive control presents a touch target of at least **44×44 CSS pixels** | `boundingBox()` on each control at 390px width; both dimensions ≥ 44 |
| FR-007 | No horizontal document scroll | `document.scrollWidth <= document.clientWidth` at 320, 360, 390, 430px |
| FR-008 | The submit control is reachable with the on-screen keyboard open | Real device (R13); automated substitute below |
| FR-009 | A form's primary action spans the available width at phone widths | Submit control width ≥ form content width minus padding, at 390px |
| FR-010 | Numeric fields request a numeric keypad | Attribute assertion — **already satisfied** at `PurchaseOrderDetail.tsx:179-182` |
| FR-011 | Verified at 320, 360, 390, 430px, automated | `frontend/tests/e2e/mobile-viewport.spec.ts` |

### The 44px figure

It is the long-standing platform guidance for a touch target and the figure the constitution now
names. It applies to the **touch target**, which may exceed the visible control: a 24px icon inside
a 44px padded button satisfies this, and is usually the right implementation.

### Known failures today

`AppShell.tsx:138` (mobile menu close) and `AppShell.tsx:158` (mobile menu open) are `h-9 w-9` —
36px. These are the first two controls a phone user touches. They are the clearest instances; the
work is an audit of the whole path, not a fix to these two.

### FR-008 and what automation cannot do

Playwright does not render a real on-screen keyboard, so keyboard occlusion cannot be fully
asserted. Two things stand in for it:

- **Automated substitute**: the submit control sits in the document flow after the last field,
  rather than being pinned to a position a keyboard would cover. A fixed-bottom submit bar would
  need its own real-device verification before it could be used.
- **Real device**: R13's manual pass, which is the only thing that actually answers this.

Stating this is deliberate. Writing an automated check that appeared to cover keyboard occlusion
would be worse than admitting it does not.

## Timing

SC-002: from the purchase order screen, signed in, an experienced user records a dispatch and sees
the new Remaining figure **within 30 seconds**.

The measurement excludes cold start and sign-in, and assumes a normal mobile connection. Worth
knowing while measuring: a dispatch POST against the configured hosted database was measured at
roughly 2.2 s p50 earlier in this project, against a 12 s client deadline
(`apiClient.ts:51`). The 30 s budget is comfortable, but the headroom is thinner than it looks, and
a slow network is the realistic failure mode rather than a slow interface.

## Verification

Extend `frontend/tests/e2e/mobile-viewport.spec.ts`, which already runs the dispatch path at 390px
and already measures a bounding box at several widths. The mechanism exists; it needs extending, not
inventing.

**Why the assertion matters more than the fix**: the v1.3.0 constitution amendment recorded
Principle XXII as unproven on exactly the 44px and keyboard clauses, because nothing asserted them.
A fix without a test returns to that state at the next layout change, and nobody will notice until
a clerk at a gate does.

## Landing screenshot consequence

Principle XIX requires landing screenshots to match the deployed UI, and the Landing review gate
requires a contradicting UI change to be re-captured in the same unit of work.

The purchase order detail screen is the hero screenshot's subject. If raising control sizes changes
its appearance, `npm run capture:landing` must be re-run **against a local database** in the same
change (R1) — the fixture script refuses a remote host on purpose.
