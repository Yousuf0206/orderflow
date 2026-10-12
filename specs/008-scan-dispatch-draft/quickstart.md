# Quickstart: validating scan-to-dispatch

Shapes: [contracts/parse-document.md](./contracts/parse-document.md), [data-model.md](./data-model.md).

## 1. Backend (no network to the vendor)

`cd backend && pytest` — the reading service is faked in tests. Must cover:

- parse-document never creates a dispatch or changes remaining
- matching: alias names, reordered words, a row for an item not on the PO → unmatched, never a new
  line; a line of another PO is never returned
- validation: non-numeric / negative / 4-decimal quantities → empty + low; future date → empty
- 413, 415, 422 unreadable, 429 at the cap, 502/504 vendor failure, 503 disabled, 403 viewer role,
  404 other organization's PO
- confirm with `source_scan_id`: links the scan; reuse → 409; other user's scan → 409
- purge deletes images > 30 days and on account/org purge

## 2. Frontend

`cd frontend && npx vitest run` — draft pre-fills the form, low-confidence marks, unmatched panel,
Confirm dispatch label, leaving the draft sends nothing, failure states show Retake / Type it
instead.

## 3. Against a staging API with a real key (never production, XXVII)

1. `SCAN_ENABLED=true`, staging `ANTHROPIC_API_KEY`.
2. Run the accuracy script on the ≥ 20-note test set; record SC-002 in `docs/qa/records/`.
3. On a 3-line PO, scan a clear 2-line note; confirm; remaining equals typing the same values.

## 4. Real devices (XXVI, XXXIV)

One physical iPhone and one Android phone, browser and app: camera, gallery, permission denied
then gallery, airplane mode (clear failure, no draft), time from tap to confirmed dispatch.

## 5. Release gate

Privacy policy names the vendor, 30-day retention, and the vendor's training/retention terms
(verified and recorded); `SCAN_ENABLED` turned on in production only after 3–4.
