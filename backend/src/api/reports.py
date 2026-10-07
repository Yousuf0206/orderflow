import csv
import io
import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from src.core.tenant import TenantContext, get_tenant_context
from src.models.dispatch import Dispatch
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder
from src.services.po_calc import compute

router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_TITLES = {
    "remaining-by-party": "Remaining by Party",
    "overdue-orders": "Overdue Orders",
    "dispatch-history": "Dispatch History",
}


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "org"


def _export_filename(org_name: str, report: str, ext: str) -> str:
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    return f"{_slugify(org_name)}-{report}-{date}.{ext}"


def _remaining_by_party(tenant: TenantContext) -> list[dict]:
    parties = tenant.scoped(tenant.db.query(Party), Party).filter(Party.deleted_at.is_(None)).all()
    pos = tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder).filter(
        PurchaseOrder.deleted_at.is_(None)
    ).all()
    totals: dict[str, float] = {}
    for po in pos:
        calc = compute(tenant.db, po)
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
    rows = []
    for po in pos:
        calc = compute(tenant.db, po)
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


def _build_pdf(*, title: str, org_name: str, fieldnames: list[str], rows: list[dict]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title=title,
    )
    styles = getSampleStyleSheet()
    elements = [
        Paragraph(title, styles["Title"]),
        Paragraph(
            f"{org_name} &middot; Generated {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}",
            styles["Normal"],
        ),
        Spacer(1, 0.5 * cm),
    ]

    header_labels = [f.replace("_", " ").title() for f in fieldnames]
    table_data = [header_labels] + [[str(row.get(f, "")) for f in fieldnames] for row in rows]

    if rows:
        table = Table(table_data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(table)
    else:
        elements.append(Paragraph("No data for this report.", styles["Normal"]))

    doc.build(elements)
    return buf.getvalue()


@router.get("/{report}/export")
def export_report(
    report: str,
    format: str = "csv",
    tenant: TenantContext = Depends(get_tenant_context),
) -> StreamingResponse:
    if report not in REPORTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown report")
    rows = REPORTS[report](tenant)
    fieldnames = list(rows[0].keys()) if rows else []
    org_name = tenant.organization.name

    if format == "pdf":
        pdf_bytes = _build_pdf(
            title=REPORT_TITLES.get(report, report),
            org_name=org_name,
            fieldnames=fieldnames,
            rows=rows,
        )
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={_export_filename(org_name, report, 'pdf')}"},
        )

    if format == "xlsx":
        wb = Workbook()
        ws = wb.active
        ws.append(fieldnames)
        for row in rows:
            ws.append([row.get(f, "") for f in fieldnames])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={_export_filename(org_name, report, 'xlsx')}"},
        )

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={_export_filename(org_name, report, 'csv')}"},
    )
