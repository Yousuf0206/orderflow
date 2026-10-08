# Phase 0 Research: Landing Page Upgrade

**Date**: 2026-10-08 | **Plan**: [plan.md](./plan.md)

The spec carried no `[NEEDS CLARIFICATION]` markers, so this phase resolves the technical unknowns
that reading the existing code surfaced, plus the choices the implementation brief left open.

---

## R1. Theme collision: the app's components are dark-aware, the landing page is not

**Finding.** `frontend/index.html` runs an inline script that adds the `dark` class to
`<html>` from `localStorage` or the OS `prefers-color-scheme`. The shared components carry dark
variants — `Card.tsx` has `dark:bg-slate-900`, `StatCard.tsx` has eight `dark:` classes. Today's
`Landing.tsx` wraps everything in `bg-white` but composes `Card`, so **a dark-preference visitor
already sees dark cards on a white page**. The new page adds light-theme screenshots, which would
make the mismatch worse and would violate the spec's consistency requirement (FR-017) and the "one
consistent treatment" edge case.

**Decision.** Landing sections are built as new, light-only presentational components under
`frontend/src/components/marketing/`. They do not import `Card`, `StatCard`, or any component
carrying `dark:` variants.

`Button` is a partial exception, confirmed by reading it: its **primary** variant carries no `dark:`
classes and is reused unchanged, while its `secondary` and `ghost` variants do (`Button.tsx:9-10`).
The marketing sections therefore use primary `Button` for the trial action and a local light-only
style for the soft secondary action. This also fixes a live instance of the bug: today's closing
call-to-action band renders `variant="secondary"` on a brand-purple panel, which turns dark slate on
purple for a dark-preference visitor (`Landing.tsx:182`).

**Rationale.** It is the smallest change that makes the page internally consistent, it costs nothing
at runtime, and it draws a hard line between public marketing presentation and the signed-in app's
themed UI so that a future in-app redesign cannot silently alter the public page.

**Alternatives considered.**
- *Strip the `dark` class on public routes.* Touches the theme bootstrap that every page depends on,
  risks a flash of the wrong theme, and changes `/login`, `/signup`, and the legal pages, none of
  which this feature was asked to touch.
- *Make the landing page fully dark-aware.* Would require a second set of captured assets in the dark
  theme and doubles the drift surface for Principle XIX, for a public page where a single confident
  treatment is the norm.

**Out of scope, recorded not fixed.** `/pricing` and the legal pages have the same pre-existing
mismatch. This feature fixes the homepage and the shared header and footer only.

---

## R2. How the screenshots are produced

**Decision.** A Playwright script, `frontend/scripts/capture-landing.ts`, runs against a local or
staging stack signed in as the demonstration owner, navigates to each screen, and takes **element-
scoped** screenshots via `locator.screenshot()` at `deviceScaleFactor: 2`.

**Rationale.** Element-scoped capture crops tightly by construction, so there is no manual cropping
step to redo and no cropping tool to agree on — the brief's "crop tightly; export 2x for retina"
falls out of the mechanism. Driving the real UI is what makes Principle XIX true by construction
rather than by diligence, and it is what makes SC-010 (re-capture in under 30 minutes) achievable.

**Alternatives considered.**
- *Manual screenshots plus an image editor.* Fastest the first time, unrepeatable afterwards; drift
  correction becomes a half-day each time an in-app screen changes.
- *Hand-built HTML replicas of the screens.* The constitution permits a faithful reproduction, but a
  replica drifts invisibly: nothing fails when the real screen changes.

**Consequence.** Capture requires a running backend and a seeded database, so it is a developer
command, not a CI step. CI verifies that the committed assets exist and are bound, not that they are
freshly captured.

---

## R3. Image format, resolution, and fingerprinting

**Decision.** WebP only, no `<picture>` fallback. Each asset is emitted at a 1x and a 2x width and
referenced through `srcset`. Assets live in `frontend/src/assets/landing/` and are **imported** by
the components rather than referenced from `public/`.

**Rationale.** Importing lets Vite fingerprint the filenames, which permits long-lived caching and —
more usefully — makes a missing or renamed asset a build failure instead of a broken image in
production. WebP is universally supported by the browsers this SPA already requires, and it is
roughly half the bytes of PNG for screenshot content, which is what buys the SC-003 budget.

**Alternatives considered.** PNG in `public/` (simplest, but unhashed, heavier, and fails silently);
AVIF (smaller still, but slower to encode and a needless third format for four images).

**Budget.** Above-the-fold imagery at or under 200KB; all landing imagery at or under 600KB. The
capture script reports each asset's encoded size so a regression is visible when it happens.

---

## R4. Largest contentful paint and layout stability

**Decision.** The hero image is eager, carries `fetchpriority="high"`, and declares explicit `width`
and `height`. Every below-the-fold image is `loading="lazy"` and `decoding="async"`, and also
declares intrinsic dimensions. Fonts already preconnect in `index.html` and are left alone.

**Rationale.** The brief asks to "keep LCP on hero image + headline". Lazy-loading the hero would
defeat that, and omitting dimensions would trade one metric for a layout shift that FR-023 forbids.
Declaring dimensions on the lazy images costs nothing and keeps the page from reflowing as the
visitor scrolls.

---

## R5. The capture fixture and the numbers in the screenshots

**Decision.** A separate fixture script, `backend/src/scripts/seed_landing_demo.py`, creates a
dedicated organization with one party and a purchase order of **1,000 ordered, 400 dispatched, 600
remaining**, built from two dispatches so Dispatch History has more than one row to show.

**Rationale.** The brief specifies those numbers; they read as a real trade and they make the
Remaining figure obviously derived rather than arbitrary. The existing `seed.py` cannot be reused:
it creates `PO-1001` with an ordered quantity of 100, and it short-circuits when `Demo Trading Co`
already exists, so bending it to serve capture would change what every developer's local database
looks like.

**Data.** Fictional only — party, material, and quantities are invented for the fixture, satisfying
FR-018. The concrete values are specified in [data-model.md](./data-model.md).

---

## R6. Social preview image

**Decision.** Replace `frontend/public/og-image.svg` with a raster `og-image.png` at 1200×630,
composed from the hero screenshot, and update the three `og:`/`twitter:` tags in `index.html` to
point at it.

**Rationale.** The brief asks that `og:image` be able to use the hero. SVG is poorly supported by
link unfurlers, so the current asset likely renders as nothing in Slack and WhatsApp — where traders
actually forward links. This is a static `index.html` edit because, as `usePageMeta`'s own comment
records, the SPA has no server rendering and unfurlers never execute its JavaScript.

**Scope note.** The spec places broader social and search optimization out of scope. This is the one
exception the brief explicitly asked for, and it is confined to swapping one asset and three tags.

---

## R7. The secondary call to action

**Decision.** The hero's secondary action becomes "See how it works", an in-page anchor that scrolls
to the how-it-works section, honoring `prefers-reduced-motion` by jumping instead of animating.
Pricing remains reachable from the navigation and the footer.

**Rationale.** Principle XVI requires the secondary action to be soft and subordinate; an in-page
anchor cannot compete with the trial button because it does not leave the page. The current page's
"See pricing" secondary points away from the one action that matters, which is exactly what the
principle is written against.

**Note.** This is a visible change from today's hero. Pricing loses no reachability — it stays in two
places — but it stops being the hero's co-star.

---

## R8. Automating the landing review gate

**Decision.** The constitution's Launch Gates "Landing review" asks five questions at review time.
Four become automated assertions and one stays human:

| Gate question | Enforcement |
|---------------|-------------|
| Hero shows a real product screen | `landing.spec.ts` asserts the hero image is in the viewport and loaded at 1280×800 and 390×844 |
| Exactly one primary call to action | `landingContent.test.tsx` asserts one primary action across the assembled content |
| Every proof claim is real | `landingContent.test.tsx` scans rendered copy for customer-count, logo, testimonial, and rating patterns |
| CTA reachable at 390px without horizontal scroll | `mobile-viewport.spec.ts`, extended to 320/360/390/430 |
| Screenshots match the deployed UI | **Human.** The capture manifest records the commit and fixture behind each asset; a reviewer confirms re-capture happened when an in-scope screen changed |

**Rationale.** A gate that depends on someone remembering is a gate that fails quietly. The fifth
stays human because deciding whether an in-app change is visible enough to require re-capture is a
judgement, not a comparison — but the manifest makes the judgement cheap by recording what each asset
was taken from.

---

## Summary of decisions

| # | Decision |
|---|----------|
| R1 | Light-only marketing components; no reuse of `dark:`-aware app components |
| R2 | Playwright element-scoped capture at 2x against a running stack |
| R3 | WebP only, 1x + 2x via `srcset`, imported from `src/assets` for fingerprinting |
| R4 | Hero eager with high fetch priority; below-fold lazy; dimensions everywhere |
| R5 | Dedicated fixture: 1,000 ordered / 400 dispatched / 600 remaining, two dispatches |
| R6 | Raster 1200×630 `og-image.png` from the hero; three static meta tags updated |
| R7 | Secondary CTA is an in-page anchor to How it works, reduced-motion aware |
| R8 | Four of five landing-review gate questions automated; the fifth made cheap |

No unresolved unknowns remain. Phase 1 proceeded on these decisions.
