# Baseline before feature 002

**Captured**: 2026-10-08 | **Branch point**: `main` @ `0f4df3b`, clean tree

Recorded per T002 so pre-existing conditions are not attributed to this feature.

## Backend — `pytest`

```
14 passed, 1 warning in 5.06s
```

**Pre-existing warning** (not introduced here):
`StarletteDeprecationWarning: Using 'httpx' with 'starlette.testclient' is
deprecated; install 'httpx2' instead.` — originates in
`.venv/.../fastapi/testclient.py:1`, a dependency-level deprecation. Out of scope
for this feature.

## Frontend — `npm run test -- --run`

```
Test Files  1 passed (1)
      Tests  1 passed (1)
```

**Coverage observation**: a single unit test file exists
(`tests/unit/Login.test.tsx`). The feature's query-state and failure-path tests
are therefore largely new rather than modifications.

**Pre-existing warnings** (not introduced here): React Router v7 future-flag
notices for `v7_startTransition` and `v7_relativeSplatPath`.

## Frontend — `npm run build`

```
✓ 2589 modules transformed
dist/assets/index-*.js  680.90 kB │ gzip: 198.87 kB
✓ built in 29.22s
```

**Pre-existing warning**: bundle exceeds Vite's 500 kB chunk advisory. Noted as a
baseline measurement so any growth from this feature is visible; code-splitting is
not in scope (the constitution prefers reliability and clarity over optimisation
here).

## Summary

**No pre-existing failures.** Everything green at branch point, so any failure
appearing during this feature is attributable to it.

| Suite | Result | Baseline figure to compare against |
|-------|--------|-----------------------------------|
| `pytest` | pass | 14 tests |
| `vitest` | pass | 1 test |
| `vite build` | pass | 680.90 kB JS / 198.87 kB gzip |
