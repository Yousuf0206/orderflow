# Releasing the OrderFlow apps (iOS and Android)

Spec: `specs/007-native-mobile-apps/`. App id on both stores: `app.orderflow.mobile`, never changed.

## Accounts (T040)

| Store | Account owner | Enrolled on |
|-------|---------------|-------------|
| Apple Developer Program (organization) | _to fill in_ | _to fill in_ |
| Google Play Console (organization) | _to fill in_ | _to fill in_ |

Record people and dates only. No passwords, keystores, API keys, or certificates in this repo.

## Version and build numbers

- One **version** for both platforms, `MAJOR.MINOR.PATCH` (first release `1.0.0`). Both stores
  ship the same version with the same features (constitution XXXIV, FR-013).
- A **build number** that only ever increases, shared by both platforms for the same bundle.
- Where to set them:
  - Android: `frontend/android/app/build.gradle` → `versionName` (version), `versionCode` (build)
  - iOS: Xcode → App target → General → Version (`MARKETING_VERSION`) and Build
    (`CURRENT_PROJECT_VERSION`)
- Commit the bump on its own (`Release app 1.0.0 (build 1)`) and tag it `app-v1.0.0+1`. QA records
  name this exact version and build.

## Build the bundle

```bash
cd frontend
npm ci
npm run build:app   # bakes https://purchaseorderflow.vercel.app/api in, then cap sync
```

`build:app` is the only way to make a store build. Never ship a build synced by `npm run cap:dev`:
that one loads a local dev server (check `android/app/src/main/assets/capacitor.config.json` has no
`server.url`).

## Android: sign and upload (T045)

1. One-time: create the upload keystore and keep it **outside** the repo in the business's password
   manager, with its passwords:
   `keytool -genkey -v -keystore orderflow-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Enrol in **Play App Signing** when creating the app in Play Console (Google holds the app
   signing key; the file above is only the upload key).
3. Android Studio (`npx cap open android`) → Build → Generate Signed App Bundle → `.aab`,
   release variant, upload key.
4. Play Console → Testing → Internal testing → Create release → upload the `.aab` → add testers.
5. Data safety form: collects email and business data entered by the user; encrypted in transit;
   user can request deletion (in-app, Settings → Delete account); no data shared, no tracking.

## iOS: sign and upload (T044, macOS + Xcode only)

1. App Store Connect → Apps → New app, bundle id `app.orderflow.mobile`, name OrderFlow.
2. `npx cap open ios` → App target → Signing & Capabilities → Team = the business, automatic
   signing.
3. Destination "Any iOS Device (arm64)" → Product → Archive → Distribute App → App Store Connect.
4. TestFlight → create an external testing group, add testers, submit the build for beta review.
5. App Privacy: same answers as the Play data safety form. No tracking.
6. Review notes: give a demo account (staff role, test organization) — never a real customer's.

## Before submitting for review (T046–T048)

All of these must be recorded in `docs/qa/records/` for the exact version and build:

- [ ] Real-device pass on one physical iPhone and one physical Android phone (T021–T023 checks)
- [ ] Session: sign in, force-quit, reopen, reboot, sign out (T022)
- [ ] Figures equal the web at the same moment (T023)
- [ ] Account deletion done in the app on both platforms
- [ ] Three external testers each recorded a multi-item partial dispatch, at least one per
      platform (T047)
- [ ] Same version and build number on both platforms

Only then submit to App Store review and Play production review (T048).

## Store listing text

Links: privacy `https://purchaseorderflow.vercel.app/privacy`, terms
`https://purchaseorderflow.vercel.app/terms`, support `https://purchaseorderflow.vercel.app`.

**Name**: OrderFlow
**Subtitle / short description** (≤ 30 / 80 chars): Purchase orders and partial dispatches

**Description**:

> OrderFlow keeps track of purchase orders that ship in parts. Record what went out on each truck,
> item by item, and see what is still left to send for every order and every party.
>
> - Purchase orders with several items and per-unit remaining quantities
> - Record partial dispatches from your phone, with warnings before over-dispatching
> - Dashboard and filtered order lists, the same figures your team sees on the web
> - Parties, reports and an audit log of who changed what
> - Roles for owners, managers, staff and viewers
>
> OrderFlow needs an internet connection to load or save anything. Requires an OrderFlow account;
> you can create one in the app.

Do not add claims the build doesn't support: no offline mode, no push notifications, no prices or
plans (FR-011, constitution IX and XXXVII).

## QA record template

Save as `docs/qa/records/YYYY-MM-DD-<device>.md`:

```markdown
# <date> — <device model>

- Version / build: 1.0.0 (1)          <!-- or "browser" for T005 -->
- Platform / OS: iOS 18.x | Android 15
- Browser (web checks only): Safari 18 | Chrome 1xx
- Tester:
- API: production

| Check | Result | Notes |
|-------|--------|-------|
| 3-item PO, two quantities entered with keyboard open, saved | pass/fail | zoom or pan needed? |
| Sign in → force-quit → reopen: still signed in | | |
| Reboot → reopen: still signed in | | |
| Sign out → reopen: signed out | | |
| Dashboard counts equal web | | |
| Party per-unit remaining equals web | | |
| Filtered PO list equals web | | |
| Airplane mode: "can't reach OrderFlow", nothing shown as saved | | |
| Notch / home indicator: nothing hidden | | |
| No pricing, upgrade or landing page reachable | | |
| Delete account (test org) | | |
```

## Store screenshots (T043)

Take from the release build on a simulator/emulator of each size and save under
`docs/mobile/screenshots/<size>/`: dashboard, PO detail, dispatch form.

| Store | Size | Pixels (portrait) |
|-------|------|-------------------|
| App Store | iPhone 6.9" | 1320 × 2868 |
| App Store | iPhone 6.5" | 1284 × 2778 |
| App Store | iPad 13" | 2064 × 2752 |
| Google Play | Phone | 1080 × 1920 or larger, 9:16 |

Use a demo organization only, never real customer data.
