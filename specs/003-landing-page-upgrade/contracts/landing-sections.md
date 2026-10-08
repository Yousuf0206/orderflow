# Contract: Landing Section Components

**Date**: 2026-10-08 | **Plan**: [../plan.md](../plan.md)

The landing page's external contract is a UI contract: what each section guarantees to a visitor and
to assistive technology. Component props are listed because they are the seam a test drives, not
because the shapes are interesting.

All components live in `frontend/src/components/marketing/`, are presentational (no data fetching, no
state beyond a disclosure menu), and are **light-theme only** — none may introduce a `dark:` class
(research R1).

---

## Shared rules (every section)

1. Each section renders a landmark-appropriate element: `<header>`, `<nav>`, `<footer>`, or
   `<section>` with an accessible name from its own heading.
2. Heading order is sequential: one `<h1>` on the page (the hero headline), `<h2>` per section,
   `<h3>` within a section. No level is skipped.
3. No section may render a second primary action. Primary emphasis is the hero's and the closing
   call-to-action's shared single style, and both point at `/signup`.
4. No section may render a customer count, logo, testimonial, rating, or review.
5. Any motion is wrapped in a `prefers-reduced-motion` guard.
6. Horizontal padding is at least 16px at every viewport, and no section may set a fixed width that
   exceeds the viewport below 430px.

---

## `SiteHeader`

**Props**: `{ content: NavContent }`

**Guarantees**
- Renders the logo as a link to `/`, plus Pricing, Log in, and a primary "Start free trial" button.
- Below the `sm` breakpoint, either compact links or a disclosure menu — and the trial button stays
  visible either way (FR-002).
- A disclosure menu, if used, is a real toggle button with `aria-expanded` and `aria-controls`, is
  closable with `Escape`, and returns focus to the toggle on close.
- Identical markup on `/` and `/pricing` (FR-012).

---

## `Hero`

**Props**: `{ content: HeroContent; trialDays?: number }`

**Guarantees**
- Renders eyebrow, `<h1>`, subcopy, primary action, soft secondary action, trial microcopy, and the
  framed product image.
- At the `lg` breakpoint and above: two columns, copy left, image right. Below it: one column, copy
  above image (FR-004).
- The image is the hero asset, rendered `eager` with `fetchpriority="high"` and explicit dimensions
  (research R4).
- Trial microcopy calls `content.trialMicrocopy(trialDays)` and therefore shows no number when the
  server value has not arrived (FR-016, Principle XII).
- The secondary action is an in-page anchor to `#how-it-works`; it is never styled as primary.
- At 390px the primary action is full width.

---

## `ProofStrip`

**Props**: `{ content: ProofContent }`

**Guarantees**
- Renders the heading and the industry list as chips, wrapping rather than scrolling at narrow
  widths.
- The industry list is rendered from `content.industries` with no hard-coded fallback, so editing one
  list edits the page (FR-005).
- Renders the optional subline only when present, and it makes no claim about customers.

---

## `ProblemOutcome`

**Props**: `{ heading: string; pairs: PainOutcomePair[] }`

**Guarantees**
- Renders exactly three pain-to-outcome pairs; the pairing is conveyed in the markup (not by
  left/right position alone) so it survives a screen reader and a single-column layout.
- No image. This section is the page's one deliberate breather between screenshots.

---

## `FeatureBlock`

**Props**: `{ content: FeatureBlockContent }`

**Guarantees**
- Renders title, 2–3 lines of copy, the optional bullet, and the product crop.
- Two columns at `lg` and above, alternating image side via `content.imageSide`; stacked below, always
  copy-then-image regardless of `imageSide`.
- The image is `lazy` with explicit dimensions.
- Rendered three times by `Landing`, once per feature — dashboard remaining balance, partial dispatch
  with Dispatch History, party open orders (FR-007).

---

## `HowItWorks`

**Props**: `{ steps: HowItWorksStep[] }`

**Guarantees**
- Carries `id="how-it-works"` — the hero's secondary action depends on this anchor existing.
- Renders three numbered steps, each with number, title, text, and a small lazy crop.
- Step numbers are decorative in the markup; the reading order carries the sequence.

---

## `TrustRow`

**Props**: `{ content: TrustContent }`

**Guarantees**
- Renders exactly three statements: the Owner / Manager / Staff / Viewer role model, the audit trail,
  and per-organization data isolation (FR-009).
- Renders Privacy and Terms as real links to `/privacy` and `/terms`.
- Makes no security claim beyond what the application enforces — no certification, compliance
  standard, or encryption claim is permitted here.

---

## `FinalCta`

**Props**: `{ content: CtaContent; trialDays?: number }`

**Guarantees**
- Renders a heading, the primary trial action, and microcopy, and introduces no competing action
  (FR-010).
- Shares the hero's primary action style, so the page has one primary treatment rather than two that
  merely look alike.
- Any contrast-bearing surface behind it meets the text contrast minimum in both the light default
  and when the OS prefers dark (which, per research R1, must not change this page).

---

## `SiteFooter`

**Props**: `{ content: FooterContent }`

**Guarantees**
- Renders the copyright line and the standard links, including Privacy and Terms (FR-011).
- The same component instance is used by `/` and `/pricing`, so the two cannot drift.

---

## `ScreenshotFrame`

**Props**: `{ image: ImageAssetRef; chrome?: "window" | "none"; className?: string }`

**Guarantees**
- Renders `<img>` with `src`, `srcSet` (`1x` and `2x`), `width`, `height`, `alt`, `loading`, and
  `decoding="async"`.
- Optional window chrome is decorative: `aria-hidden`, no text content, and it never wraps the image
  in a way that announces itself.
- Reserves the image's aspect ratio before load, so nothing shifts when the bytes arrive (FR-023).
- When the image fails to load, the `alt` text remains visible in the frame's space (FR-003's
  fallback scenario, US1 scenario 5).

---

## Page composition (`Landing.tsx`)

**Guarantees**
- Renders the nine sections in the order given by FR-001, reading content from
  `frontend/src/content/landing.ts` and nothing else.
- Passes `trialDays` from the existing `usePublicPlans()` hook, unchanged in behavior.
- Keeps the current `usePageMeta(...)` title and description (research R6 changes only the static
  social tags).
- Adds no route, no provider, and no global style.
