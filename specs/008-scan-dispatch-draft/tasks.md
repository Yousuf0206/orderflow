# Tasks: Scan a Delivery Note into a Dispatch Draft

**Input**: `/specs/008-scan-dispatch-draft/` — plan.md, spec.md, research.md, data-model.md,
contracts/parse-document.md, quickstart.md

**Organisation**: phases follow the breakdown supplied on 2026-10-13 (A API → B UI → C hardening),
with each supplied item's id in brackets, e.g. `(A1)`. Story labels map to spec.md user stories
(US1 scan and confirm, US2 fix before saving, US3 web and apps).

**[H]** marks tasks only a person can do (physical devices, real delivery notes, vendor terms).
They are never checked without a record in `docs/qa/records/`.

## Task rules

- `parse-document` never writes to `dispatches` or `dispatch_lines` (XXXVIII). Only the existing
  dispatch POST records a dispatch.
- Tests fake the reading service; no test calls the vendor or uses a production key (XXVII).
- Production `SCAN_ENABLED` stays `false` until T042 and T043 are recorded.

---

## Phase A: API draft pipeline

- [X] T001 Config in `backend/src/core/config.py`: `scan_enabled` (False), `anthropic_api_key`, `scan_model` (`claude-sonnet-5-5`), `scan_daily_limit_per_org` (50), `scan_max_bytes` (4_000_000); add `anthropic` and `rapidfuzz` to `backend/pyproject.toml`
- [X] T002 Migration `backend/src/migrations/versions/0005_document_scans.py` and models `backend/src/models/document_scan.py`: `document_scans`, `scan_images` per data-model.md, index `(organization_id, created_at)`
- [X] T003 [US1] (A1) `POST /purchase-orders/{po_id}/dispatches/parse-document` in `backend/src/api/dispatches.py`: record-dispatch capability, tenant-scoped open PO (403/404/409), 503 when disabled, 413 over `scan_max_bytes`, 415 unless JPEG/PNG by magic bytes, 429 at the daily cap (checked before the vendor call; failed reads count, R7); stores the image and a `document_scans` row
- [X] T004 [US1] (A2) `backend/src/services/scan_reader.py`: one vision call with a forced tool whose input schema is the draft shape (R1); 12 s deadline → `reader_timeout` 504; vendor error → `reader_failed` 502; no usable text → `unreadable` 422; behind a small interface the tests replace
- [X] T005 [US1] Validation in `backend/src/services/scan_matching.py` per R3: qty positive ≤ 3 decimals as decimal string, date not in the future and not > 1 year before the PO, vehicle ≤ 100 chars, ≤ 50 rows, text ≤ 200 chars; anything cleaned → confidence `low`
- [X] T006 [US2] (A3) Matching in `backend/src/services/scan_matching.py` per R4: normalise + abbreviation table, `token_set_ratio` against this PO's open lines only, greedy one-row-per-line, ≥ 85 matched, 60–84 matched `low`, < 60 unmatched; unit mismatch → qty `low` + `unit_mismatch` warning
- [X] T007 [US1] Dispatch create accepts optional `source_scan_id` (R10): same org, PO, user, status `read`; sets `dispatch_id`, `status=confirmed` in the same transaction; otherwise 409 and no dispatch
- [X] T008 [P] [US2] Unit tests `backend/tests/unit/test_scan_matching.py`: aliases ("OPC 53 Grade" ↔ "Cement OPC-53"), reordered words, unrelated row unmatched, two rows competing for one line, unit mismatch, every R3 validation case
- [X] T009 [US1] (A4) Integration tests `backend/tests/integration/test_scan_dispatch.py` with fixture images in `backend/tests/fixtures/scans/` (printed table, blurry, blank) and the faked reader: draft returned and **no dispatch / remaining unchanged**; blurry → 422; another org's PO → 404; viewer → 403; 413/415/429/502/503/504; confirm links scan; reuse → 409; another user's scan → 409; matched ids only ever from `po_id`

**Checkpoint**: `cd backend && pytest` green; parse-document has no path that writes a dispatch.

---

## Phase B: Mobile UI

- [X] T010 [P] [US3] `frontend/src/utils/compressImage.ts`: long edge ≤ 2000 px, JPEG 0.8, handles HEIC via canvas decode where the browser can; Vitest with a mocked canvas
- [X] T011 [US3] (B1) `frontend/src/platform/capture.ts`: web `<input type="file" accept="image/*" capture="environment">`; native `@capacitor/camera` `getPhoto({ source: Prompt })` → `Blob`; add `@capacitor/camera`; `frontend/src/services/scans.ts` uploads via `apiClient` (multipart, 12 s deadline)
- [X] T012 [US1] (B1) **Scan delivery note** beside Record dispatch on `frontend/src/pages/purchase-orders/PurchaseOrderDetail.tsx`, shown only when scanning is enabled (from `/auth/me` or a config endpoint), the user can record dispatches, and the PO is open
- [X] T013 [US1] [US2] (B2) `frontend/src/pages/purchase-orders/ScanDraftPanel.tsx` + form pre-fill: date, vehicle, remarks, per-line qty from the draft; unmatched rows panel ("Unmatched — pick a line or skip", line picker of this PO's open lines); add/remove rows; button **Confirm dispatch** sends the existing POST with `source_scan_id`; existing over-dispatch confirm and interrupted-save handling unchanged; leaving sends nothing
- [X] T014 [US2] (B3) Confidence and failure UX: `medium`/`low` fields marked "check this"; unit shown per line with a mismatch note; 422 → "We couldn't read this note" + Retake / Type it instead; 429 → today's limit message + typed form; 502/504/offline → no draft, plain message (XII); handwriting note "results may need more checking"; no accuracy or offline wording (XL)
- [X] T015 [P] Vitest `frontend/tests/unit/scanDraft.test.tsx`: pre-fill, marks, unmatched picker, Confirm label, leave = no request, each failure state, button hidden for viewers / closed PO / disabled
- [X] T016 [US3] (B4) Permissions: `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` in `frontend/ios/App/App/Info.plist` (R8 wording); `android.permission.CAMERA` in `AndroidManifest.xml`; denied camera → message + gallery still offered

---

## Phase C: Hardening

- [X] T030 (C1) Retention: extend the daily purge (`backend/src/scripts/purge_deleted_accounts.py` / internal cron) to delete `scan_images` and null `draft_json` older than 30 days, and delete scans/images with a purged user or organization; tests in `test_scan_dispatch.py`
- [X] T031 (C2) Trial limit message and count verified end to end (cap per org per UTC day, 429 copy in UI); setting documented in `docs/README.md` env table
- [X] T032 Accuracy script `backend/src/scripts/scan_accuracy.py`: runs a local folder of notes + expected JSON against the configured model (staging key only), prints SC-002 quantity and match accuracy; refuses a production database URL
- [X] T033 Metrics: median tap-to-confirm time and share of fields edited (draft_json vs confirmed dispatch) queryable for SC-001 and the < 50% stretch target; admin-only, no note text exposed
- [ ] T034 (C4) Draft ready in `privacy-draft.md`; paste it live together with T043. Privacy policy `frontend/src/pages/legal/PrivacyPolicy.tsx`: camera/photo use, images sent to the named reading service, 30-day retention, deletion with account, vendor training/retention terms as verified in T041
- [ ] T040 [H] Collect ≥ 20 real, consented, anonymised printed delivery notes with expected values (kept outside the repo); run T032; record SC-002 in `docs/qa/records/`
- [ ] T041 [H] Get Anthropic Zero Data Retention enabled for the organization owning the production key (contact sales; per organization), record the confirmation in `docs/qa/records/`, then set `ANTHROPIC_ZERO_RETENTION_CONFIRMED=true`. Terms checked 2026-10-13: default API = no training, deleted within 30 days — not enough for the owner's no-retention rule (R2)
- [ ] T042 [H] (C3) One physical Android phone and one physical iPhone, browser and app: camera, gallery, permission denied, airplane mode, 3-line PO with a 2-line note confirmed; remaining equals typing; record in `docs/qa/records/`
- [ ] T043 [H] Release: new app build on both stores together (XXXIV); privacy policy verified live (XXIV); then `SCAN_ENABLED=true` in production

---

**Implementation notes (2026-10-13)**: the "Scan enabled" flag reaches the UI as `scan_enabled` on `/auth/me`. T009's fixture images are minimal JPEG/PNG byte strings built in the test (the server only checks magic bytes and size; content comes from the fake reader), not files under `tests/fixtures/`. Image expiry runs from the same daily cron as the account purge but as its own step (`expire_scans`), so the purge's counts are unchanged; the cron response gains `expired_scan_images`. Metrics: `GET /admin/scan-metrics` (super admin). T034 is left open on purpose: the privacy text must name the vendor's training/retention terms, which T041 has to verify first, and publishing it before scanning is switched on would describe a feature users can't see. Migration 0005 verified on PostgreSQL 16 (Docker): the migration test suite passes, and upgrade → downgrade 0004 → upgrade on a fresh database leaves the expected tables, indexes and foreign keys.

**Decision (2026-10-13)**: scanning stays off (`SCAN_ENABLED=false`) until the owner chooses a reading provider. Owner rule: the provider must not retain note images or train on them. Options weighed: Anthropic API with a ZDR sales agreement; Claude on Amazon Bedrock with retention mode "none" (recommended — same model, self-serve, same per-scan cost); Google Document AI (no retention, weaker on messy notes). None is free. Switching to Bedrock means changing `scan_reader.py` and the ZDR flag only.

## Dependencies

- T001 → T002 → T003; T004, T005, T006 → T003 completes the draft; T007 independent of T004.
- T008 after T005/T006; T009 after T003–T007.
- Phase B needs T003 contract only (can start against a faked response); T011 → T012 → T013 → T014.
- T016 before any app build used in T042.
- T034 needs T041's result; T043 needs T030, T034, T040, T041, T042.

## Parallel opportunities

- T008 and T010 at once; T015 alongside T014; T040 and T041 can start now (no code needed).

## Implementation strategy

MVP = Phase A + T011–T013 on the web: a clerk scans and confirms in the phone browser with the
feature enabled only on staging. Then B3/B4 and Phase C. Production stays disabled until the device,
accuracy, and vendor-terms records exist.
