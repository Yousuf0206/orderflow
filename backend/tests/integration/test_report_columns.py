"""An empty report still has to say what it is.

"Overdue Orders" with nothing overdue used to export as two bytes -- a bare
newline, no header -- because the columns were inferred from the first row.
That opens as a blank sheet and tells a trader nothing; it is the file version
of a screen that neither loads nor says why (Principle XII).

Found while validating real downloads against a live database, not by the
other tests, because every fixture they use happens to produce rows.
"""

import csv
import io

from src.api.reports import REPORT_COLUMNS, REPORTS
from tests.conftest import auth_headers, signup


def _columns(client, headers, report):
    resp = client.get(f"/reports/{report}/export?format=csv", headers=headers)
    assert resp.status_code == 200, resp.text
    text = resp.content.decode("utf-8")
    return text, next(csv.reader(io.StringIO(text)))


def test_every_report_declares_its_columns():
    # A report added without a column list would otherwise fall back to the
    # old inferred behaviour at runtime, on whichever organization first has
    # no rows for it.
    assert set(REPORT_COLUMNS) == set(REPORTS)


def test_empty_reports_still_carry_a_header_row(client):
    # A brand-new organization has no orders at all, so every report is empty.
    headers = auth_headers(signup(client, email="rc1@test.com", org_name="Report Columns Org"))

    for report, expected in REPORT_COLUMNS.items():
        text, header = _columns(client, headers, report)
        assert header == expected, f"{report}: {header}"
        assert len(text) > 2, f"{report} exported {len(text)} bytes"


def test_populated_reports_use_the_same_declared_columns(client):
    headers = auth_headers(signup(client, email="rc2@test.com", org_name="Report Columns Org 2"))
    party = client.post(
        "/parties", json={"party_code": "P-1", "party_name": "Party"}, headers=headers
    ).json()["id"]
    po = client.post(
        "/purchase-orders",
        json={
            "party_id": party,
            "po_number": "PO-1",
            "material": "Steel",
            "ordered_qty": 100,
            "unit": "ton",
            "order_date": "2026-01-01",
            "due_date": "2027-01-01",
        },
        headers=headers,
    ).json()["id"]
    client.post(
        f"/purchase-orders/{po}/dispatches",
        json={"dispatch_date": "2026-06-01", "qty": 10, "confirm": True},
        headers=headers,
    )

    for report, expected in REPORT_COLUMNS.items():
        _, header = _columns(client, headers, report)
        assert header == expected, f"{report}: {header}"


def test_xlsx_and_pdf_of_an_empty_report_are_still_well_formed(client):
    headers = auth_headers(signup(client, email="rc3@test.com", org_name="Report Columns Org 3"))

    xlsx = client.get("/reports/overdue-orders/export?format=xlsx", headers=headers)
    assert xlsx.content[:2] == b"PK"

    pdf = client.get("/reports/overdue-orders/export?format=pdf", headers=headers)
    assert pdf.content[:5] == b"%PDF-"
