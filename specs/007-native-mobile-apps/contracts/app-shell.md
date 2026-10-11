# Contract: App shell

| Item | Value |
|------|-------|
| App id / bundle id | `app.orderflow.mobile` (both platforms, never changed) |
| Display name | OrderFlow |
| webDir | `frontend/dist` (production Vite build) |
| API base (release) | `https://purchaseorderflow.vercel.app/api` via `VITE_API_BASE_URL` |
| Origins to allow (server CORS) | `capacitor://localhost`, `https://localhost` |
| Android | minSdk 26, `androidScheme: "https"`, cleartext disabled |
| iOS | deployment target 15.0, iPhone + iPad, portrait on iPhone; all orientations on iPad |
| Start route | `/dashboard` if signed in, else `/login` |
| Not routed in app | `/` landing, `/pricing`, billing upgrade surfaces |
| External links | Privacy, Terms → in-app browser sheet |
| Token storage | platform secure storage (Keychain / Keystore); web unchanged |

## Platform module (`frontend/src/platform/`)

- `isNative(): boolean`
- `tokenStore`: `hydrate(): Promise<void>`, `get()`, `set(tokens | null): Promise<void>`
- `startRoute(signedIn): string`
- `openExternal(url): Promise<void>`

It MUST NOT compute or validate any business figure (constitution XXXIII).
