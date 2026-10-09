"""Party remaining export: columns, row selection, scoping, audit, failures.

Covers spec FR-019 to FR-025 and contracts/party-export.md.
"""

import csv
import io
from datetime import date, timedelta

from tests.conftest import auth_headers, signup

TODAY = date.today()

EXPECTED_COLUMNS = [
    "party_name",
    "po_number",
    "material",
    "ordered_qty",
    "dispatched_qty",
    "remaining_balance",
    "due_date",
]


def _seed(client, email, org):
    headers = auth_headers(signup(client, email=email, org_name=org))
    party = client.post(
        "/parties", json={"party_code": "P-101", "party_name": "Northgate Steel"}, headers=headers
    ).json()["id"]
    empty_party = client.post(
        "/parties", json={"party_code": "P-999", "party_name": "No Orders Co"}, headers=headers
    ).json()["id"]

    def po(number, ordered, due_offset):
        return client.post(
            "/purchase-orders",
            json={
                "party_id": party,
                "po_number": number,
                "material": "TMT Steel Bars 12mm",
                "ordered_qty": ordered,
                "unit": "ton",
                "order_date": (TODAY - timedelta(days=30)).isoformat(),
                "due_date": (TODAY + timedelta(days=due_offset)).isoformat(),
            },
            headers=headers,
        ).json()["id"]

    open_po = po("PO-2001", 1000, 12)
    closed_po = po("PO-2002", 200, 20)

    for target, qty in ((open_po, 250), (open_po, 150), (closed_po, 200)):
        resp = client.post(
            f"/purchase-orders/{target}/dispatches",
            json={"dispatch_date": TODAY.isoformat(), "qty": qty, "confirm": True},
            headers=headers,
        )
        assert resp.status_code in (200, 201), resp.text

    return headers, party, empty_party


def _rows(resp):
    text = resp.content.decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def test_csv_has_the_exact_columns_in_the_exact_order(client):
    headers, party, _ = _seed(client, "x1@test.com", "Export Org 1")
    resp = client.get(f"/parties/{party}/remaining/export", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/csv")

    first_line = resp.content.decode("utf-8").splitlines()[0]
    assert first_line.strip().split(",") == EXPECTED_COLUMNS


def test_only_open_orders_are_exported(client):
    """A fully dispatched order is not pending, so it is not in a pending
    balances file."""
    headers, party, _ = _seed(client, "x2@test.com", "Export Org 2")
    rows = _rows(client.get(f"/parties/{party}/remaining/export", headers=headers))
    assert [r["po_number"] for r in rows] == ["PO-2001"]


def test_figures_are_derived_and_match_the_screen(client):
    headers, party, _ = _seed(client, "x3@test.com", "Export Org 3")
    rows = _rows(client.get(f"/parties/{party}/remaining/export", headers=headers))
    row = rows[0]
    assert float(row["ordered_qty"]) == 1000
    assert float(row["dispatched_qty"]) == 400
    assert float(row["remaining_balance"]) == 600

    screen = client.get(f"/parties/{party}", headers=headers).json()
    on_screen = {o["po_number"]: o["remaining_balance"] for o in screen["open_orders"]}
    assert on_screen["PO-2001"] == float(row["remaining_balance"])


def test_xlsx_and_pdf_formats_download(client):
    headers, party, _ = _seed(client, "x4@test.com", "Export Org 4")
    xlsx = client.get(f"/parties/{party}/remaining/export?format=xlsx", headers=headers)
    assert xlsx.status_code == 200
    assert "spreadsheetml" in xlsx.headers["content-type"]

    pdf = client.get(f"/parties/{party}/remaining/export?format=pdf", headers=headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")


def test_unknown_format_is_rejected_not_silently_csv(client):
    """A trader who asked for a PDF and received a CSV has been handed the
    wrong thing without being told."""
    headers, party, _ = _seed(client, "x5@test.com", "Export Org 5")
    resp = client.get(f"/parties/{party}/remaining/export?format=docx", headers=headers)
    assert resp.status_code == 400


def test_party_with_no_open_orders_produces_no_file(client):
    """A file showing nothing pending, when the real answer is "we could not
    tell you", is worse than no file."""
    headers, _, empty_party = _seed(client, "x6@test.com", "Export Org 6")
    resp = client.get(f"/parties/{empty_party}/remaining/export", headers=headers)
    assert resp.status_code == 404


def test_another_organizations_party_is_404_not_403(client):
    """That a party exists elsewhere is not information this organization is
    entitled to (Principle I)."""
    _, party_a, _ = _seed(client, "x7a@test.com", "Export Org 7a")
    headers_b, _, _ = _seed(client, "x7b@test.com", "Export Org 7b")

    resp = client.get(f"/parties/{party_a}/remaining/export", headers=headers_b)
    assert resp.status_code == 404


def test_export_is_audited(client):
    headers, party, _ = _seed(client, "x8@test.com", "Export Org 8")
    client.get(f"/parties/{party}/remaining/export", headers=headers)

    entries = client.get("/audit-log", headers=headers).json()
    rows = entries["items"] if isinstance(entries, dict) else entries
    exports = [e for e in rows if e["action"] == "export"]
    assert len(exports) == 1
    assert exports[0]["entity_type"] == "party"
    assert exports[0]["entity_id"] == party


def test_organization_reports_still_export_after_the_writer_extraction(client):
    """Regression guard for moving the CSV/XLSX/PDF writers into
    services/exports.py. All three formats are genuinely implemented, so there
    is no non-working format to hide."""
    headers, _, _ = _seed(client, "x9@test.com", "Export Org 9")
    for fmt, marker in (("csv", b"party_name"), ("xlsx", b"PK"), ("pdf", b"%PDF")):
        resp = client.get(f"/reports/remaining-by-party/export?format={fmt}", headers=headers)
        assert resp.status_code == 200, f"{fmt}: {resp.text[:200]}"
        assert resp.content.startswith(marker) or marker in resp.content[:2048]

    bad = client.get("/reports/remaining-by-party/export?format=docx", headers=headers)
    assert bad.status_code == 400
