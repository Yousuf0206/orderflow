# Feature Specification: Native iOS and Android Apps

**Feature Branch**: `007-native-mobile-apps`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Native iOS + Android apps (007)": a store-installed shell around the
existing product with auth, core flows, app chrome, and distribution (FR-N1–FR-N6), excluding push
notifications, offline queue, Mac App Store, and platform-only features.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a truck from an installed app (Priority: P1)

A yard clerk installs OrderFlow from the Play Store or App Store (or a testing track), signs in once,
opens a purchase order, enters quantities for the items on the truck, and saves. Each item's
remaining updates on screen. They never type a web address.

**Why this priority**: recording a partial dispatch on a phone is the reason to have an app at all.

**Independent Test**: on a physical Android phone and a physical iPhone, install the build, sign in,
record a two-item dispatch on a three-item PO, and see each item's remaining change.

**Acceptance Scenarios**:

1. **Given** the app is installed and the user signs in, **When** they open a PO with three items
   and enter quantities for two, **Then** saving records one dispatch and the two items' remaining
   drop while the third is unchanged.
2. **Given** a quantity above an item's remaining, **When** the user saves, **Then** the app shows
   the same warning and confirm step as the web, naming that item.
3. **Given** the on-screen keyboard is open over a quantity field, **When** the user finishes
   typing, **Then** the save button is reachable without closing the app or zooming.
4. **Given** a user with a role that cannot record dispatches, **When** they open a PO, **Then**
   they see remaining per item and no dispatch form, as on the web.

---

### User Story 2 - Stay signed in, safely (Priority: P1)

The user signs in once and stays signed in across app restarts and phone reboots. Signing out
removes the session from the phone completely.

**Why this priority**: re-entering a password at a loading gate defeats the app; a session left
readable on a lost phone exposes the organization's data (constitution XXXVI).

**Independent Test**: sign in, force-quit, reopen (still signed in); sign out, reopen (signed out,
no stored session readable outside the platform's secure store).

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the app is closed and reopened, or the phone restarted,
   **Then** they land in the app signed in.
2. **Given** a signed-in user, **When** they sign out, **Then** reopening the app shows sign-in and
   no session material remains on the device.
3. **Given** a new user, **When** they sign up in the app, **Then** they reach onboarding exactly as
   on the web, on the free trial.
4. **Given** an expired session, **When** the user opens the app, **Then** they are asked to sign
   in again with a plain message, not a blank screen or error code.

---

### User Story 3 - Find what is still owed (Priority: P2)

The user checks the dashboard, a party's open orders, and the PO list with its filters, all inside
the app, and every figure matches the web.

**Why this priority**: reading remaining is the second most frequent job, and it must agree with
the web to be trusted (constitution XXXIII).

**Independent Test**: for one organization, compare dashboard counts, a party's per-unit remaining,
and a filtered PO list between the app and the web; they are identical.

**Acceptance Scenarios**:

1. **Given** open orders exist, **When** the user opens the dashboard in the app, **Then** counts
   and per-unit remaining match the web for the same moment.
2. **Given** the PO list, **When** the user filters by status, party, or PO number, **Then** the
   results match the same filter on the web.
3. **Given** a party, **When** the user opens it, **Then** its open orders and per-unit remaining
   match the web.

---

### User Story 4 - An app that looks and behaves like one (Priority: P2)

The app opens to a branded splash, has proper icons on both platforms, and content never sits under
the notch, camera cut-out, status bar, or home indicator.

**Why this priority**: required for store acceptance and for the app to read as real software
rather than a website in a frame.

**Independent Test**: on a notched iPhone and an Android phone with gesture navigation, open every
core screen in portrait; nothing is clipped or hidden; the icon and splash display correctly.

**Acceptance Scenarios**:

1. **Given** a phone with a notch or cut-out, **When** any core screen is shown, **Then** no
   control or figure is hidden behind it or behind the home indicator.
2. **Given** the home screen, **Then** the app icon displays correctly, including Android's adaptive
   icon shapes.
3. **Given** an iPad, **When** the same iOS build runs, **Then** every core flow works and nothing is
   clipped, in portrait and landscape.

---

### User Story 6 - Delete my account from the app (Priority: P2)

A user who no longer wants OrderFlow deletes their account from Settings. A staff member's
departure leaves the organization's records intact; an owner closing the business removes the
whole organization after an explicit confirmation.

**Why this priority**: the App Store rejects apps that allow sign-up without in-app account
deletion, so this blocks iOS release.

**Independent Test**: delete a staff account and confirm the organization still works for others;
delete an owner account and confirm every member is locked out and the data is gone after the purge
window.

**Acceptance Scenarios**:

1. **Given** a non-owner, **When** they delete their account and confirm, **Then** they are signed
   out, cannot sign in again, and the organization's parties, orders, and dispatches are unchanged
   for everyone else.
2. **Given** an owner, **When** they choose delete, **Then** a confirmation names the organization,
   says every member will lose access, and states the 30-day purge window; nothing happens until
   they confirm.
3. **Given** an owner who confirmed, **Then** every member's session stops working at once and no
   member can sign in to that organization.
4. **Given** a deleted account, **When** fewer than 30 days have passed, **Then** its data still
   exists (soft-deleted) and is not visible to anyone in the product; **When** 30 days have passed,
   **Then** the purge job removes it.

---

### User Story 5 - Ship through the stores (Priority: P3)

The owner distributes builds to testers on Play internal testing and TestFlight, then publishes to
both stores once real-device QA passes on both platforms.

**Why this priority**: required to deliver the app, but follows a working build.

**Independent Test**: a tester outside the team installs from each testing track; the store
listings link a working privacy policy; both builds carry the same features.

**Acceptance Scenarios**:

1. **Given** a build passed real-device QA on one iPhone and one Android phone, **When** it is
   submitted, **Then** both platforms receive the same build of the product.
2. **Given** a store listing, **Then** it links the live privacy policy and makes no claim of
   offline use, push notifications, or features the app lacks.

### Edge Cases

- No connection when opening or saving: the app says it cannot reach OrderFlow and does not show a
  dispatch as saved (constitution XXXVII). Nothing is queued.
- Connection drops mid-save: the user is told the outcome is unknown and is shown the PO's current
  state on reconnect, so a dispatch is never recorded twice by blind retry.
- The phone's text size is set very large: forms still fit and remain usable.
- The server is updated while an old app version is installed: the app keeps working, because all
  business rules live on the server (constitution XXXIII).
- A link in the app to Privacy or Terms opens in a way that lets the user return to the app.
- Billing: no upgrade, price, or purchase control appears in the app (constitution IX, and store
  payment rules).
- An owner of an organization that has another owner deletes their account: only their own
  membership and login are removed; the organization stays with the remaining owner.
- A user who belongs to several organizations deletes their account: their login and every
  membership go; each organization they solely own is soft-deleted, after the confirmation lists
  them all.
- A deleted user's email signs up again within the 30 days: it starts a new account; nothing from
  the deleted one is restored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: OrderFlow MUST be installable on Android 8.0+ phones from Google Play (internal
  testing, then production) and on iOS 15+ iPhones from TestFlight, then the App Store; the same iOS
  build MUST run on iPad.
- **FR-002**: The app MUST present the existing product — same screens, same rules — and MUST obtain
  every figure, status, and permission decision from the existing service; it MUST NOT compute
  business figures itself (constitution XXXIII).
- **FR-003**: The app identifier MUST be stable across releases on both stores (proposed
  `app.orderflow.mobile`) so updates install over the previous version.
- **FR-004**: The service address the app talks to MUST be set per build (production for store
  builds), not typed by users.
- **FR-005**: Sign-up, sign-in, and sign-out MUST work in the app. The session MUST survive app
  restarts and phone reboots, MUST be stored in the platform's secure storage, and sign-out MUST
  remove it from the device (constitution XXXVI).
- **FR-006**: In the app, users MUST be able to use: dashboard; parties list and party detail; PO
  list with status, party, and PO-number filters; PO detail with items and per-item remaining;
  multi-item partial dispatch with the over-dispatch warning and confirm; and see remaining update
  after saving without restarting the app.
- **FR-007**: Every core screen MUST respect the safe areas (notch, cut-out, status bar, home
  indicator) and be usable one-handed in portrait at phone sizes down to 320 px wide; portrait is
  the primary orientation on phones.
- **FR-008**: The app MUST have a splash screen, iOS icons, and Android adaptive icons, and a status
  bar styled to match the app.
- **FR-009**: When the service cannot be reached, the app MUST say so plainly and MUST NOT show
  unsent work as saved; no offline queue exists in v1 (constitution XXXVII).
- **FR-010**: The app MUST NOT show any paid-plan, upgrade, or purchase control (constitution IX).
- **FR-011**: Store listings MUST link the live privacy policy, and MUST NOT describe offline use,
  push notifications, or any feature not in the build.
- **FR-012**: Any signed-in user MUST be able to delete their account from Settings in the app
  (and on the web, so the two stay at parity):
  - **Non-owner**: their membership and login are removed; the organization and its records stay.
  - **Owner**: the organization is soft-deleted and every member loses access. This MUST require an
    explicit confirmation step that names the organization and states that all members lose access.
  - Access MUST be revoked immediately: existing sessions stop working and the login cannot sign in.
  - Nothing is hard-deleted on the click (constitution VII). Removed data MUST be purged by a
    scheduled job 30 days after deletion, and not before.
  - The in-app confirmation copy and the privacy policy MUST both state the 30-day purge window.
- **FR-013**: Both platforms MUST ship together with the same features, and no store submission may
  happen without a recorded pass on one physical iPhone and one physical Android phone for that
  build (constitution XXXIV, XXVI).

### Key Entities

- **App build**: a versioned release for one platform, tied to one version of the web product and
  one service address; iOS and Android builds of a release carry the same features.
- **Device session**: a signed-in user's session held in a phone's secure storage, removed on
  sign-out.
- **Account deletion**: who deleted, when, which login and memberships were removed, which
  organization (if any) was soft-deleted, and the date the purge becomes due.
- **Real-device QA record**: device, OS version, build, tester, date, and whether a multi-item
  partial dispatch completed without zooming or panning.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a physical phone, a signed-in user can record a two-item partial dispatch in under
  60 seconds from opening the app.
- **SC-002**: After closing and reopening the app, 100% of sessions are still signed in until
  sign-out or expiry; after sign-out, 0 sessions are recoverable on the device.
- **SC-003**: For the same organization and moment, every dashboard count and remaining figure in
  the app equals the web.
- **SC-004**: Builds are accepted on Play internal testing and TestFlight, and later on both
  stores, without rejection for missing privacy policy, account deletion, or minimum functionality.
- **SC-005**: Recorded real-device QA exists for one iPhone and one Android phone for every build
  submitted to a store.
- **SC-007**: A deleted account loses access within one minute of confirming, and its data is
  purged no earlier than 30 days and no later than 31 days after deletion.
- **SC-006**: No core screen on a tested device hides a control or figure behind a notch, cut-out,
  or home indicator.

## Assumptions

- The app packages the existing web front end inside a native shell rather than rebuilding screens
  natively; the front end is bundled in the app (not loaded from a website), so the app opens
  without fetching its screens. Changes to screens therefore reach users through app updates.
- The service is extended to accept requests from the app (cross-origin rules), with no change to
  business logic.
- The owner holds or will obtain an Apple Developer Program membership and a Google Play developer
  account; store fees and review timelines sit outside this feature's control.
- The existing privacy policy page is live and is updated to describe app data handling (secure
  session storage, no tracking) before submission.
- App language is English, as on the web.
- The 30-day purge is permitted by constitution v2.0.0, Principle VII's account-deletion exception,
  which also requires a data-free record of each purge.
- iPad support means "works correctly", not an iPad-specific layout.
- Out of scope: push notifications, offline queue, Mac App Store, platform-only features, any
  receiving (buy-side) flow, and in-app purchases.
