# Research: Native iOS and Android Apps

## R1. Shell technology and bundling

- **Decision**: Capacitor, with the production Vite build bundled as `webDir: "dist"`. The app does
  not load `purchaseorderflow.vercel.app` as a remote URL.
- **Rationale**: reuses every screen (XXXIII); a bundled UI opens without a network fetch and is far
  less likely to be rejected as a thin website wrapper (App Store minimum-functionality review).
- **Alternatives**: remote-URL WebView — instant UI updates, but slower start, blank screen
  offline, higher review risk; React Native rewrite — two UIs to keep in step, against XXXIII.
- **Consequence**: UI changes reach app users only through app releases; the API must stay
  backward compatible with the oldest supported app version.

## R2. Dispatch submit: in-flow, not sticky

- **Decision**: keep the submit button last in document flow, full width; do not pin it to the
  bottom of the viewport. Ensure the focused field scrolls into view above the keyboard.
- **Rationale**: a bottom-pinned button is exactly where the on-screen keyboard sits, which is why
  the current form keeps it in flow and `mobile-viewport.spec.ts` asserts it sits below the fields.
  The brief's goal (submit reachable with the keyboard open) is met by scroll-into-view plus
  in-flow placement, verified on real devices.
- **Alternatives**: sticky footer above the keyboard using visual-viewport tracking — fragile across
  iOS Safari, Android Chrome, and WebViews; revisit only if real-device QA shows a problem.

## R3. Origins and CORS

- **Decision**: add `capacitor://localhost` (iOS) and `https://localhost` (Android default scheme)
  to `cors_origins`; set `androidScheme: "https"`. API base in app builds is the absolute production
  URL via `VITE_API_BASE_URL` at build time.
- **Rationale**: bundled pages have a local origin; relative `/api` would not resolve.

## R4. Secure token storage

- **Decision**: a Keychain (iOS) / Android Keystore–backed Capacitor plugin behind
  `src/platform/tokenStore.ts`; web keeps `localStorage`. Candidate plugins evaluated at
  implementation for maintenance status and current-Capacitor support (e.g.
  `@aparajita/capacitor-secure-storage`, `capacitor-secure-storage-plugin`).
- **Rationale**: XXXVI. `@capacitor/preferences` is not encrypted and does not satisfy it.
- **Consequence**: secure storage is asynchronous while `getTokens()` is synchronous today. The app
  hydrates tokens into memory once at startup before rendering authenticated routes; writes go to
  memory and secure storage together; sign-out clears both.

## R5. Routing and start screen

- **Decision**: keep `BrowserRouter` (Capacitor serves `index.html` for unknown paths). In native
  builds, `/` redirects to `/dashboard` when signed in and `/login` otherwise.
- **Rationale**: the marketing landing page and pricing are web-only (R6).

## R6. Marketing, pricing, billing in the app

- **Decision**: in native builds, landing, pricing, and billing upgrade surfaces are not routed;
  links to them are hidden. Privacy and Terms remain, opened in an in-app browser sheet
  (`@capacitor/browser`) so the user can return.
- **Rationale**: constitution IX already hides paid plans; store rules forbid steering to outside
  payment. A store app with a marketing page as its first screen also reads as a website wrapper.

## R7. Unreachable service and interrupted saves

- **Decision**: reuse the existing request deadline and error states; add a clear "can't reach
  OrderFlow" state when the device is offline. If a dispatch save times out or the connection drops
  mid-request, show "we couldn't confirm this dispatch was saved" and refetch the PO and its
  dispatch history before allowing another submit.
- **Rationale**: XXXVII and XII; prevents duplicate dispatches from blind retries.

## R8. Account deletion is required

- **Decision**: implement FR-012 Option A on the server and in Settings on both web and app; not
  "if required".
- **Rationale**: Apple requires in-app deletion for apps offering sign-up; Google Play requires a
  deletion path as well. Constitution v2.0.0 VII permits the 30-day purge.
- **Design**: `DELETE /auth/account` soft-deletes, revokes, and stamps `purge_after = now + 30d`;
  token revocation via a per-user `tokens_valid_after` timestamp checked on every request (refresh
  tokens included); a daily purge job removes due rows and writes a purge record.

## R9. Deep links

- **Decision**: not in v1. The brief marks `orderflow://` optional; invitation and password-reset
  emails keep opening the website.
- **Rationale**: universal/app links need domain association files and per-flow handling; nothing in
  the spec requires them.

## R10. Development against non-production APIs

- **Decision**: live reload (`server.url` in a dev-only Capacitor config) points at the local Vite
  server, which points at a local or staging API. Release builds are produced only from the
  production config, with no `server.url`.
- **Rationale**: XXVII — a developer's phone build must not write to production by default.

## R11. Android hardening

- **Decision**: `usesCleartextTraffic=false`, HTTPS-only network security config, no debug
  WebView inspection in release builds, `minSdkVersion 26`.
