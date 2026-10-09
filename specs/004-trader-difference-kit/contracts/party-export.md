# Contract: Party Remaining Export

Covers FR-019 to FR-025.

## `GET /parties/{party_id}/remaining/export`

### Parameters

| Parameter | Values | Default |
| --- | --- | --- |
| `format` | `csv`, `xlsx`, `pdf` | `csv` |

An unrecognised `format` is a 400, not a silent fallback to CSV: a trader who asked for a PDF and
received a CSV has been given the wrong thing without being told.

### Columns — exact and ordered

Fixed by FR-019. Neither the set nor the order may change without amending the spec:

1. `party_name`
2. `po_number`
3. `material`
4. `ordered_qty`
5. `dispatched_qty`
6. `remaining_balance`
7. `due_date`

### Row selection

Open orders only — `remaining_balance > 0` — matching how the party detail screen and the existing
`remaining-by-party` report already select rows. Soft-deleted orders are excluded, as everywhere
else (Principle VII).

### Figures

Every figure MUST be derived from dispatch rows at export time, via the same
`po_calc.compute`/`compute_many` the screen uses (FR-021). No stored or cached total may be read.
A downloaded file whose Remaining disagrees with the screen is the defect this requirement exists
to prevent — and it is the specific failure that would send a trader back to a spreadsheet, which
is what Principle XXI is defending against.

### Scoping and authorisation

- Scoped by organization. A `party_id` from another organization returns 404, not 403 — the
  existence of another tenant's party is not information this organization is entitled to
  (Principle I, matching `parties.py` `_get_active_party`).
- No role restriction: exporting is reading, and every role may read. Noted deliberately so a
  future reader does not mistake the absence for an oversight.

### Audit

Each export writes one `log_action` entry: actor, organization, action `export`, entity type
`party`, entity id, and the requested format (FR-025).

**Known inconsistency, not fixed here**: `GET /reports/{report}/export` (`reports.py:172`) writes no
audit entry. This feature's scope is the party export, so the organization reports are left as they
are — but a system that logs one export and not the other invites the question of which log to
trust, and closing that gap is a reasonable follow-up.

### Empty case

When the party has no open orders, the export control is absent or disabled with a stated reason,
and the endpoint MUST NOT produce a file with headers and no rows (FR-024). A file a trader forwards
to a party showing nothing pending, when the real answer is "we could not tell you", is worse than
no file.

## Shared writer

The CSV, XLSX, and PDF writers move from `backend/src/api/reports.py` to
`backend/src/services/exports.py`, and both the organization reports and this endpoint call them
(R7).

**Why extraction is required rather than optional**: two copies of an export writer is precisely how
a party export and an organization report begin disagreeing about a number. The existing
`_build_pdf` (`reports.py:122`) is already a general `(title, org_name, fieldnames, rows) -> bytes`
function, so extraction is a move, not a rewrite.

The printable summary in FR-020 is satisfied by the `pdf` format of this same endpoint, not by a
browser print stylesheet (R8). This supersedes the spec's assumption on that point.

## Download behaviour (frontend)

The party screen MUST reuse the download path already in
`frontend/src/pages/reports/Reports.tsx`, including its `resp.ok` check **before** the download is
built.

That check exists because of a real bug, recorded in the comment at `Reports.tsx:47`: without it, a
403 or 500 response body went into `createObjectURL` and landed in the user's downloads as a file
named `report.csv` containing a JSON error. FR-023 forbids exactly that. Reimplementing the download
for the party screen would reintroduce the bug the comment warns about, so the path is shared, not
copied.

On failure the user is told the export did not download, and no file is saved.

Pressing the control twice while an export is in flight must not produce two downloads; the existing
`exporting` guard covers this and must be kept.
