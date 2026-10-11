from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from src.core.tenant import TenantContext, get_tenant_context
from src.models.dispatch import Dispatch
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder, PurchaseOrderLine
from src.services import exports
from src.services.po_calc import compute_many, unit_key

router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_TITLES = {
    "remaining-by-party": "Remaining by Party",
    "remaining-lines": "Remaining by Line",
    "overdue-orders": "Overdue Orders",
    "dispatch-history": "Dispatch History",
}

# Declared rather than inferred from the first row. An empty report used to
# produce a file with no header at all -- "Overdue Orders" with nothing overdue
# downloaded as two bytes, which opens as a blank sheet and tells a trader
# nothing. Headers with no rows say "none, and here is what none means".
# Line-grained (constitution XXIX): one row per PO line, or per dispatch line
# for history, so a spreadsheet can filter by material and unit and nothing is
# ever summed across units. po_number and party repeat across rows.
_LINE_COLUMNS = [
    "po_number",
    "party_code",
    "party_name",
    "material",
    "unit",
    "ordered_qty",
    "dispatched_qty",
    "remaining_qty",
    "order_date",
    "due_date",
    "status",
]

REPORT_COLUMNS = {
    # Per party *per unit*: a party owed 10 tonne and 200 bag gets two rows,
    # never one row reading 210.
    "remaining-by-party": ["party_code", "party_name", "unit", "remaining_qty", "open_lines"],
    "remaining-lines": _LINE_COLUMNS,
    "overdue-orders": _LINE_COLUMNS + ["days_to_delivery"],
    "dispatch-history": [
        "dispatch_date",
        "po_number",
        "party_name",
        "material",
        "unit",
        "qty",
        "vehicle_ref",
        "remarks",
    ],
}


def _active_pos(tenant: TenantContext) -> list[PurchaseOrder]:
    return (
        tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder)
        .filter(PurchaseOrder.deleted_at.is_(None))
        .order_by(PurchaseOrder.due_date, PurchaseOrder.po_number)
        .all()
    )


def _parties(tenant: TenantContext) -> dict[str, Party]:
    return {p.id: p for p in tenant.scoped(tenant.db.query(Party), Party).all()}


def _line_rows(tenant: TenantContext, *, only_status: str | None = None) -> list[dict]:
    """One row per open line (remaining > 0) of matching orders."""
    pos = _active_pos(tenant)
    parties = _parties(tenant)
    calcs = compute_many(tenant.db, pos)
    rows = []
    for po in pos:
        calc = calcs[po.id]
        if only_status and calc.status != only_status:
            continue
        party = parties.get(po.party_id)
        for line in calc.lines:
            if line.remaining_qty <= 0:
                continue
            row = {
                "po_number": po.po_number,
                "party_code": party.party_code if party else "",
                "party_name": party.party_name if party else "",
                "material": line.material,
                "unit": line.unit,
                "ordered_qty": line.ordered_qty,
                "dispatched_qty": line.dispatched_qty,
                "remaining_qty": line.remaining_qty,
                "order_date": po.order_date.isoformat(),
                "due_date": po.due_date.isoformat(),
                "status": calc.status,
            }
            if only_status:
                row["days_to_delivery"] = calc.days_to_delivery
            rows.append(row)
    return rows


def _remaining_lines(tenant: TenantContext) -> list[dict]:
    return _line_rows(tenant)


def _overdue_orders(tenant: TenantContext) -> list[dict]:
    return _line_rows(tenant, only_status="overdue")


def _remaining_by_party(tenant: TenantContext) -> list[dict]:
    totals: dict[tuple[str, str], dict] = {}
    for row in _line_rows(tenant):
        key = (row["party_code"], unit_key(row["unit"]))
        entry = totals.setdefault(
            key,
            {
                "party_code": row["party_code"],
                "party_name": row["party_name"],
                "unit": unit_key(row["unit"]),
                "remaining_qty": 0.0,
                "open_lines": 0,
            },
        )
        entry["remaining_qty"] += row["remaining_qty"]
        entry["open_lines"] += 1
    return [totals[k] for k in sorted(totals)]


def _dispatch_history(tenant: TenantContext) -> list[dict]:
    pos = {po.id: po for po in tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder).all()}
    parties = _parties(tenant)
    lines = {
        line.id: line
        for line in tenant.scoped(tenant.db.query(PurchaseOrderLine), PurchaseOrderLine).all()
    }
    dispatches = (
        tenant.scoped(tenant.db.query(Dispatch), Dispatch)
        .filter(Dispatch.deleted_at.is_(None))
        .order_by(Dispatch.dispatch_date)
        .all()
    )
    rows = []
    for d in dispatches:
        po = pos.get(d.purchase_order_id)
        party = parties.get(po.party_id) if po else None
        for dl in sorted(d.lines, key=lambda dl: lines[dl.purchase_order_line_id].line_no):
            line = lines[dl.purchase_order_line_id]
            rows.append(
                {
                    "dispatch_date": d.dispatch_date.isoformat(),
                    "po_number": po.po_number if po else "?",
                    "party_name": party.party_name if party else "",
                    "material": line.material,
                    "unit": line.unit,
                    "qty": float(dl.qty),
                    "vehicle_ref": d.vehicle_ref or "",
                    "remarks": d.remarks or "",
                }
            )
    return rows

REPORTS = {
    "remaining-by-party": _remaining_by_party,
    "remaining-lines": _remaining_lines,
    "overdue-orders": _overdue_orders,
    "dispatch-history": _dispatch_history,
}


@router.get("/remaining-by-party")
def remaining_by_party(tenant: TenantContext = Depends(get_tenant_context)) -> list[dict]:
    return _remaining_by_party(tenant)


@router.get("/remaining-lines")
def remaining_lines(tenant: TenantContext = Depends(get_tenant_context)) -> list[dict]:
    return _remaining_lines(tenant)


@router.get("/overdue-orders")
def overdue_orders(tenant: TenantContext = Depends(get_tenant_context)) -> list[dict]:
    return _overdue_orders(tenant)


@router.get("/dispatch-history")
def dispatch_history(tenant: TenantContext = Depends(get_tenant_context)) -> list[dict]:
    return _dispatch_history(tenant)


@router.get("/{report}/export")
def export_report(
    report: str,
    format: str = "csv",
    tenant: TenantContext = Depends(get_tenant_context),
) -> StreamingResponse:
    if report not in REPORTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown report")
    if format not in exports.FORMATS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown format {format!r}")

    rows = REPORTS[report](tenant)
    fieldnames = REPORT_COLUMNS[report]
    org_name = tenant.organization.name

    # Writers live in services/exports.py so the party-level export produces
    # byte-identical files from the same code. Two copies of a CSV writer is
    # how a party export and an organization report start disagreeing.
    return exports.file_response(
        fmt=format,
        filename=exports.export_filename(org_name, report, ext=format),
        title=REPORT_TITLES.get(report, report),
        subtitle=org_name,
        fieldnames=fieldnames,
        rows=rows,
    )
