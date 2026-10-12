# Quickstart: validating the native apps

Shapes: [contracts/app-shell.md](./contracts/app-shell.md),
[contracts/account-deletion.md](./contracts/account-deletion.md),
[data-model.md](./data-model.md).

## 1. Mobile web first (Step 1)

- `cd frontend && npx playwright test tests/e2e/mobile-viewport.spec.ts` — passes at 320/390px.
- On a real Android phone (Chrome) and a real iPhone (Safari), against production: open a 3-item
  PO, enter two quantities with the keyboard open, save. Record device/OS/browser in
  `docs/qa/records/`.

## 2. Build the apps (needs Xcode on macOS for iOS; Android Studio for Android)

```bash
cd frontend
npm run build:app     # production API baked in, then cap sync
npx cap open android   # run on a device
npx cap open ios       # run on a device (macOS only)
```

Dev against a local/staging API uses the dev Capacitor config with live reload — never production.

## 3. In-app checks (each platform, physical device)

1. Sign up → onboarding; force-quit → still signed in; sign out → reopen → signed out.
2. Dashboard, parties, PO list with filters, PO detail: figures equal the web.
3. Record a two-item dispatch on a three-item PO in < 60 s; over-dispatch warns and confirms.
4. Airplane mode: app says it cannot reach OrderFlow; nothing shows as saved.
5. Notch/home indicator: nothing hidden on any core screen; iPad: core flows work.
6. No pricing, upgrade, or landing page reachable.
7. Settings → Delete account (staff, then owner on a test org): access revoked at once; owner
   confirmation names the org and the 30-day window.

## 4. Backend

`cd backend && pytest` — includes deletion, revocation, purge-before-30-days refusal, purge scope,
and purge records.

## 5. Store submission gate

Same build exercised on one iPhone and one Android phone, recorded in `docs/qa/records/`; both
platforms carry the same features; listing links `/privacy`, which states the 30-day purge window.
