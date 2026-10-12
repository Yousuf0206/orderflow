# Research: Scan a Delivery Note into a Dispatch Draft

## R1. Reading service: vision LLM with a forced JSON schema

- **Decision**: one call per scan to a vision-capable Claude model through the Anthropic API,
  using a tool definition whose input schema is the draft shape (date, vehicle_ref, lines with
  raw_text, qty, unit, confidence). The model is forced to call that tool, so the reply is
  structured data, not prose. Model id comes from config (`SCAN_MODEL`, default
  `claude-sonnet-5-5`); the key from `ANTHROPIC_API_KEY`.
- **Rationale**: delivery notes in this market are a mix of printed tables, stamps, carbon copies
  and handwritten quantities. Table OCR services read printed grids well but return cells, not
  "this row is 40 bags of OPC-53"; turning their output into rows is the hard part and would need
  an LLM anyway. A vision LLM does reading and structuring in one step. The brief recommends this.
- **Alternatives**: Google Document AI / Cloud Vision / AWS Textract — strong on clean printed
  tables, weak on mixed and handwritten notes, still need row structuring; a second vendor and
  region to disclose. Hybrid OCR → LLM — two calls, two vendors, more latency for SC-005's 15 s;
  revisit only if R6's test set shows the single call misreading digits that OCR gets right.
- **Guardrail**: the model's output is never trusted as data. The server re-validates every field
  (R3) and never lets the model choose a purchase order line (R4).

## R2. Privacy and the vendor (Principle XLI)

- **Decision**: images go only from our backend to the reading service over HTTPS; the browser
  never calls the vendor and never holds a vendor key. The privacy policy is updated before
  release to name the vendor, the purpose, our 30-day retention, and the vendor's own retention
  and training terms as they stand on release day.
- **Owner requirement (2026-10-13)**: no note image may be retained or used for training by the
  vendor. Default API terms (no training; deletion within 30 days) do not meet "not retained", so
  scanning requires Anthropic Zero Data Retention on the key's organization, attested by
  `ANTHROPIC_ZERO_RETENTION_CONFIRMED`; models that require retention (Fable, Mythos) are refused
  in code. Draft policy text: [privacy-draft.md](./privacy-draft.md).
- **Release gate**: someone verifies in writing (recorded in `docs/qa/records/`) that the vendor's
  current commercial API terms do not use inputs for training, and what retention applies. If the
  terms change, the policy changes or the feature is switched off (`SCAN_ENABLED=false`).

## R3. Validation of what the model returns

- Quantities: must parse as a positive decimal with at most 3 places (matches `Numeric(14,3)`);
  otherwise the field is returned empty with confidence `low`.
- Date: ISO date, not in the future, not before the PO date minus 1 year; otherwise empty.
- Vehicle ref: trimmed, max 100 chars (the dispatch column limit).
- Lines: at most 50 rows read; text trimmed to 200 chars.
- Confidence: the model reports `high | medium | low` per field; the server downgrades to `low`
  any field it had to clean. The UI marks `medium` and `low` (spec FR-004).
- Units are passed through as text and never converted (Principle XXIX).

## R4. Matching rows to PO lines on the server

- **Decision**: normalise both sides (lower case, strip punctuation and spaces, expand a small
  abbreviation table, e.g. `opc`, `ppc`, `tmt`, `mm`, `kg`) and score each read row against each
  open line of that PO with `rapidfuzz.fuzz.token_set_ratio`. Assign greedily, best score first,
  one row per line. Score ≥ 85 → matched; 60–84 → matched but confidence `low` ("check this
  match"); < 60 → unmatched.
- A unit mismatch between a read row and its matched line (e.g. "bags" vs "MT") marks the quantity
  `low` and keeps the line's unit on screen.
- **Rationale**: the PO is already known and has few lines, so matching is a small, deterministic
  problem the server can test without the model. Keeping it off the model means the model can never
  attach a quantity to a line of another PO.
- **Alternatives**: ask the model to match against the line list — couples correctness to the
  model and to prompt wording; stdlib `difflib` — workable but weaker on reordered words; rapidfuzz
  is a small, pure wheel.

## R5. Image size and transport

- **Decision**: the client downsizes to max 2000 px on the long edge, JPEG quality 0.8 (typically
  300–700 KB) before upload. Server limit **4 MB**, not the 8 MB in the brief: Vercel Functions cap
  request bodies at 4.5 MB, so 8 MB uploads would fail before reaching our code.
- Accepted types: JPEG, PNG, HEIC is converted on the client by the canvas step; server accepts
  `image/jpeg` and `image/png` only and checks magic bytes, not just the header.

## R6. Storage and retention of images

- **Decision**: store the compressed image bytes in Postgres (`scan_images`, one row per scan),
  deleted by the existing daily purge cron when older than 30 days, and cascaded when the
  organization or the scanning user is purged (Principle VII flow from 007).
- **Rationale**: at ≤ 50 scans/org/day of ≤ 1 MB, 30 days is bounded; no new storage vendor to
  disclose, tenant scoping and deletion use the code that already exists.
- **Alternatives**: Vercel Blob (private) or Supabase Storage — better for large volume; adds a
  second place images live and a second deletion path. Move there if storage grows past ~5 GB.

## R7. Daily scan cap

- **Decision**: `SCAN_DAILY_LIMIT_PER_ORG` (default 50), counted from `document_scans` rows in the
  current UTC day, checked before the vendor is called; over the cap → 429 with a plain message.
  Failed reads count (they cost money too).

## R8. Capture on each platform

- **Web**: `<input type="file" accept="image/*" capture="environment">` — opens the camera or the
  library on iOS Safari and Android Chrome; no `getUserMedia` viewfinder to build and maintain.
- **Apps**: `@capacitor/camera` `getPhoto({ source: Prompt })` — gives the Camera / Photos choice
  and native permission prompts. Usage strings: iOS `NSCameraUsageDescription`,
  `NSPhotoLibraryUsageDescription` ("OrderFlow uses the camera to photograph delivery notes so it
  can fill in a dispatch for you to check."); Android `CAMERA` permission declared.
- Both paths produce a `Blob` passed to the same compression and upload code.

## R9. Draft UI: reuse the dispatch form

- **Decision**: the scan opens the existing multi-line dispatch form on PO detail, pre-filled from
  the draft, with confidence markers and an "Unmatched rows" panel above it. Submit is the existing
  submit, relabelled **Confirm dispatch** in scan mode, with the same over-dispatch confirm, the
  same interrupted-save handling (007 R7), and the same POST.
- **Rationale**: one form means one set of rules (Principle XXXVIII) and no second dispatch screen
  to keep in step.

## R10. Linking the dispatch to its scan

- **Decision**: the dispatch create body gains an optional `source_scan_id`. The server checks it
  belongs to this organization, this PO and this user, is unconfirmed, and sets the scan's
  `dispatch_id` in the same transaction. The dispatch itself is unchanged.
- **Rationale**: answers "which photo was this dispatch?" for support within 30 days, and lets
  SC-001/SC-002 be measured, without a second dispatch type.

## R11. Measuring the success criteria

- `document_scans` records timings (`created_at`, `read_ms`) and outcome; the confirmed dispatch's
  lines are compared with the draft returned (stored as `draft_json` on the scan) to compute fields
  edited. This gives the brief's metrics: median time to confirm, and share of fields edited on
  clear notes (stretch target < 50%).
- A test set of ≥ 20 real, consented, anonymised delivery notes is kept outside the repo; a script
  runs it against the configured model and reports SC-002 accuracy before each release.
