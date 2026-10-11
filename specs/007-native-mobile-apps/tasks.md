# Tasks: Native iOS and Android Apps

**Input**: `/specs/007-native-mobile-apps/` — plan.md, spec.md, research.md, data-model.md,
contracts/, quickstart.md

**Organisation**: phases follow the breakdown supplied on 2026-10-12 (A phone UI → B Capacitor →
C store path), with each supplied item's id in brackets, e.g. `(A1)`. Planning added a parallel
**Phase D – Account deletion** (spec FR-012 blocks the App Store) and some tasks the brief left
implicit. Story labels map to spec.md user stories.

**[H]** marks tasks only a person can do (physical devices, store accounts, Xcode on macOS). They
are never checked without a record in `docs/qa/records/` or `docs/mobile/RELEASE.md`.

## Task rules

- Store submission (T046) requires a recorded pass on one physical iPhone and one physical Android
  phone for that exact build, and both platforms carrying the same features (constitution XXXIV).
- Emulator or viewport passes never satisfy a real-device task (XXVI).
- Dev and live-reload builds never point at production (XXVII); only release builds do.
- No task may add a business rule to the app (XXXIII).

---

## Phase A: Phone UI ready for the shell

- [ ] T001 [US1] (A1) Audit PO list and PO detail at 320/390px on a real phone; fix anything clipped or below 44px in `frontend/src/pages/purchase-orders/PurchaseOrdersList.tsx` and `PurchaseOrderDetail.tsx`; extend `frontend/tests/e2e/mobile-viewport.spec.ts` for any fix
- [X] T002 [US1] (A2) Keyboard-safe dispatch submit per research R2: keep the submit in flow, scroll the focused quantity input into view above the keyboard (`scrollIntoView` on focus with visual-viewport awareness) in `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx`; Playwright asserts submit stays below the last quantity box
- [X] T003 [US1] Interrupted-save handling per R7: on timeout/network failure of a dispatch POST show "We couldn't confirm this dispatch was saved", refetch PO + dispatches, and block resubmit until they load, in `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx`; Vitest case in `frontend/tests/unit/multiItem.test.tsx`
- [X] T004 [US1] "Can't reach OrderFlow" state when the device is offline (navigator.onLine + failed request), shared via `frontend/src/components/ui/QueryState.tsx`; nothing shown as saved
- [ ] T005 [H] [US1] (A3) Real-device browser records: one Android (Chrome) and one iPhone (Safari) against production — 3-item PO, two quantities with keyboard open, save — written to `docs/qa/records/YYYY-MM-DD-<device>.md` (device, OS, browser, outcome, zoom/pan needed?)

**Checkpoint**: Phase B starts only after T005 records exist for both platforms (XXXV).

---

## Phase B: Capacitor

- [ ] T010 (B1) Add Capacitor to `frontend/`: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`; `frontend/capacitor.config.ts` with appId `app.orderflow.mobile`, appName `OrderFlow`, webDir `dist`, `android.scheme`/`androidScheme: "https"`; generate and commit `frontend/ios/` and `frontend/android/`
- [ ] T011 (B2) Release config: build with `VITE_API_BASE_URL=https://purchaseorderflow.vercel.app/api`; separate dev config `frontend/capacitor.config.dev.ts` with live reload against local Vite + local/staging API only (R10); `npm run build:app` and `npm run cap:dev` scripts in `frontend/package.json`
- [X] T012 [P] Backend CORS: add `capacitor://localhost` and `https://localhost` to `cors_origins` default/env in `backend/src/core/config.py`; test in `backend/tests/integration/` that preflight from both origins succeeds and an unknown origin does not
- [ ] T013 [P] [US2] Platform module `frontend/src/platform/` (`isNative`, `tokenStore.hydrate/get/set`, `startRoute`, `openExternal`) per `contracts/app-shell.md`; choose and add the secure-storage plugin after checking maintenance and current-Capacitor support (R4); Vitest tests with the plugin mocked
- [ ] T014 [US2] (B5) Route `frontend/src/services/apiClient.ts` `getTokens/setTokens` through `tokenStore`; hydrate before first render in `frontend/src/main.tsx`; sign-out clears memory + secure store; web behaviour and existing tests unchanged
- [ ] T015 [US1] Native routing per R5/R6 in `frontend/src/App.tsx`: in native builds `/` → `startRoute`, `/pricing` and landing not routed, billing upgrade surfaces hidden; Privacy/Terms via `openExternal` (`@capacitor/browser`); Vitest with `isNative` mocked true
- [ ] T016 [US4] (B4) Icons + splash: sources in `frontend/resources/` (icon 1024², adaptive foreground/background, splash), generated with `@capacitor/assets`; `@capacitor/splash-screen` hides after first route render
- [ ] T017 [US4] Status bar (`@capacitor/status-bar`) styled to the app; safe-area insets (`env(safe-area-inset-*)`, `viewport-fit=cover`) in `frontend/index.html` and `frontend/src/index.css` for app shell header, menu drawer, and bottom of forms
- [ ] T018 [US4] Orientation: portrait on iPhone, all on iPad (`frontend/ios/App/App/Info.plist`); Android portrait in `AndroidManifest.xml`
- [ ] T019 Android hardening per R11: `minSdkVersion 26`, `usesCleartextTraffic=false`, HTTPS-only network security config, WebView debugging off in release (`frontend/android/`)
- [ ] T020 iOS: deployment target 15.0, iPhone + iPad device family, no arbitrary loads (`frontend/ios/App/`)
- [ ] T021 [H] (B3) Run on an Android emulator + one physical Android phone, and an iOS simulator + one physical iPhone (macOS + Xcode); record in `docs/qa/records/`
- [ ] T022 [H] [US2] (B5) On each physical device: sign in, force-quit, reopen (signed in); reboot (signed in); sign out, reopen (signed out); record
- [ ] T023 [H] [US3] On each physical device: dashboard counts, a party's per-unit remaining, and a filtered PO list equal the web at the same moment; record

---

## Phase D: Account deletion (parallel with B; blocks C)

- [X] T030 [P] [US6] Migration `backend/src/migrations/versions/0004_account_deletion.py` and models: `users.deleted_at`, `users.purge_after`, `users.tokens_valid_after`, `memberships.deleted_at`, `organizations.deleted_at`, `organizations.purge_after`, new `account_purge_records` (id, kind, subject_id, deleted_at, purged_at) per data-model.md
- [X] T031 [US6] Token revocation: reject access and refresh tokens whose `iat` is before `users.tokens_valid_after`, and any request for a deleted user, deleted membership, or deleted organization, in `backend/src/core/security.py` / `tenant.py`; login of a deleted user → same 401 as bad credentials
- [X] T032 [US6] `backend/src/services/account_deletion.py` + `GET /auth/account/deletion-preview` and `DELETE /auth/account` in `backend/src/api/auth.py` per `contracts/account-deletion.md`: non-owner → user + memberships soft-deleted; sole owner → organization soft-deleted and every member revoked; co-owned organizations left intact; owner must echo organization names; audit entry written
- [X] T033 [US6] Purge job `backend/src/scripts/purge_deleted_accounts.py`: hard-deletes only rows with `purge_after <= now` and only what the deletion covered (user + memberships, or organization with all its records); writes one `account_purge_records` row each; refuses to run before the window; scheduled daily (Vercel cron or existing scheduler)
- [X] T034 [P] [US6] Backend tests `backend/tests/integration/test_account_deletion.py`: staff deletion leaves org data; owner deletion locks every member out at once; co-owner case; multi-org case; name-mismatch 422; re-signup with same email is a new account; purge skips rows < 30 days; purge removes due rows and writes records; purge never touches an org with an active owner
- [X] T035 [US6] Settings → Delete account in `frontend/src/pages/settings/` (web and app): calls preview, shows role effect, lists organizations that will be deleted with member counts, states the 30-day window, requires typing organization names for owners; signs out on success; Vitest tests
- [X] T036 [US6] Update `frontend/src/pages/legal/PrivacyPolicy.tsx`: app data handling (tokens in secure storage, no tracking, no offline storage), how to delete an account, the 30-day purge window

---

## Phase C: Store path

- [ ] T040 [H] (C1) Apple Developer Program membership and Google Play developer account under the business; record account owner in `docs/mobile/RELEASE.md` (no credentials in the repo)
- [ ] T041 (C2) Privacy policy live at `https://purchaseorderflow.vercel.app/privacy` with T036 content; verify deployed (XXIV)
- [ ] T042 `docs/mobile/RELEASE.md`: version/build numbering (same version on both platforms), signing steps, upload steps, QA record template, store listing text with no offline/push/feature claims beyond the build (FR-011, XXXVII)
- [ ] T043 [P] Store screenshots from the release build on device sizes each store requires: dashboard, PO detail, dispatch (iPhone 6.7"/6.5", iPad 13", Android phone); stored under `docs/mobile/screenshots/`
- [ ] T044 [H] (C3) TestFlight build uploaded (macOS + Xcode); external testing group created
- [ ] T045 [H] (C4) Play internal testing build uploaded; testers invited
- [ ] T046 [H] [US5] Store submission gate: same build version on both platforms; recorded real-device pass (T021–T023) on one iPhone and one Android phone for this build; account deletion verified in-app on both; record in `docs/qa/records/`
- [ ] T047 [H] [US5] (C5) Three external testers each complete a multi-item partial dispatch in the app (at least one per platform); outcomes recorded
- [ ] T048 [H] [US5] (C6) Submit to App Store review and Play production review only after T046 and T047 are recorded

---

## Dependencies

- A (T001–T005) → B (T010–T023) → C (T040–T048). D (T030–T036) runs alongside B and must finish
  before T046.
- T013 → T014, T015. T010 → T011, T016–T020. T012 before any device run (T021).
- T030 → T031 → T032 → T033; T034 after T033; T035 after T032; T036 any time, before T041.
- T040 can start immediately (account approval takes days).

## Parallel opportunities

- T012, T013, T030 at the start of Phase B/D (different codebases).
- T016–T020 once T010 exists.
- T034 and T035 after T032; T043 alongside T044/T045.
- T040 (accounts) now, alongside everything.

## Implementation strategy

MVP = Phase A + B on Android and iOS physical devices with secure sessions (US1, US2): a clerk
records a truck from an installed build. Then D (required for iOS review), then C. Nothing is
submitted to a store until T046–T047 are recorded.

**Implementation notes (2026-10-12)**: T031 revokes access by checking `deleted_at` on user, membership and organization on every request instead of a `tokens_valid_after` timestamp (same effect, one less field). Deletion replaces the email with `deleted-<id>@deleted.invalid` so the address can sign up again. A purged user still named as actor in a surviving organization's audit log is kept as a bare id (email and password already erased) because the audit FK is non-nullable. The purge runs from Vercel Cron (`vercel.json`, daily 03:00 UTC) and needs `CRON_SECRET` set in Vercel; without it the endpoint refuses. T001 stays open: its viewport part passes, its real-phone part is [H].

**Cannot be done from this Windows machine**: anything marked [H], and every iOS build step
(T020 can be edited but not built), which needs macOS with Xcode.
