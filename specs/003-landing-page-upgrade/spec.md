# Feature Specification: Landing Page Upgrade

**Feature Branch**: `003-landing-page-upgrade`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Landing Page Upgrade — rebuild the public homepage (`/`) into a
competitor-style landing that sells the core loop: Party → PO → Partial dispatch → Remaining
balance." Section-by-section brief supplied (S0 Nav through S8 Footer), with content tone, required
screenshot assets, and out-of-scope list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A stranger sees the real product in the first screen (Priority: P1)

A trader who has never heard of OrderFlow arrives at `/` from a search result or a forwarded link.
Before scrolling, they see what the product looks like: a purchase-order screen showing Ordered,
Dispatched, and Remaining. The headline tells them it tracks purchase orders and partial dispatches.
There is one obvious button — start the free trial — and one line telling them what the trial costs
them (nothing, no card). They can decide to try it without reading further.

**Why this priority**: this is the entire first impression and the only part of the page that every
visitor sees. Today's page is text-only above the fold, which violates Principle XV of the
constitution and is the specific gap this feature exists to close. Shipping only this story already
replaces a template-looking page with one that shows real software.

**Independent Test**: load `/` at 1280×800 and at 390×844 with no scrolling and confirm a product
screenshot, a headline naming purchase orders and partial dispatches, exactly one primary call to
action, and trial microcopy are all visible; follow the call to action and land on signup.

**Acceptance Scenarios**:

1. **Given** a visitor on a 1280×800 desktop viewport, **When** `/` finishes loading, **Then** a
   framed screenshot of the purchase-order detail screen showing the labels Ordered, Dispatched, and
   Remaining is visible without scrolling, alongside the eyebrow, headline, subcopy, primary call to
   action, and trial microcopy.
2. **Given** a visitor on a 390px-wide phone viewport, **When** `/` finishes loading, **Then** the
   layout is a single stacked column with the copy above the image, the primary call to action is
   reachable without horizontal scrolling, and no element overflows the viewport width.
3. **Given** a visitor anywhere on the page, **When** they look for how to begin, **Then** exactly
   one primary call to action style is present — "Start free trial" — and any other link (Pricing,
   Log in, "See how it works") is visually subordinate.
4. **Given** a visitor clicks the primary call to action, **When** the navigation completes,
   **Then** they are on the signup page.
5. **Given** the hero screenshot asset fails to load, **When** the page renders, **Then** a
   descriptive text alternative occupies its place and the headline, call to action, and microcopy
   remain fully usable.

---

### User Story 2 - A visitor understands the core loop and believes it is real (Priority: P2)

The visitor scrolls. They learn, in plain trading language, what goes wrong today (a balance nobody
agrees on, dispatches tracked in WhatsApp, a spreadsheet reconciled at month-end) and what OrderFlow
does instead. Three feature blocks each pair a short claim with a crop of the actual screen that
delivers it: the live remaining balance on the dashboard, a partial dispatch with its history on the
purchase-order screen, and a party's open orders. A proof strip tells them the kinds of businesses
this is built for. Nothing on the page claims a customer, a review, or a feature that does not exist.

**Why this priority**: the hero earns attention; this section converts it into belief. It is
independently shippable because the hero already carries the complete decision path on its own.

**Independent Test**: scroll `/` past the hero and confirm the proof strip, the problem/outcome
section, and three feature blocks each render with a product crop; cross-check every claim against a
live screen in the application and every screenshot label against the shipped UI.

**Acceptance Scenarios**:

1. **Given** a visitor scrolls past the hero, **When** the proof strip renders, **Then** it shows
   the line "Built for teams who deliver in parts" and the industry chips Steel, Cement, Hardware,
   Pipes, and Chemicals.
2. **Given** the proof strip, **When** a reader looks for social proof, **Then** no customer count,
   company logo, testimonial, rating, or review appears anywhere on the page.
3. **Given** the problem/outcome section, **When** it renders, **Then** it shows a short headline and
   three pain-to-outcome pairs, and every stated outcome corresponds to a capability that is live in
   the application today.
4. **Given** the three feature blocks, **When** each renders, **Then** it has a title, two to three
   lines of copy, and a screenshot crop taken from the live product — live remaining balance from the
   dashboard, partial dispatch plus Dispatch History from the purchase-order detail, and party-wise
   open orders from the party screen.
5. **Given** any screenshot on the page, **When** it is compared with the deployed application,
   **Then** its colors, layout, and labels match, including Ordered / Dispatched / Remaining, Dispatch
   History, and Due.
6. **Given** any data visible inside a screenshot, **When** it is reviewed, **Then** it contains only
   clearly fictional demonstration parties, materials, and quantities — never a real customer's data.

---

### User Story 3 - A cautious visitor checks how it starts and whether it can be trusted (Priority: P3)

A visitor who is interested but careful wants two more things: a sense of how much work starting is,
and some reason to trust the product with their order book. They find a three-step "how it works"
walkthrough, each step with a small crop of the screen they would be on, and a trust row that states
plainly what protects their data — team roles, an audit trail of every change, and the fact that each
organization's data is isolated — with reachable Privacy and Terms links. A closing call to action
repeats the single next step. The navigation and footer look the same here as on the pricing page.

**Why this priority**: it recovers the visitor who is not ready to click on the hero alone, and it
carries the constitution's required legal links. It is last because the page already converts and
already satisfies the first-impression principle without it.

**Independent Test**: scroll to the lower page and confirm three numbered steps with crops, three
trust statements, working Privacy and Terms links, a closing call to action, and a footer; then load
`/pricing` and confirm the navigation and footer match `/`.

**Acceptance Scenarios**:

1. **Given** the "how it works" section, **When** it renders, **Then** it shows three numbered steps
   — add your parties, create a purchase order, log dispatches as they happen — each with a title,
   explanatory text, and a small crop of the matching screen.
2. **Given** the trust row, **When** it renders, **Then** it states the role model, the audit trail,
   and per-organization data isolation, and each statement is true of the shipped application.
3. **Given** the trust row and the footer, **When** a visitor follows the Privacy and Terms links,
   **Then** each resolves to its page without error.
4. **Given** the closing section, **When** it renders, **Then** it shows a headline, a "Start free
   trial" action, and supporting microcopy, and introduces no competing primary action.
5. **Given** a visitor moves between `/` and `/pricing`, **When** both pages render, **Then** the
   navigation and footer present the same links, order, and styling.

---

### Edge Cases

- **Trial length not yet known.** The trial length shown in microcopy is published by the server. If
  it has not resolved or fails to load, the microcopy must fall back to naming a free trial without
  stating a number of days, never to a hard-coded length.
- **Image assets unavailable or slow.** Every screenshot must have a meaningful text alternative, and
  the page must remain readable and clickable while images are still arriving.
- **Very narrow and very wide viewports.** 320px through 430px must not produce horizontal scrolling;
  above roughly 1440px the content must stay within a readable measure rather than stretching.
- **Screenshot drift.** When an in-app screen changes, the landing screenshots become wrong. The
  feature must leave behind a repeatable way to re-capture them, so correcting drift is routine rather
  than archaeology.
- **Dark-mode preference.** The application supports a dark theme; the landing page presents one
  consistent treatment, and screenshots must not mix light and dark crops on the same page.
- **Keyboard and screen-reader visitors.** Every action must be reachable by keyboard in a sensible
  order, decorative framing must not be announced, and each product screenshot must be described.
- **Reduced-motion preference.** Any entrance or hover motion must be suppressed when the visitor
  asks for reduced motion.
- **Pricing curiosity mid-page.** Pricing stays linked and reachable, but no paid plan may be
  presented as purchasable while the trial-first phase is in force.

## Requirements *(mandatory)*

### Functional Requirements

**Page structure**

- **FR-001**: The public homepage `/` MUST present nine sections in order: navigation, hero, proof
  strip, problem/outcome, three feature blocks, how it works, trust row, closing call to action, and
  footer.
- **FR-002**: Navigation MUST contain the OrderFlow logo, a Pricing link, a Log in link, and a
  "Start free trial" button, and on narrow viewports MUST remain usable either as compact links or a
  disclosure menu while keeping the trial button visible.
- **FR-003**: The hero MUST contain an eyebrow line, a headline, subcopy, one primary call to action,
  trial microcopy, and a framed screenshot of the purchase-order detail screen showing Ordered,
  Dispatched, and Remaining.
- **FR-004**: On viewports narrower than the desktop breakpoint the hero MUST stack with copy above
  the screenshot; at desktop width the screenshot MUST sit beside the copy.
- **FR-005**: The proof strip MUST show the line "Built for teams who deliver in parts" and industry
  chips for Steel, Cement, Hardware, Pipes, and Chemicals, maintained as a single editable list so
  the set can change without reworking the section.
- **FR-006**: The problem/outcome section MUST show a short headline and three pain-to-outcome pairs,
  each outcome naming only a capability live in the application.
- **FR-007**: Each of the three feature blocks MUST show a title, two to three lines of copy, an
  optional supporting bullet, and a product screenshot crop; the three subjects MUST be the live
  remaining balance on the dashboard, partial dispatch with Dispatch History on the purchase-order
  detail, and party-wise open orders.
- **FR-008**: The how-it-works section MUST show three numbered steps, each with a title, text, and a
  small crop of the screen that step happens on.
- **FR-009**: The trust row MUST state the Owner / Manager / Staff / Viewer role model, the audit
  trail, and per-organization data isolation, and MUST link to Privacy and Terms.
- **FR-010**: The closing section MUST show a headline, a "Start free trial" action, and supporting
  microcopy.
- **FR-011**: The footer MUST include Privacy and Terms alongside the standard links, and MUST be
  identical on `/` and `/pricing`, maintained as one shared definition so the two cannot drift apart.
- **FR-012**: The navigation MUST be consistent between `/` and `/pricing`.

**Calls to action and truthfulness**

- **FR-013**: The page MUST present exactly one primary call to action — start the free trial — and
  every other link MUST be visually subordinate.
- **FR-014**: The page MUST NOT present any paid plan, upgrade, or checkout action as available;
  pricing MAY be linked only as an informational destination.
- **FR-015**: The page MUST NOT display customer counts, company logos, testimonials, ratings, or
  reviews.
- **FR-016**: Trial microcopy MUST derive the trial length from the server-published value and MUST
  fall back to naming a free trial without a number when that value is unavailable.
- **FR-017**: Every screenshot and crop on the page MUST match the deployed application in colors,
  layout, and labels, using the shipped wording Ordered / Dispatched / Remaining, Dispatch History,
  and Due.
- **FR-018**: Screenshots MUST show only fictional demonstration data and MUST NOT show any real
  customer, party, or order information.
- **FR-019**: Copy MUST use plain trading language, MUST emphasize remaining balance, partial
  dispatch, party, and due date, and MUST avoid enterprise jargon such as "orchestration" or
  "synergy".
- **FR-020**: The page MUST NOT depict any feature that is not live in the application.

**Assets, performance, and accessibility**

- **FR-021**: The feature MUST produce four product image assets: a hero purchase-order detail
  screenshot, a dashboard crop, a dispatch-history crop, and a party open-orders crop.
- **FR-022**: Image assets MUST be static images; video MUST NOT be used.
- **FR-023**: Images MUST be served at dimensions and compression appropriate to the requesting
  viewport, and MUST reserve their space before loading so the page does not shift as they arrive.
- **FR-024**: The page MUST NOT scroll horizontally at any width from 320px to 430px.
- **FR-025**: Every product image MUST carry a text alternative describing what the screen shows;
  purely decorative framing MUST NOT be announced to assistive technology.
- **FR-026**: All navigation and calls to action MUST be operable by keyboard with a visible focus
  indicator, and text MUST meet accepted contrast minimums against its background.
- **FR-027**: Any motion MUST be suppressed for visitors who have requested reduced motion.
- **FR-028**: The feature MUST leave a documented, repeatable procedure for re-capturing the four
  assets, so that a future in-app UI change can refresh them without redesigning the page.

### Key Entities

- **Landing section**: one of the nine ordered bands of the page; carries its own copy and, for most,
  one product image.
- **Industry chip list**: the editable set of industries named in the proof strip; content only, with
  no claim about customers.
- **Product image asset**: a static screenshot or crop of a real application screen, paired with a
  text alternative and a record of which screen and which demo data produced it.
- **Trial microcopy**: the short line stating the trial terms; its length value is owned by the
  server, not the page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1280×800 and at 390×844, a product screenshot showing Ordered, Dispatched, and
  Remaining is visible with zero scrolling, verified on every release of the page.
- **SC-002**: A first-time viewer shown the page for ten seconds can state, unprompted, that it
  tracks purchase orders and part-deliveries and what is left to deliver — 4 out of 5 viewers in an
  informal check.
- **SC-003**: The page's main content appears within 2.5 seconds on a mid-range phone over a typical
  mobile connection, and the layout does not visibly shift once images arrive.
- **SC-004**: At every width from 320px to 430px there is no horizontal scrolling and the primary
  call to action is reachable by vertical scrolling alone — 100% of tested widths.
- **SC-005**: The page presents exactly one primary call to action and zero purchasable paid actions,
  verified by inspection on each release.
- **SC-006**: Every label in every screenshot matches the deployed application word for word — 4 of 4
  assets, re-verified whenever an in-app screen in scope changes.
- **SC-007**: Zero unverifiable proof claims appear on the page: no customer count, logo,
  testimonial, rating, or review.
- **SC-008**: Every action on the page is reachable and operable by keyboard alone, and every product
  image has a meaningful text alternative — 100% of actions and images.
- **SC-009**: Privacy and Terms are reachable from the page and resolve without error — 2 of 2 links,
  on both `/` and `/pricing`.
- **SC-010**: Re-capturing all four image assets after an in-app UI change takes under 30 minutes by
  following the documented procedure.

## Assumptions

- **Screenshot sourcing.** Assets will be captured from the running application signed in to a seeded
  demonstration organization, rather than drawn or mocked. This is the highest-fidelity route to
  Principle XIX, the repository already has a seed script and browser-automation harness, and it makes
  the re-capture procedure of FR-028 mechanical. A faithful hand-built reproduction remains permitted
  by the constitution if capture proves impractical; choosing between them is a planning decision.
- **Demonstration data.** The seeded organization will use obviously fictional party and material
  names and plausible trading quantities. No real customer data will appear in any asset.
- **Problem/outcome shape.** The brief allowed either three pain-versus-outcome pairs or three outcome
  cards; this spec takes pairs, because naming the pain in the trader's own words is what makes the
  outcome legible. Switching to cards later would not change any other requirement.
- **Industry list.** The brief's list — Steel, Cement, Hardware, Pipes, Chemicals — replaces the list
  currently on the page (which reads Steel & Metals, Cement & Building Materials, Chemicals, Textiles,
  Agri Commodities). The brief is treated as the newer intent.
- **Theme.** Assets will be captured in the application's light theme, matching the landing page's
  existing light presentation, and the landing page will not offer a dark variant in this feature.
- **Trial length source.** The existing server-published plan information already feeds the current
  page's trial microcopy and will continue to; this feature does not change how trial length is
  determined or enforced.
- **Authentication and signup are unchanged.** The primary call to action points at the existing
  signup flow; nothing about signup, onboarding, or trial provisioning is in scope.
- **Legal pages exist.** Privacy and Terms are already live at their routes and are linked, not
  rewritten.
- **Copy authority.** Headline, eyebrow, and section copy will be drafted as part of this feature and
  are expected to be reviewed by the product owner before release; wording may change without
  changing any requirement here.

## Out of Scope

- Redesigning the signed-in application shell (handled by a separate UI kit effort).
- Video production of any kind; static images only for this version.
- Collecting real customer logos, testimonials, or counts — a process that runs on its own clock and
  does not block this feature, since industry chips carry the proof role meanwhile.
- Any Stripe, checkout, upgrade, or paid-plan push on the landing page, which remains gated by
  Principles IX and XIV of the constitution.
- Changes to the pricing page beyond navigation and footer consistency.
- Search-engine and social-preview optimization beyond the page metadata that already exists.

## Constitution Alignment

This feature is the implementation of Principles XV through XIX, added in constitution v1.2.0, and
must also satisfy the pre-existing principles those build on:

| Principle | How this spec honors it |
|-----------|-------------------------|
| VIII. Mobile + Desktop Equality | FR-004, FR-024, SC-004 |
| IX. Trial-First Positioning | FR-013, FR-014, FR-016 |
| XI. Truth Over Marketing | FR-015, FR-018, FR-020, SC-007 |
| XIV. Paid Work Is Gated | FR-014 and the Out of Scope entry on paid pushes |
| XV. The Landing Page Shows the Product | FR-003, SC-001 |
| XVI. One Primary Action | FR-013, SC-005 |
| XVII. Landing Proof Must Be Real | FR-005, FR-015, SC-007 |
| XVIII. Fast and Reachable on a Phone | FR-022, FR-023, FR-024, SC-003, SC-004 |
| XIX. Screenshots Match the Shipped UI | FR-017, FR-021, FR-028, SC-006, SC-010 |

No deviation from any principle is requested.
