# Implementation Plan: Scan a Delivery Note into a Dispatch Draft

**Branch**: `008-scan-dispatch-draft` (spec directory; the working git branch is `main`)
| **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-scan-dispatch-draft/spec.md`

## Summary

A photo of a delivery note becomes a pre-filled dispatch form on the purchase order the user is
looking at. The user checks and fixes it and presses **Confirm dispatch**, which is the existing
dispatch POST. Nothing else records a dispatch (constitution XXXVIII).

```
phone (web file input / Capacitor camera) → compress → POST parse-document
  → backend: validate, cap, store image → vision LLM (forced JSON schema)
  → server validation + fuzzy match to this PO's open lines → draft JSON
  → existing multi-line dispatch form, pre-filled → existing POST dispatch (+ source_scan_id)
```

Departures from the supplied brief, explained in research.md: upload limit **4 MB, not 8 MB**
(Vercel request-body cap, R5); endpoint **nested under the PO** like the existing dispatch routes;
matching is done **only on the server**, never by the model (R4); feature behind `SCAN_ENABLED`.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.6 / React 18 (frontend)

**Primary Dependencies**: FastAPI, SQLAlchemy, Alembic (existing); new: `anthropic` (Python SDK),
`rapidfuzz`; frontend new: `@capacitor/camera` 8.x

**Storage**: Supabase Postgres (existing); two new tables, images as `bytea` (R6)

**Testing**: pytest with the reading service faked; Vitest; real-device QA records (XXVI)

**Target Platform**: Vercel (FastAPI service + Vite SPA); iOS 15+ / Android 8+ via the 007 shell

**Project Type**: web application + Capacitor mobile shell

**Performance Goals**: draft or clear failure within 15 s of upload (SC-005); vendor call
deadline 12 s, matching the client request deadline

**Constraints**: request body ≤ 4.5 MB on Vercel; no business rule on the device (XXXIII); online
only (XXXVII, XL); dev/test never call production or a production key (XXVII)

**Scale/Scope**: ≤ 50 scans per organization per day; ≤ 50 rows per note; one image per scan

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan meets it | Pass |
|-----------|----------------------|------|
| I Multi-tenancy | scans and images carry `organization_id`; PO lookup is tenant-scoped; matching only against `po_id`'s lines | ✓ |
| II / XXIX Remaining sacred, per line, no unit mixing | no new figure stored; confirm is the existing POST; units passed through, mismatch flagged, never converted | ✓ |
| V Role-based access | parse-document requires the record-dispatch capability | ✓ |
| VI Audit | confirmed dispatch audited exactly as a typed one; scans themselves are not dispatches | ✓ |
| VII Deletion | images purged at 30 days and with account/org purge | ✓ |
| XII No silent failures | every vendor/network error is an explicit error state; no draft invented | ✓ |
| XXIV Verify deployed | privacy policy and `SCAN_ENABLED` checked on the deployed site before announcing | ✓ |
| XXVI / XXXIV Phone claims, both platforms | real-device records, iOS + Android released together | ✓ (gate) |
| XXVII Tests never touch production | vendor faked in tests; staging key only for accuracy runs | ✓ |
| XXXIII One API | reading and matching on the server; app only captures and displays | ✓ |
| XXXVIII Draft until confirmed | parse-document has no write path to dispatches | ✓ |
| XXXIX Show doubt, allow every fix | confidence per field, unmatched panel, all fields editable; PO always known (v1 from PO detail) | ✓ |
| XL Honest claims | no accuracy/offline wording; copy reviewed in tasks | ✓ |
| XLI Images | 30-day retention, tenant-scoped, vendor and its terms disclosed before release | ✓ (gate) |
| XX Own one job | no document library, no inventory | ✓ |

No violations. Two items are release gates rather than design gates (real-device records; vendor
terms verified and disclosed).

**Post-design re-check**: data-model.md and contracts/parse-document.md add no write path to
dispatch tables outside the existing POST, and no field computed from the model is stored as truth.
Still passes.

## Project Structure

### Documentation (this feature)

```text
specs/008-scan-dispatch-draft/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/parse-document.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── migrations/versions/0005_document_scans.py
│   ├── models/document_scan.py            # DocumentScan, ScanImage
│   ├── services/scan_reader.py            # vendor call, schema, timeout (fakeable)
│   ├── services/scan_matching.py          # normalise + rapidfuzz match, validation (R3, R4)
│   ├── api/dispatches.py                  # + parse-document; create accepts source_scan_id
│   ├── services/account_deletion.py       # purge also removes scans/images
│   └── core/config.py                     # SCAN_* settings
└── tests/integration/test_scan_dispatch.py, tests/unit/test_scan_matching.py

frontend/
├── src/
│   ├── platform/capture.ts                # web file input / @capacitor/camera → Blob
│   ├── utils/compressImage.ts             # 2000 px, JPEG 0.8
│   ├── services/scans.ts                  # parse-document client
│   └── pages/purchase-orders/
│       ├── PurchaseOrderDetail.tsx        # Scan button; form accepts a draft
│       └── ScanDraftPanel.tsx             # confidence marks, unmatched rows
├── ios/App/App/Info.plist                 # camera + photo usage strings
├── android/app/src/main/AndroidManifest.xml  # CAMERA permission
└── tests/unit/scanDraft.test.tsx
```

**Structure Decision**: existing web-application layout (`backend/`, `frontend/`) plus the 007
Capacitor projects; no new service or package.

## Complexity Tracking

None — no constitution violations to justify.
