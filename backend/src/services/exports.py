"""Row-set to file writers, shared by every export in the product.

Extracted from `api/reports.py` when the party-level remaining export was
added. It is deliberately shared rather than copied: two implementations of a
CSV writer is how a party export and an organization report begin disagreeing
about a number, and a trader who spots that disagreement goes back to a
spreadsheet -- which is the whole thing the product is trying to replace.

Writers take a column order and a list of row dicts. They do not know where
the rows came from, and they never compute a figure.
"""

import csv
import io
import re
from datetime import UTC, datetime

from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FORMATS = ("csv", "xlsx", "pdf")

_MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "org"


def export_filename(*parts: str, ext: str) -> str:
    """`<slug>-<slug>-<date>.<ext>`, e.g. `acme-steel-remaining-2026-10-09.csv`."""
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    return "-".join([slugify(p) for p in parts if p] + [date]) + f".{ext}"


def build_csv(*, fieldnames: list[str], rows: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def build_xlsx(*, fieldnames: list[str], rows: list[dict]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(fieldnames)
    for row in rows:
        ws.append([row.get(f, "") for f in fieldnames])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_pdf(*, title: str, subtitle: str, fieldnames: list[str], rows: list[dict]) -> bytes:
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
            f"{subtitle} &middot; Generated {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}",
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


def file_response(
    *,
    fmt: str,
    filename: str,
    title: str,
    subtitle: str,
    fieldnames: list[str],
    rows: list[dict],
) -> StreamingResponse:
    """One download, in the requested format.

    `fmt` is assumed already validated by the caller -- an unrecognised format
    is a 400 at the endpoint, not a silent fallback to CSV here. A trader who
    asked for a PDF and received a CSV has been handed the wrong thing without
    being told.
    """
    if fmt == "pdf":
        payload = build_pdf(title=title, subtitle=subtitle, fieldnames=fieldnames, rows=rows)
    elif fmt == "xlsx":
        payload = build_xlsx(fieldnames=fieldnames, rows=rows)
    else:
        payload = build_csv(fieldnames=fieldnames, rows=rows)

    return StreamingResponse(
        iter([payload]),
        media_type=_MEDIA_TYPES[fmt],
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
