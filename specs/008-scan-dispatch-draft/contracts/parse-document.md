# Contract: Read a delivery note

`POST /purchase-orders/{po_id}/dispatches/parse-document`

Nested under the existing dispatches router (the brief's `/dispatches/parse-document` with the PO in
the path instead of the body, matching `POST /purchase-orders/{po_id}/dispatches`).

**Auth**: bearer token; caller's role must be allowed to record dispatches; PO must belong to the
caller's organization and not be closed or fully dispatched. Otherwise 403 / 404 / 409 as today.

**Request**: `multipart/form-data`, field `image` — JPEG or PNG, ≤ 4 MB.

**Response 200** (always a draft, possibly partial):

```json
{
  "scan_id": "uuid",
  "document_date": { "value": "2026-10-13", "confidence": "high" },
  "vehicle_ref":   { "value": "LES-1234", "confidence": "medium" },
  "lines": [
    {
      "raw_text": "OPC 53 Grade cement",
      "qty":  { "value": "40", "confidence": "high" },
      "unit": "bags",
      "matched_line_id": "uuid-or-null",
      "match_confidence": "high | low | null"
    }
  ],
  "warnings": ["unit_mismatch"]
}
```

- `value` is `null` when not found; quantities are decimal strings (never floats).
- `matched_line_id` is always an open line of `po_id`, or `null` (= "Unmatched — pick a line or
  skip").
- No dispatch, remaining, audit dispatch entry, or notification changes.

**Errors**

| Status | `detail` | Meaning |
|--------|----------|---------|
| 413 | `image_too_large` | over 4 MB |
| 415 | `unsupported_image` | not JPEG/PNG by content |
| 422 | `unreadable` | no usable text; UI offers Retake / Type it instead |
| 429 | `daily_scan_limit` | organization reached today's cap |
| 502 | `reader_failed` | vendor error; nothing drafted |
| 503 | `scanning_disabled` | `SCAN_ENABLED` is off |
| 504 | `reader_timeout` | vendor exceeded 12 s; nothing drafted |

## Confirm

Existing `POST /purchase-orders/{po_id}/dispatches`, body unchanged plus optional
`source_scan_id`. Same validation, over-dispatch rule, audit entry and response as a typed
dispatch. `source_scan_id` not valid for this user/PO, or already confirmed → 409, no dispatch.

## Client

- PO detail shows **Scan delivery note** beside Record dispatch when scanning is enabled, the user
  can record dispatches, and the PO is open.
- Draft opens the dispatch form pre-filled; fields with `medium`/`low` confidence are marked;
  unmatched rows listed above the form; primary button **Confirm dispatch**.
