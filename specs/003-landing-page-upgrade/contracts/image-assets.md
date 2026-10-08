# Contract: Image Assets and Capture Manifest

**Date**: 2026-10-08 | **Plan**: [../plan.md](../plan.md)

This contract defines the four product assets, what each must show, and the manifest that records
where each came from. The manifest is what makes screenshot drift reviewable instead of invisible
(research R8).

---

## The four assets

Each is emitted as a 1x and a 2x WebP into `frontend/src/assets/landing/`, captured at
`deviceScaleFactor: 2` with `locator.screenshot()` on the named element.

### 1. `po-detail` — hero (desktop)

| | |
|---|---|
| Screen | `/purchase-orders/:id` for `PO-2001` |
| Element | `data-capture="po-page"` — the whole purchase-order screen |
| Must show | the labels **Ordered**, **Dispatched**, **Remaining** with values **1,000 / 400 / 600**, the PO number, material, unit, due date, the dispatch form, and the dispatch history |
| Target 1x width | 720px |
| `loading` | `eager` |
| Alt text | states that it is the purchase-order screen for a 1,000-ton steel order with 400 dispatched and 600 remaining |

**Revised during implementation.** This asset was originally specified as the header plus the three
stat cards. Captured, that region is roughly 6:1 — a thin strip of three numbers, which reads as a
widget rather than as software. The hero now takes the whole screen, which shows the figures *and*
how a dispatch gets recorded against them. The tight crop survives as asset 1b.

### 1b. `po-summary` — hero (phone)

| | |
|---|---|
| Screen | `/purchase-orders/:id` for `PO-2001` |
| Element | `data-capture="po-summary"` — the header plus the three stat cards |
| Must show | **Ordered 1,000**, **Dispatched 400**, **Remaining 600**, legibly |
| Target 1x width | 560px |
| `loading` | `eager` |
| Used | below the `sm` breakpoint, via `<picture>` art direction |

This is the asset Principle XV turns on. If its labels and figures are not legible at 390px width,
the crop is wrong — not the principle. The full-page shot shrunk to phone width is not legible, which
is why the phone gets its own crop of the same real screen rather than the same file scaled down.
Exactly one of the two is ever fetched.

### 2. `dashboard-balance` — feature block 1

| | |
|---|---|
| Screen | `/dashboard` |
| Element | `data-capture="dashboard-balance"` — the stat row plus both chart panels |
| Must show | **Total Remaining Balance**, **Due Soon**, and at least two parties with balances |
| Target 1x width | 640px |
| `loading` | `lazy` |

**Revised during implementation.** The region spans the PO Status Breakdown panel as well, because
the stat row and the by-party panel are not adjacent siblings in the markup. Capture must wait for
the charts to paint: an early screenshot produced an empty Status Breakdown card, and a blank panel
in a landing image reads as a broken product.

### 3. `dispatch-history` — feature block 2

| | |
|---|---|
| Screen | `/purchase-orders/:id` for `PO-2001` |
| Element | the **Dispatch History** panel |
| Must show | the heading and both dispatch rows (250 and 150), so it reads as a history |
| Target 1x width | 640px |
| `loading` | `lazy` |

### 4. `party-open-orders` — feature block 3

| | |
|---|---|
| Screen | `/parties/:id` for `P-101` |
| Element | the open-orders table |
| Must show | the party name and a table including the **Remaining** and **Due** columns, with at least two open orders |
| Target 1x width | 640px |
| `loading` | `lazy` |

### How-it-works crops

`step-party`, `step-po` and `step-dispatch` are emitted from the same element captures as assets 4,
1b and 3 respectively, at a 1x width of 320px, and are `lazy`. They are the same real pixels at a
smaller size — no separate navigation, and nothing composited.

---

## Asset rules

1. **Format**: WebP only, quality tuned so each 1x asset lands under 60KB and each 2x under 140KB.
2. **Budget**: hero 1x plus 2x at or under 200KB combined; all landing imagery at or under 600KB. The
   capture script prints each size and the totals, and fails if a total is exceeded.
3. **Theme**: light theme for every asset. The capture script must clear the stored theme and force
   `prefers-color-scheme: light` so a developer's dark-mode preference cannot leak into an asset
   (research R1).
4. **Data**: fixture data only, from `seed_landing_demo.py`. No real organization, party, or order may
   appear (FR-018).
5. **Chrome**: window chrome, if any, is drawn by `ScreenshotFrame` in CSS — never baked into the
   captured pixels, so the frame can change without a re-capture.
6. **No annotation**: no arrows, callouts, highlights, or invented badges may be composited onto an
   asset. What the application shows is what the asset shows (FR-017, FR-020).
7. **Committed**: assets are checked in. Capture requires a running stack, so a clean clone must be
   able to build the page without one.

---

## Capture manifest

`frontend/src/assets/landing/manifest.json`, written by the capture script and committed alongside
the assets.

```json
{
  "capturedAt": "2026-10-08T00:00:00Z",
  "appCommit": "5536d0d",
  "fixture": "seed_landing_demo.py",
  "fixtureOrg": "OrderFlow Demo",
  "viewport": { "width": 1440, "height": 900, "deviceScaleFactor": 2 },
  "assets": [
    {
      "name": "po-detail",
      "route": "/purchase-orders/:id",
      "selector": "[data-capture=\"po-summary\"]",
      "files": { "1x": "po-detail.webp", "2x": "po-detail@2x.webp" },
      "dimensions": { "width": 720, "height": 280 },
      "bytes": { "1x": 41203, "2x": 112884 }
    }
  ]
}
```

**Field rules**

- `appCommit` is the commit the application was serving when the assets were taken. A reviewer
  comparing it against the branch's base is how FR-028 and SC-006 become checkable.
- `selector` values are `data-capture` attributes added to the in-app screens for this purpose.
  Capture must not depend on CSS class names, which change for unrelated reasons; a missing
  `data-capture` attribute must fail the capture loudly rather than produce an empty image.
- `bytes` is recorded so a size regression is visible in the diff.
- A manifest entry with no corresponding file, or a file with no entry, fails the asset test.

---

## Social preview image

`frontend/public/og-image.png`, 1200×630, composed from the hero asset beneath a product name and
one line of description, replacing `og-image.svg` (deleted in the same change). Referenced from `index.html` by `og:image` with the `twitter:card` tag left as
`summary_large_image` (research R6). It lives in `public/` rather than `src/assets/` because unfurlers
need a stable, unfingerprinted URL. The old `og-image.svg` is removed in the same change so nothing
keeps pointing at it.
