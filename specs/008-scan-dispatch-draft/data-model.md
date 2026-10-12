# Data Model: Scan a Delivery Note into a Dispatch Draft

No change to `dispatches`, `dispatch_lines`, `purchase_orders`, or `purchase_order_lines`.
Remaining is computed exactly as today (Principles II, XXIX).

## document_scans (new)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| organization_id | uuid FK organizations | tenant scope (Principle I) |
| purchase_order_id | uuid FK purchase_orders | same organization |
| user_id | uuid FK users | who scanned |
| status | enum `read`, `unreadable`, `failed`, `confirmed` | see transitions |
| read_ms | int, nullable | time spent by the reading service |
| draft_json | jsonb, nullable | the draft returned to the client (contracts/parse-document.md) |
| dispatch_id | uuid FK dispatches, nullable, unique | set on confirm |
| created_at | timestamptz | used for the daily cap and the 30-day purge |

Index: `(organization_id, created_at)` for the daily cap.

**Transitions**: created as `read` (draft returned), `unreadable` (no usable text), or `failed`
(vendor error/timeout). `read → confirmed` only through dispatch create with `source_scan_id`.
No other transition. A scan is never a dispatch and is never counted in remaining.

## scan_images (new)

| Field | Type | Notes |
|-------|------|-------|
| scan_id | uuid PK, FK document_scans ON DELETE CASCADE | |
| organization_id | uuid | tenant scope |
| content_type | `image/jpeg` or `image/png` | |
| bytes | bytea | ≤ 4 MB |
| created_at | timestamptz | |

## Retention (Principle XLI, spec FR-008)

- Daily purge (existing `/api/internal/purge-deleted-accounts` cron) also deletes `scan_images`
  rows older than 30 days and nulls `document_scans.draft_json` older than 30 days.
- Account / organization purge deletes that user's or organization's scans and images.
- `document_scans` metadata without image or draft may be kept for metrics; it holds no note text.

## Dispatch create (changed request only)

`source_scan_id` (optional uuid). Validated: same organization, same PO, same user, status `read`.
Sets `document_scans.dispatch_id` and `status = confirmed` in the dispatch's transaction.

## Config (new)

| Setting | Default | Purpose |
|---------|---------|---------|
| `SCAN_ENABLED` | `false` | kill switch; scan action hidden when off |
| `ANTHROPIC_API_KEY` | — | reading service key (Vercel env only) |
| `SCAN_MODEL` | `claude-sonnet-5-5` | vision model id |
| `SCAN_DAILY_LIMIT_PER_ORG` | `50` | R7 |
| `SCAN_MAX_BYTES` | `4000000` | R5 |
