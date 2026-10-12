"""How well scanning is doing (spec 008 SC-001, SC-002 stretch; research R11).

Compares each confirmed scan's draft with the dispatch the user actually
saved. Returns counts and timings only -- never note text or quantities.
Only scans still holding their draft (under 30 days old) can be compared.
"""

from statistics import median

from sqlalchemy.orm import Session

from src.models.dispatch import Dispatch
from src.models.document_scan import DocumentScan


def _fields_edited(draft: dict, dispatch: Dispatch) -> tuple[int, int]:
    saved = {dl.purchase_order_line_id: float(dl.qty) for dl in dispatch.lines}
    drafted: dict[str, float] = {}
    for row in draft.get("lines", []):
        line_id, qty = row.get("matched_line_id"), (row.get("qty") or {}).get("value")
        if line_id and qty is not None:
            drafted[line_id] = float(qty)

    total = edited = 0
    for key, value in (("document_date", dispatch.dispatch_date.isoformat()), ("vehicle_ref", dispatch.vehicle_ref)):
        total += 1
        edited += (draft.get(key) or {}).get("value") != value
    for line_id in drafted.keys() | saved.keys():
        total += 1
        edited += drafted.get(line_id) != saved.get(line_id)
    return edited, total


def scan_metrics(db: Session) -> dict:
    scans = db.query(DocumentScan).all()
    by_status: dict[str, int] = {}
    for scan in scans:
        by_status[scan.status] = by_status.get(scan.status, 0) + 1

    confirm_seconds: list[float] = []
    edited = total = 0
    for scan in scans:
        if scan.status != "confirmed" or scan.dispatch_id is None:
            continue
        dispatch = db.get(Dispatch, scan.dispatch_id)
        if dispatch is None:
            continue
        confirm_seconds.append((dispatch.created_at - scan.created_at).total_seconds())
        if scan.draft_json:
            e, t = _fields_edited(scan.draft_json, dispatch)
            edited, total = edited + e, total + t

    read_ms = [s.read_ms for s in scans if s.read_ms is not None]
    return {
        "scans_by_status": by_status,
        "median_read_seconds": round(median(read_ms) / 1000, 1) if read_ms else None,
        "median_scan_to_confirm_seconds": round(median(confirm_seconds), 1) if confirm_seconds else None,
        "share_of_fields_edited": round(edited / total, 3) if total else None,
    }
