# Implementation Plan: Landing Page Upgrade

**Branch**: `003-landing-page-upgrade` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-landing-page-upgrade/spec.md`

## Summary

Replace the text-only public homepage with a nine-section landing page whose hero carries a real
screenshot of the purchase-order detail screen showing Ordered / Dispatched / Remaining, and whose
three feature blocks and three how-it-works steps each carry a crop of a real application screen.

The technical approach is deliberately small: eight presentational section components plus a shared
site header and footer, composed by the existing `Landing` page, in the existing Vite + React +
Tailwind frontend. No new runtime dependency ships to the browser. The only new build-time machinery
is a Playwright capture script that signs into a seeded demonstration organization and saves four
image assets, so that refreshing them after an in-app UI change is a command rather than a project
(FR-028, SC-010).

Two findings from reading the current code shaped the plan and are resolved in
[research.md](./research.md):

1. The shared `Card` and `StatCard` components carry `dark:` variants, and `index.html` adds the
   `dark` class from the visitor's OS preference. A dark-preference visitor therefore sees dark cards
   on today's white landing page. Since this feature's assets are captured in the light theme, the
   landing page gets its own light-only presentational components rather than reusing the app's
   themed ones.
2. The existing seed script creates `PO-1001` with an ordered quantity of 100 and guards against
   re-seeding. The brief asks for 1,000 ordered / 400 dispatched / 600 remaining in the screenshots,
   so capture gets its own fixture script rather than changing what local development seeds.

## Technical Context

**Language/Version**: TypeScript 5.6, React 18.3 (frontend); Python 3.12 (fixture script only)

**Primary Dependencies**: Vite 5.4, Tailwind CSS 3.4, react-router-dom 6.27, lucide-react,
@tanstack/react-query 5 (all already present). Build-time only: `@playwright/test` 1.48 (present) and
`sharp` (new devDependency, used by the capture script to emit WebP; never imported by application
code)

**Storage**: N/A — no schema change, no new persisted data. The capture fixture writes rows through
existing models into a local/staging database only.

**Testing**: Vitest + Testing Library for unit/component tests; Playwright for end-to-end and
viewport checks (`frontend/tests/e2e/mobile-viewport.spec.ts` already asserts no horizontal scroll at
390px for `/`)

**Target Platform**: Modern evergreen browsers; mobile viewports from 320px. Deployed as a static SPA
through the `frontend` service in `vercel.json`.

**Project Type**: Web application (existing `frontend/` + `backend/` split)

**Performance Goals**: Largest contentful paint under 2.5s on a mid-range phone over a typical mobile
connection (SC-003); zero layout shift from image loading; above-the-fold image payload at or under
200KB, total landing image payload at or under 600KB

**Constraints**: Static images only, no video (FR-022). No horizontal scroll from 320px to 430px
(FR-024). No new browser-shipped dependency. No paid or checkout surface (FR-014). Trial length must
come from the server with a numberless fallback (FR-016). Light theme only for this page.

**Scale/Scope**: One public route rebuilt, one route touched for header/footer consistency
(`/pricing`), eight new section components plus two shared layout components, four captured image
assets plus one social-preview image, one capture script, one fixture script.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `.specify/memory/constitution.md` v1.2.0.

| Gate | Source | Verdict | How this plan satisfies it |
|------|--------|---------|----------------------------|
| Hero shows a real product screen above the fold | XV | PASS | Captured PO-detail asset rendered eagerly in `Hero`; asserted at 1280×800 and 390×844 in Playwright |
| Exactly one primary call to action | XVI, IX | PASS | One `Button` style for "Start free trial"; hero secondary becomes a soft in-page anchor to How it works; Pricing demoted to nav/footer links |
| No paid or checkout surface | IX, XIV | PASS | No pricing cards, no upgrade action on `/`; existing `paidSurfaceGated` unit test extended to cover the new page |
| Proof claims are real | XVII, XI | PASS | Industry chips only; no counts, logos, testimonials or ratings anywhere in the new markup |
| Fast and reachable on a phone | XVIII, VIII | PASS | WebP assets with explicit dimensions, eager hero and lazy below-fold images, single-column stack, full-width CTAs; existing 390px no-scroll e2e covers `/` and gains width cases |
| Screenshots match the shipped UI | XIX | PASS | Assets captured from the running application, not drawn; capture script is the documented refresh path |
| No silent failures | XII | PASS | The one asynchronous value on the page (trial length) already falls back to "Free trial"; images fall back to descriptive alt text |
| Simplicity over features | IV | PASS | Presentational components only; no state management, no new runtime dependency, no CMS |
| Smoke test before production deploy | XIII | PASS | Unchanged — this feature touches no core-loop code, and the existing smoke path still gates the deploy |
| Landing review gate | Launch Gates | PASS | The five assertions that gate now map onto automated checks listed in [quickstart.md](./quickstart.md) rather than a manual reading |
| Mobile + desktop equality | VIII | PASS | Two-column at desktop, stacked at mobile, verified at both ends rather than assumed |

**Result: all gates pass. No deviation requested, so Complexity Tracking is omitted.**

Two notes recorded rather than waived:

- The dark-class behavior described in the Summary is a pre-existing cosmetic defect that also
  affects `/pricing` and the legal pages for dark-preference visitors. This plan fixes it only where
  it falls inside the feature's scope — the homepage and the shared header and footer. The remaining
  surfaces are called out in research.md as observed-but-out-of-scope rather than silently fixed or
  silently left.
- `sharp` is a new dependency, which Principle IV invites scrutiny of. It is a devDependency invoked
  only by the capture script; nothing it produces reaches the browser except the image bytes, and the
  alternative (checking in uncompressed PNGs) costs the performance gate in Principle XVIII.

## Project Structure

### Documentation (this feature)

```text
specs/003-landing-page-upgrade/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── landing-sections.md    # Section content contract
│   └── image-assets.md        # Asset + capture manifest contract
├── checklists/
│   └── requirements.md  # From /speckit-specify
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── public/
│   └── og-image.png                   # replaces og-image.svg for social previews
├── scripts/
│   └── capture-landing.ts             # Playwright capture + WebP export (build-time only)
├── src/
│   ├── assets/landing/                # captured assets, imported so Vite fingerprints them
│   │   ├── po-detail.webp             # + @2x
│   │   ├── dashboard-balance.webp     # + @2x
│   │   ├── dispatch-history.webp      # + @2x
│   │   └── party-open-orders.webp     # + @2x
│   ├── components/
│   │   ├── marketing/                 # new: light-only presentational sections
│   │   │   ├── SiteHeader.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── ProofStrip.tsx
│   │   │   ├── ProblemOutcome.tsx
│   │   │   ├── FeatureBlock.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── TrustRow.tsx
│   │   │   ├── FinalCta.tsx
│   │   │   ├── SiteFooter.tsx
│   │   │   └── ScreenshotFrame.tsx    # shared window chrome + responsive <img>
│   │   └── ui/                        # unchanged app components
│   ├── content/
│   │   └── landing.ts                 # all copy, chips, and asset bindings in one place
│   └── pages/marketing/
│       ├── Landing.tsx                # recomposed from the sections above
│       └── Pricing.tsx                # header/footer swapped for the shared ones
└── tests/
    ├── e2e/
    │   ├── landing.spec.ts            # new: above-fold, CTA, anchor, legal links
    │   └── mobile-viewport.spec.ts    # extended: 320/360/390/430 widths
    └── unit/
        ├── landingContent.test.tsx    # new: one primary CTA, no banned claims, every asset bound
        └── paidSurfaceGated.test.tsx  # extended to cover the rebuilt page

backend/
└── src/scripts/
    └── seed_landing_demo.py           # capture fixture: PO-2001, 1000 ordered / 400 dispatched
```

**Structure Decision**: the existing `frontend/` + `backend/` split is kept as-is. New work
concentrates in `frontend/src/components/marketing/` so that landing-only, light-only presentation
cannot be confused with the themed `ui/` components the signed-in app depends on, and so a future
in-app redesign cannot silently change the public page. Copy lives in one `content/landing.ts` module
so wording review and the "no unverifiable claims" test have a single target (FR-005, FR-019,
SC-007).

## Phase Outputs

- **Phase 0** — [research.md](./research.md): eight decisions, including the dark-theme collision,
  capture mechanism, image format and fingerprinting, hero LCP handling, fixture numbers, the social
  preview image, the secondary call to action, and how the landing review gate is automated.
- **Phase 1** — [data-model.md](./data-model.md) (content model and capture fixture; no schema
  change), [contracts/landing-sections.md](./contracts/landing-sections.md),
  [contracts/image-assets.md](./contracts/image-assets.md), and
  [quickstart.md](./quickstart.md) (how to seed, capture, run, and validate).

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 artifacts were written. All gates still pass, with three design decisions
worth recording because each one was made to keep a gate honest rather than to satisfy it on paper:

- **XIX is enforced by construction, not by diligence.** Because the assets are produced by a script
  that drives the real UI, a landing screenshot cannot drift from the application without someone
  editing a checked-in binary by hand. The capture manifest records which commit and which fixture
  produced each asset, so drift is detectable in review.
- **XVI is enforced by test, not by taste.** `landingContent.test.tsx` asserts exactly one primary
  action across the assembled content module, so adding a second primary button fails CI rather than
  review.
- **XVII is enforced by test, not by trust.** The same test scans rendered landing copy for
  customer-count, logo, testimonial, and rating patterns, so a future copy edit that smuggles in
  "trusted by 500 traders" fails rather than ships.
