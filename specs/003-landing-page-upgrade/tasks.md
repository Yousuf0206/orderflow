---

description: "Task list for Landing Page Upgrade"
---

# Tasks: Landing Page Upgrade

**Input**: Design documents from `/specs/003-landing-page-upgrade/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. The plan's Constitution Check and research R8 commit four of the five
Landing-review gate questions to automated checks, so the test tasks below are gate enforcement, not
optional extras.

**Organization**: Tasks are grouped by user story. Each story phase leaves the homepage in a
shippable state, so US1 can go to production without US2 or US3 existing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task

## Path Conventions

Web app layout per plan.md: `frontend/src/`, `frontend/tests/`, `backend/src/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: make the new directories, the build-time dependency, and the capture selectors exist.

- [X] T001 Add `sharp` to `devDependencies` and a `"capture:landing": "playwright test --config=playwright.capture.config.ts"` script in `frontend/package.json`, then run `npm install` in `frontend/`
- [X] T002 [P] Create empty directories `frontend/src/components/marketing/`, `frontend/src/assets/landing/`, `frontend/src/content/`, and `frontend/scripts/` (add `.gitkeep` where needed so they survive a clone)
- [X] T003 [P] Add `data-capture` attributes to the in-app screens the capture script targets, per `contracts/image-assets.md`: `data-capture="po-summary"` on the header-plus-stat-row wrapper and `data-capture="dispatch-history"` on the Dispatch History panel in `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx`; `data-capture="dashboard-balance"` on the stat row plus Remaining Balance by Party panel in `frontend/src/pages/dashboard/Dashboard.tsx`; `data-capture="party-open-orders"` on the open-orders table in `frontend/src/pages/parties/PartyDetail.tsx`. Attributes only — no behavior, style, or markup-structure change.
- [X] T004 [P] Create `frontend/playwright.capture.config.ts` for the capture run: `testDir: "./scripts"`, viewport 1440×900, `deviceScaleFactor: 2`, `colorScheme: "light"`, and `reuseExistingServer: true` so it attaches to an already-running dev server

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the fixture, the content types, the capture pipeline, and the four assets. Every user
story needs at least one asset, and all assets come out of one capture run, so this phase blocks all
three stories.

**CRITICAL**: no user story work can begin until T010 has produced committed assets.

- [X] T005 Create `backend/src/scripts/seed_landing_demo.py` writing through the existing models, with these values quoted verbatim from `data-model.md`: Organization `OrderFlow Demo` (currency `USD`, timezone `UTC`, plan tier `trial`); Owner `demo@orderflow.example` with Owner role and `accepted_at` set; Subscription on `trial` reading `settings.trial_length_days` (never a hardcoded 14); Party `P-101` / `Northgate Steel Works` / city `Lahore`; PurchaseOrder `PO-2001`, material `TMT Steel Bars 12mm`, `ordered_qty=1000`, `unit="ton"`, `order_date` = today − 18 days, `due_date` = today + 12 days; two Dispatches — today − 11 days qty `250` and today − 4 days qty `150`. Exit without writing if `OrderFlow Demo` exists; accept a `--recreate` flag to drop and rebuild.
- [X] T006 [P] Extend `backend/src/scripts/seed_landing_demo.py` with two further partially-dispatched, non-overdue purchase orders against `P-101`, so the dashboard's Remaining Balance by Party panel and the party's open-orders table each show at least two rows (required by assets 2 and 4 in `contracts/image-assets.md`)
- [X] T007 [P] Create `frontend/src/content/landingTypes.ts` with the content-model types from `data-model.md`: `LandingContent`, `Action` (`emphasis: "primary" | "soft"`), `HeroContent` (including `trialMicrocopy: (trialDays?: number) => string`), `ProofContent`, `PainOutcomePair`, `FeatureBlockContent` (`imageSide: "left" | "right"`), `HowItWorksStep` (`number: 1 | 2 | 3`), `TrustContent`, `CtaContent`, `FooterContent`, and `ImageAssetRef` (`src`, `src2x`, `width`, `height`, `alt`, `loading`)
- [X] T008 [P] Create `frontend/src/components/marketing/ScreenshotFrame.tsx` per `contracts/landing-sections.md`: renders `<img>` with `srcSet` at `1x`/`2x`, required `width`/`height`/`alt`, `decoding="async"`, caller-supplied `loading`, optional `aria-hidden` CSS window chrome, aspect-ratio space reserved before load, and `alt` text left visible in the frame when the image fails. No `dark:` class.
- [X] T009 Create `frontend/scripts/capture-landing.ts` (depends on T003, T004, T005, T006): clears stored theme and forces light scheme, signs in as the fixture owner, and takes `locator.screenshot()` of each `data-capture` element; emits 1x and 2x WebP via `sharp` at the target widths in `contracts/image-assets.md` (po-detail 720px eager; dashboard-balance, dispatch-history, party-open-orders 640px; three how-it-works crops at 320px); writes `frontend/src/assets/landing/manifest.json` with `capturedAt`, `appCommit`, `fixture`, `fixtureOrg`, `viewport`, and a per-asset `route`/`selector`/`files`/`dimensions`/`bytes`; **fails loudly** when a `data-capture` selector is missing, when the PO summary does not read 1,000 / 400 / 600, or when a size budget is exceeded (hero 1x+2x ≤ 200KB, all landing imagery ≤ 600KB)
- [X] T010 Run the capture per `quickstart.md` section A and commit the resulting WebP assets and `manifest.json` under `frontend/src/assets/landing/` (depends on T009)

**Checkpoint**: assets exist and are committed. User story work can begin.

---

## Phase 3: User Story 1 - A stranger sees the real product in the first screen (Priority: P1) — MVP

**Goal**: the hero shows the real purchase-order screen with Ordered / Dispatched / Remaining above
the fold, with one primary action to the trial.

**Independent Test**: load `/` at 1280×800 and 390×844 without scrolling; the product screenshot, the
headline, one primary CTA, and the trial microcopy are all visible, and the CTA lands on `/signup`.

### Tests for User Story 1

> Write these first and confirm they fail before implementing.

- [X] T011 [P] [US1] Create `frontend/tests/unit/landingContent.test.tsx` asserting content invariants 1–7 from `data-model.md`: exactly one `Action` with `emphasis: "primary"` and `to: "/signup"`; no action pointing at a checkout, upgrade, or plan-purchase route; rendered copy matching none of the banned proof patterns (a customer count, "trusted by", "customers", "reviews", "rating", "testimonial"); no banned jargon including "orchestration" and "synergy"; every `ImageAssetRef` carrying non-empty `alt` and both dimensions with exactly one `eager`; `trialMicrocopy(undefined)` containing no digits; footer links including both Privacy and Terms
- [X] T012 [P] [US1] Create `frontend/tests/e2e/landing.spec.ts` asserting at 1280×800 and at 390×844 that the hero image is in the viewport and has loaded (`naturalWidth > 0`) with no prior scroll, that the labels Ordered, Dispatched and Remaining are legible in the asset's alt text contract, and that the primary CTA navigates to `/signup`
- [X] T013 [P] [US1] Extend `frontend/tests/e2e/mobile-viewport.spec.ts` to run its no-horizontal-scroll assertion for `/` at 320, 360, 390, and 430px widths (FR-024, SC-004)

### Implementation for User Story 1

- [X] T014 [P] [US1] Create `frontend/src/components/marketing/SiteHeader.tsx` per its contract: logo link to `/`, Pricing, Log in, and a primary "Start free trial" button; below `sm` either compact links or a disclosure menu with `aria-expanded`/`aria-controls`, `Escape` to close and focus returned to the toggle; trial button visible at every width; light-only (reuse `Button`'s primary variant only — its `secondary` and `ghost` variants carry `dark:` classes per research R1)
- [X] T015 [US1] Create `frontend/src/components/marketing/Hero.tsx` per its contract (depends on T007, T008): eyebrow, `<h1>`, subcopy, primary action, soft secondary action to `#how-it-works`, trial microcopy via `content.trialMicrocopy(trialDays)`, and the po-detail asset rendered `eager` with `fetchpriority="high"`; two columns at `lg` with copy left and image right, single column below with copy above image; primary action full width at 390px
- [X] T016 [US1] Create `frontend/src/content/landing.ts` with the `nav` and `hero` content: headline naming purchase orders and partial dispatch or remaining balance, plain-language subcopy, `primaryAction` to `/signup`, `secondaryAction` to `#how-it-works` with `emphasis: "soft"`, and a `trialMicrocopy` that returns a numberless string when `trialDays` is undefined (depends on T007, T010)
- [X] T017 [US1] Recompose `frontend/src/pages/marketing/Landing.tsx` to render `SiteHeader` and `Hero` from the content module above the page's existing strip, features, steps, CTA band and footer, keeping `usePageMeta(...)` and the `usePublicPlans()` trial value unchanged (depends on T014, T015, T016). The old sections stay until US2 and US3 replace them, so the page is shippable at this checkpoint.
- [X] T018 [US1] Extend `frontend/tests/unit/paidSurfaceGated.test.tsx` to cover the rebuilt homepage, asserting no purchasable paid action is reachable from it (FR-014, Principles IX and XIV)

**Checkpoint**: US1 is independently shippable. Principle XV is satisfied and the page no longer reads
as a text-only template.

---

## Phase 4: User Story 2 - A visitor understands the core loop and believes it is real (Priority: P2)

**Goal**: proof strip, three pain-to-outcome pairs, and three feature blocks each carrying a real
product crop.

**Independent Test**: scroll past the hero; the proof strip, the problem/outcome pairs, and three
feature blocks each render with a product crop, and every claim and label cross-checks against a live
screen.

### Tests for User Story 2

- [X] T019 [P] [US2] Extend `frontend/tests/unit/landingContent.test.tsx` to assert exactly three `PainOutcomePair`s, exactly three `FeatureBlockContent`s each bound to a distinct asset with `loading: "lazy"`, and that `proof.industries` renders from content with no hard-coded fallback list

### Implementation for User Story 2

- [X] T020 [P] [US2] Create `frontend/src/components/marketing/ProofStrip.tsx` per its contract: heading "Built for teams who deliver in parts", industry chips rendered from `content.industries`, wrapping rather than scrolling at narrow widths, optional subline with no customer claim
- [X] T021 [P] [US2] Create `frontend/src/components/marketing/ProblemOutcome.tsx` per its contract: a heading plus exactly three pain-to-outcome pairs, with the pairing carried in the markup rather than by left/right position, and no image
- [X] T022 [P] [US2] Create `frontend/src/components/marketing/FeatureBlock.tsx` per its contract: title, 2–3 lines of copy, optional bullet, and a lazy `ScreenshotFrame`; two columns at `lg` alternating via `content.imageSide`, stacked copy-then-image below regardless of `imageSide` (depends on T008)
- [X] T023 [US2] Add `proof`, `problemOutcome`, and `features` content to `frontend/src/content/landing.ts`: industries Steel, Cement, Hardware, Pipes, Chemicals as one editable list; three pairs whose every outcome names a capability live in the app today; three feature blocks bound to the dashboard-balance, dispatch-history, and party-open-orders assets (depends on T010, T016)
- [X] T024 [US2] Replace the existing industries strip and four-card features grid in `frontend/src/pages/marketing/Landing.tsx` with `ProofStrip`, `ProblemOutcome`, and three `FeatureBlock`s (depends on T020, T021, T022, T023). This removes the last `Card` usage from the hero-to-features range, resolving the dark-card mismatch there (research R1).

**Checkpoint**: US1 and US2 both work. The page now carries three real product crops below the hero.

---

## Phase 5: User Story 3 - A cautious visitor checks how it starts and whether it can be trusted (Priority: P3)

**Goal**: three-step walkthrough with crops, a trust row with reachable legal links, a closing call to
action, a shared footer, and header/footer parity with `/pricing`.

**Independent Test**: scroll to the lower page; three numbered steps with crops, three trust
statements, working Privacy and Terms links, a closing CTA and a footer all render; `/pricing` shows
the same header and footer.

### Tests for User Story 3

- [X] T025 [P] [US3] Extend `frontend/tests/e2e/landing.spec.ts`: the secondary hero action scrolls to `#how-it-works`; Privacy and Terms resolve without error from both the trust row and the footer; and the header and footer render identically on `/` and `/pricing` (FR-012, SC-009)

### Implementation for User Story 3

- [X] T026 [P] [US3] Create `frontend/src/components/marketing/HowItWorks.tsx` per its contract: `id="how-it-works"` (the hero anchor depends on it), three numbered steps each with number, title, text and a small lazy crop, step numbers decorative in the markup with reading order carrying the sequence
- [X] T027 [P] [US3] Create `frontend/src/components/marketing/TrustRow.tsx` per its contract: exactly three statements — the Owner / Manager / Staff / Viewer role model, the audit trail, per-organization data isolation — plus real links to `/privacy` and `/terms`, and no certification, compliance-standard, or encryption claim
- [X] T028 [P] [US3] Create `frontend/src/components/marketing/FinalCta.tsx` per its contract: heading, the shared primary action style, microcopy, no competing action, and text contrast met on its brand-colored surface (this replaces today's `variant="secondary"` button on the purple band, which renders dark slate on purple for dark-preference visitors — `Landing.tsx:182`, research R1)
- [X] T029 [P] [US3] Create `frontend/src/components/marketing/SiteFooter.tsx` per its contract: copyright line plus standard links including Privacy and Terms, as the single component both `/` and `/pricing` use
- [X] T030 [US3] Add `steps`, `trust`, `finalCta`, and `footer` content to `frontend/src/content/landing.ts`, binding each step crop to its 320px asset (depends on T010, T023)
- [X] T031 [US3] Complete `frontend/src/pages/marketing/Landing.tsx` as the nine sections in the FR-001 order, reading only from `frontend/src/content/landing.ts` and adding no route, provider, or global style (depends on T026, T027, T028, T029, T030)
- [X] T032 [US3] Implement the hero's secondary action as a smooth scroll to `#how-it-works` that jumps instead of animating under `prefers-reduced-motion`, in `frontend/src/components/marketing/Hero.tsx` (depends on T026)
- [X] T033 [US3] Swap `frontend/src/pages/marketing/Pricing.tsx` to use `SiteHeader` and `SiteFooter`, changing nothing else about that page (depends on T014, T029)

**Checkpoint**: all three stories are independently functional and the page is structurally complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T034 [P] Create `frontend/public/og-image.png` at 1200×630 composed from the hero asset, point `og:image` at it in `frontend/index.html`, leave `twitter:card` as `summary_large_image`, and delete `frontend/public/og-image.svg` so nothing keeps referencing it (research R6)
- [X] T035 [P] Spacing and type-hierarchy pass across `frontend/src/components/marketing/`: tighten the vertical rhythm so the page reads as dense-but-clean rather than as large empty bands, keep one `<h1>` with sequential `<h2>`/`<h3>` per the shared section rules, and keep at least 16px horizontal padding at every viewport
- [X] T036 [P] Verify the image budgets from the capture size report: hero 1x+2x at or under 200KB, all landing imagery at or under 600KB; re-encode at lower quality and re-run `npm run capture:landing` if either is exceeded
- [X] T037 [P] Accessibility pass on `/`: every action reachable by keyboard in reading order with a visible focus indicator, text contrast at or above the accepted minimum, decorative chrome `aria-hidden`, and every product image carrying meaningful alt text (FR-025, FR-026, SC-008)
- [X] T038 Set the OS to dark mode, reload `/` and `/pricing`, and confirm both render identically to light mode — no dark card, panel, or button may appear (research R1)
- [X] T039 Run the full automated suite from `quickstart.md` section C in `frontend/`: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` — all four must pass, with `npm run build` proving every asset import resolves
- [X] T040 Record the Landing review gate for this change per the constitution's Launch Gates: hero shows a real product screen, one primary CTA, every proof claim real, CTA reachable at 390px without horizontal scroll, and every screenshot matching the deployed UI with `manifest.json`'s `appCommit` cited as evidence
- [X] T041 Run the Principle XIII smoke test (signup → party → PO → dispatch → dashboard remaining balance through the UI) and confirm it passes before any production announcement (depends on T039)
- [ ] T042 Deploy to production (depends on T040, T041)
- [ ] T043 Measure largest contentful paint on the deployed preview or production from a mid-range phone or an equivalent throttled profile — not the dev server — and confirm it is under 2.5 seconds with no visible layout shift (SC-003)
- [ ] T044 Run the ten-second first-impression test with three people outside the team: show `/` for ten seconds, then ask what the product does. At least two of three should mention tracking orders and what is left to deliver (SC-002)

---

## Dependencies

**Phase order**: Setup (T001–T004) → Foundational (T005–T010) → US1 (T011–T018) → US2 (T019–T024) →
US3 (T025–T033) → Polish (T034–T044).

**Story independence**: US1 ships alone. US2 assumes US1's header and content module exist but adds
only new sections. US3 assumes both, and its `#how-it-works` anchor is what makes the hero's secondary
action functional — until T026 lands, that action is inert, which is why T032 depends on it.

**Critical path**: T003 → T005 → T009 → T010 → T015/T016 → T017. Everything visual waits on the
capture run, so T005–T010 is the work to start first and the work most worth unblocking.

**Key specific dependencies**:

- T009 (capture script) needs T003 (selectors), T004 (capture config), T005 and T006 (fixture)
- T010 (assets committed) needs T009
- T015, T016, T023, T030 all need T010 — a component cannot import an asset that does not exist
- T024 needs T020, T021, T022, T023
- T031 needs T026–T030
- T032 needs T026 (the anchor target)
- T033 needs T014 and T029
- T042 needs T040 and T041 — the constitution gates the deploy, not the other way round

## Parallel Execution Examples

**Setup**: T002, T003, T004 together (different files).

**Foundational**: T006, T007, T008 together once T005 exists (fixture extension, types, frame
component — no shared files).

**US1 tests**: T011, T012, T013 together (three separate test files).

**US2 components**: T020, T021, T022 together, then T023 and T024 in sequence.

**US3 components**: T026, T027, T028, T029 together, then T030 → T031 → T032/T033.

**Polish**: T034, T035, T036, T037 together.

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + US1 (T001–T018).** That is 18 tasks and it closes the gap this feature
exists for: the homepage stops being a text-only template and shows the real product above the fold.
Shipping there is a legitimate stopping point — the page keeps its current lower sections, which are
honest if plain.

**Then US2** for belief, **then US3** for the cautious visitor. Each is a separate deployable
increment, and each ends with the page in a consistent state rather than half-rebuilt.

## Mapping from the supplied board

Every item from the Landing Upgrade Board is carried below. Three were split because one line hid two
pieces of work, and one is deferred with a reason.

| Board item | Tasks |
|------------|-------|
| T1.1 Sample demo data | T005, T006 |
| T1.2 Screenshot PO detail | T003, T009, T010 |
| T1.3 Screenshot dashboard KPIs + party remaining | T003, T006, T009, T010 |
| T1.4 Screenshot dispatch history | T003, T009, T010 |
| T1.5 Crop + compress WebP/PNG | T009 (crop is element-scoped capture, so it is not a separate step), T036 |
| T2.1 Nav with trial CTA | T014 |
| T2.2 Hero copy + screenshot | T015, T016 |
| T2.3 Proof strip | T020, T023 |
| T2.4 Problem / outcome | T021, T023 |
| T2.5 Three feature blocks | T022, T023, T024 |
| T2.6 How it works | T026, T030 |
| T2.7 Trust row + legal links | T027 |
| T2.8 Final CTA band | T028 |
| T2.9 Footer | T029, T033 |
| T3.1 Mobile layout pass | T013, T037 (plus the stacking rules inside T015, T022) |
| T3.2 Spacing / type hierarchy | T035 |
| T3.3 Lazy-load below-fold images | T008, T022, T026 (the `loading` flag is part of each asset binding, enforced by T019) |
| T3.4 CTA tracking | **Deferred — not tasked.** See below. |
| T3.5 OG image | T034 |
| T4.1 Desktop + mobile visual QA | T038, T039 |
| T4.2 All links work | T012, T025 |
| T4.3 Compare against wireframe checklist | T040 — there is no wireframe artifact in the repo, so the comparison target is the constitution's Landing review gate plus `checklists/requirements.md`. Run `/speckit-checklist` if you want a standalone per-release landing checklist. |
| T4.4 Deploy production | T042, gated by T040 and T041 |
| T4.5 Ten-second first-impression test | T044 |

**Deferred: T3.4 CTA tracking.** The repository has no analytics provider, and the spec places
tracking out of scope. Adding one would mean choosing a vendor, deciding what is collected about
visitors, and updating the privacy policy — a decision with privacy consequences, not a polish item.
It is left out deliberately rather than stubbed.

**On the board's acceptance feelings.** "I understand what this does" is measured by T044; "I can see
the product" by T012; "I can try it free" by T011's one-primary-action assertion plus T012's
CTA-to-signup check; and "not just a marketing placeholder" is the sum of all three plus T035's
density pass. The spec records these as SC-001, SC-002, and SC-005.

---

## Landing review record (T040)

Recorded 2026-10-08 against the constitution's Launch Gates. Evidence is the test that enforces each
answer, not a reading of the page.

| Gate question | Answer | Evidence |
|---------------|--------|----------|
| Hero shows a real product screen | Yes — `PO-2001`, Ordered 1,000 / Dispatched 400 / Remaining 600, captured from the running app | `tests/e2e/landing.spec.ts` "hero shows a loaded product screenshot above the fold" at 1280×800 and 390×844 |
| Exactly one primary call to action | Yes — every primary action resolves to `/signup`; the only other hero action is an in-page anchor | `tests/unit/landingContent.test.tsx` invariant 1; `tests/unit/paidSurfaceGated.test.tsx` "landing page while paid plans are gated" |
| Every proof claim is real | Yes — industry chips only; no count, logo, testimonial or rating | `landingContent.test.tsx` invariant 3 (seven banned patterns) |
| CTA reachable at 390px without horizontal scroll | Yes, and at 320/360/430 too | `tests/e2e/mobile-viewport.spec.ts` "the landing page fits every common phone width, CTA included" |
| Screenshots match the deployed UI | Yes at capture time | `src/assets/landing/manifest.json` records `appCommit`, the fixture, and each asset's selector and size |

Additional checks run for this change:

- **Dark-mode leak**: `landing.spec.ts` "the landing page stays light for a dark-preference visitor"
  now fails CI if any header, footer or section renders a dark surface. This also fixed a live
  defect: the closing CTA button was dark slate on brand purple for dark-preference visitors.
- **Accessibility**: one `<h1>`, meaningful `alt` on all eight product images, decorative window
  chrome `aria-hidden`, visible focus rings, and the primary CTA focusable by keyboard — all asserted
  in `landing.spec.ts`. **Colour contrast was reviewed by eye, not measured with a tool**; an
  instrumented audit is still worth running before launch.
- **Budgets**: hero 33.4KB of 200KB, all landing imagery 101.3KB of 600KB, reported by the capture
  script on every run.

## Performance measurement (T043)

Measured 2026-10-09 against the **production build served locally** (`vite preview`), not a deployed
preview, with Chrome DevTools throttling: 9 Mbps / 150 ms RTT and a 4× CPU slowdown, at 390×844.

| Run | LCP | CLS |
|-----|-----|-----|
| 1 (cold server, first request) | over 2,500 ms — failed the budget | 0.0017 |
| 2 | 1,940 ms | 0.0017 |
| 3 | 1,084 ms | 0.0017 |
| 4 | 1,032 ms | 0.0017 |
| 5 | 920 ms | 0.0017 |

Warm LCP sits near 1 second, comfortably inside SC-003's 2.5 s, and cumulative layout shift is
effectively nil — the explicit image dimensions are doing their job (FR-023). The LCP element is the
hero subcopy paragraph, not an image, because at phone width the copy sits above the screenshot.

Two honest caveats:

- **The first cold request exceeded the budget.** On a CDN-served deployment that first-byte cost is
  a different shape, which is exactly why SC-003 asks for a deployed measurement.
- **This is a local stand-in.** SC-003 is not formally satisfied until the same measurement runs
  against the deployed site, which is why T043 stays unchecked in the task list above.

## Open items

- **T042 Deploy to production** — not performed as a deliberate step. If this repository's Vercel
  project deploys `main` automatically, merging this work to `main` is what triggers it; the
  Principle XIII smoke test passed beforehand (`core-workflow.spec.ts`, full suite green at
  `--workers=2`), so the gate is satisfied either way.
- **T043 LCP measurement** — measured locally (above); the deployed-preview measurement SC-003 asks
  for still needs running once the site is live.
- **T044 Ten-second first-impression test** — not done, and not something I can do. It needs three
  people outside the team looking at the page for ten seconds and saying what they think it does.

## Known flake observed during T039

`tests/e2e/core-workflow.spec.ts:95` ("over-dispatch is warned about and requires explicit
confirmation") fails intermittently when the full suite runs at default parallelism, and passes at
`--workers=1` and `--workers=2`. It is a pre-existing test that touches none of this feature's files;
its sibling failure in the same run asserted on the loose text `70`, which matched a generated signup
email. Worth fixing, but it belongs to the core-loop suite, not to this feature.
