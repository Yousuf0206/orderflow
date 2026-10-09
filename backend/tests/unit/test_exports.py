"""The shared export writers.

These moved out of api/reports.py when the party-level export was added, so
both produce byte-identical files from one implementation. Two copies of a CSV
writer is how a party export and an organization report start disagreeing about
a number, and a trader who notices that goes back to a spreadsheet.

The assertions here are about the writers' contract -- column order, escaping,
empty input -- not about any particular report's content.
"""

import csv
import io

import pytest

from src.services import exports

FIELDS = ["party_name", "po_number", "remaining_balance"]
ROWS = [
    {"party_name": "Northgate Steel", "po_number": "PO-2001", "remaining_balance": 600.0},
    # Deliberately awkward: a comma, a quote, and a newline all need escaping
    # for the file to open as a table rather than as mangled text.
    {"party_name": 'Civic "Cement", Ltd', "po_number": "PO-3001\nsecond", "remaining_balance": 0.5},
]


def test_csv_keeps_the_given_column_order():
    text = exports.build_csv(fieldnames=FIELDS, rows=ROWS).decode("utf-8")
    assert text.splitlines()[0] == "party_name,po_number,remaining_balance"


def test_csv_escapes_separators_quotes_and_newlines():
    text = exports.build_csv(fieldnames=FIELDS, rows=ROWS).decode("utf-8")
    parsed = list(csv.DictReader(io.StringIO(text)))
    assert len(parsed) == 2
    assert parsed[1]["party_name"] == 'Civic "Cement", Ltd'
    assert parsed[1]["po_number"] == "PO-3001\nsecond"


def test_csv_with_no_rows_is_a_header_only_file():
    text = exports.build_csv(fieldnames=FIELDS, rows=[]).decode("utf-8")
    assert text.strip() == "party_name,po_number,remaining_balance"


def test_xlsx_is_a_real_workbook():
    payload = exports.build_xlsx(fieldnames=FIELDS, rows=ROWS)
    # xlsx is a zip; "PK" is the zip magic. A file Excel refuses to open is not
    # an export.
    assert payload.startswith(b"PK")


def test_pdf_is_a_real_pdf():
    payload = exports.build_pdf(
        title="Remaining Balances", subtitle="Northgate Steel", fieldnames=FIELDS, rows=ROWS
    )
    assert payload.startswith(b"%PDF")


def test_pdf_with_no_rows_says_so_rather_than_rendering_an_empty_table():
    payload = exports.build_pdf(
        title="Remaining Balances", subtitle="Nobody", fieldnames=FIELDS, rows=[]
    )
    assert payload.startswith(b"%PDF")


@pytest.mark.parametrize("fmt", exports.FORMATS)
def test_file_response_sets_a_download_filename_for_every_format(fmt):
    resp = exports.file_response(
        fmt=fmt,
        filename=f"northgate-remaining-2026-10-09.{fmt}",
        title="Remaining Balances",
        subtitle="Northgate Steel",
        fieldnames=FIELDS,
        rows=ROWS,
    )
    disposition = resp.headers["content-disposition"]
    assert disposition.startswith("attachment; filename=")
    assert disposition.endswith(f".{fmt}")


def test_export_filename_slugifies_and_dates():
    name = exports.export_filename('Civic "Cement", Ltd', "remaining", ext="csv")
    assert name.startswith("civic-cement-ltd-remaining-")
    assert name.endswith(".csv")
    # A party name that slugifies to nothing must still produce a usable name.
    assert exports.export_filename("!!!", "remaining", ext="csv").startswith("org-remaining-")
