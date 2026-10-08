# Quickstart: Validating the Landing Page Upgrade

**Date**: 2026-10-08 | **Plan**: [plan.md](./plan.md)

How to seed, capture, run, and validate. The capture path is also the documented refresh procedure
required by FR-028 and timed by SC-010 — it should take well under 30 minutes.

---

## Prerequisites

- Backend dependencies installed and migrations applied (see `backend/` setup).
- `cd frontend && npm install` — this feature adds `sharp` as a devDependency.
- Playwright browsers available: `npx playwright install chromium`.

---

## A. Refresh the screenshots (only when an in-app screen changed)

A clean clone does **not** need this: the assets are committed. Run it when a screen that appears in
a landing asset has changed, or when the fixture numbers change.

```bash
# 1. Seed the capture fixture (idempotent; --recreate to start clean)
cd backend
python -m src.scripts.seed_landing_demo

# 2. Start the backend
# (however this project runs it locally, e.g. uvicorn on the configured port)

# 3. Capture — starts the dev server itself via Playwright's webServer config
cd ../frontend
npm run capture:landing
```

**Expected output**: eight WebP files plus the how-it-works crops in
`src/assets/landing/`, a rewritten `manifest.json`, and a size report. The script fails loudly rather
than writing a bad asset if:

- a `data-capture` selector is missing from a screen,
- the PO summary does not read 1,000 / 400 / 600,
- any size budget from [contracts/image-assets.md](./contracts/image-assets.md) is exceeded.

**Then**: review the image diff and confirm `manifest.json`'s `appCommit` is the commit you captured
against. That pair — a new image and a matching commit — is the evidence the Landing review gate asks
for.

---

## B. Run the page

```bash
cd frontend
npm run dev
# open http://localhost:5173/
```

Check by eye, in this order, because each maps to a constitution gate:

1. **Without scrolling**, the purchase-order screenshot showing Ordered / Dispatched / Remaining is
   visible (Principle XV).
2. There is **one** button that looks like the main action, and it says Start free trial (XVI).
3. Nothing on the page claims a customer, a review, or a rating (XVII).
4. Narrow the window to 390px: single column, copy above the image, no sideways scroll, CTA full
   width (XVIII).
5. Every screenshot's labels match what you see at `/purchase-orders/:id`, `/dashboard`, and
   `/parties/:id` (XIX).
6. Set your OS to dark mode and reload: the landing page must look **the same** (research R1).

---

## C. Automated validation

```bash
cd frontend
npm run lint
npm test                    # Vitest: content and gating tests
npm run build               # must succeed; a missing asset import fails here
npm run test:e2e            # Playwright: viewport, CTA, anchor, legal links
```

What each covers:

| Command | Covers |
|---------|--------|
| `npm test` → `landingContent.test.tsx` | one primary action; no banned proof claims; no jargon; every asset bound with alt text and dimensions; numberless trial fallback; Privacy and Terms present (FR-013, FR-015, FR-016, FR-019, FR-025, SC-005, SC-007) |
| `npm test` → `paidSurfaceGated.test.tsx` | no purchasable paid action on the rebuilt page (FR-014, Principles IX and XIV) |
| `npm run build` | every image import resolves — a renamed or deleted asset cannot reach production (research R3) |
| `npm run test:e2e` → `landing.spec.ts` | hero image in viewport and loaded at 1280×800 and 390×844; CTA navigates to `/signup`; the secondary action scrolls to `#how-it-works`; Privacy and Terms resolve; header and footer match on `/pricing` (SC-001, SC-009, FR-012) |
| `npm run test:e2e` → `mobile-viewport.spec.ts` | no horizontal scroll at 320, 360, 390, and 430px (FR-024, SC-004) |

---

## D. Checks that stay manual

These are not automatable with the tools in this repository, so they are stated plainly rather than
pretended away:

- **SC-002 (ten-second comprehension).** Show the page to five people who have not seen OrderFlow and
  ask what it does. Four should mention tracking orders and what is left to deliver.
- **SC-003 (load performance).** Measure largest contentful paint on a mid-range phone or an equivalent
  throttled profile against the deployed preview, not the dev server — the dev server does not
  compress or cache the way production does.
- **Screenshot fidelity judgement.** Deciding whether an in-app change is visible enough to require a
  re-capture. The manifest's `appCommit` makes the question cheap to ask; it does not answer it.
- **Copy review.** Headline, eyebrow, and section wording are expected to get a product-owner pass
  before release (spec Assumptions).

---

## Rollback

The page is presentational and self-contained. Reverting the feature commit restores the previous
`Landing.tsx` with no data migration, no cache to clear, and no server-side change — the only shared
edits are `index.html`'s social tags and the `data-capture` attributes added to in-app screens, and
neither has a runtime effect.
