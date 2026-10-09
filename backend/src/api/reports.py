from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from src.core.tenant import TenantContext, get_tenant_context
from src.models.dispatch import Dispatch
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder
from src.services import exports
from src.services.po_calc import compute_many

router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_TITLES = {
    "remaining-by-party": "Remaining by Party",
    "overdue-orders": "Overdue Orders",
    "dispatch-history": "Dispatch History",
}

# Declared rather than inferred from the first row. An empty report used to
# produce a file with no header at all -- "Overdue Orders" with nothing overdue
# downloaded as two bytes, which opens as a blank sheet and tells a trader
# nothing. Headers with no rows say "none, and here is what none means".
REPORT_COLUMNS = {
    "remaining-by-party": ["party_code", "party_name", "remaining_balance"],
    "overdue-orders": [
        "po_number",
        "material",
        "due_date",
        "remaining_balance",
        "days_to_delivery",
    ],
    "dispatch-history": ["po_number", "dispatch_date", "qty", "vehicle_ref", "remarks"],
}


def _remaining_by_party(tenant: TenantContext) -> list[dict]:
    parties = tenant.scoped(tenant.db.query(Party), Party).filter(Party.deleted_at.is_(None)).all()
    pos = tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder).filter(
        PurchaseOrder.deleted_at.is_(None)
    ).all()
    calcs = compute_many(tenant.db, pos)
    totals: dict[str, float] = {}
    for po in pos:
        calc = calcs[po.id]
        if calc.remaining_balance > 0:
            totals[po.party_id] = totals.get(po.party_id, 0) + calc.remaining_balance
    return [
        {"party_code": p.party_code, "party_name": p.party_name, "remaining_balance": totals.get(p.id, 0)}
        for p in parties
        if totals.get(p.id, 0) > 0
    ]


def _overdue_orders(tenant: TenantContext) -> list[dict]:
    pos = tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder).filter(
        PurchaseOrder.deleted_at.is_(None)
    ).all()
    calcs = compute_many(tenant.db, pos)
    rows = []
    for po in pos:
        calc = calcs[po.id]
        if calc.status == "overdue":
            rows.append(
                {
                    "po_number": po.po_number,
                    "material": po.material,
                    "due_date": po.due_date.isoformat(),
                    "remaining_balance": calc.remaining_balance,
                    "days_to_delivery": calc.days_to_delivery,
                }
            )
    return rows


def _dispatch_history(tenant: TenantContext) -> list[dict]:
    pos = {
        po.id: po.po_number
        for po in tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder).all()
    }
    rows = (
        tenant.scoped(tenant.db.query(Dispatch), Dispatch)
        .filter(Dispatch.deleted_at.is_(None))
        .order_by(Dispatch.dispatch_date)
        .all()
    )
    return [
        {
            "po_number": pos.get(d.purchase_order_id, "?"),
            "dispatch_date": d.dispatch_date.isoformat(),
            "qty": float(d.qty),
            "vehicle_ref": d.vehicle_ref or "",
            "remarks": d.remarks or "",
        }
        for d in rows
    ]


REPORTS = {
    "remaining-by-party": _remaining_by_party,
    "overdue-orders": _overdue_orders,
    "dispatch-history": _dispatch_history,
}


@router.get("/remaining-by-party")
def remaining_by_party(tenant: TenantContext = Depends(get_tenant_context)) -> list[dict]:
    return _remaining_by_party(tenant)


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
