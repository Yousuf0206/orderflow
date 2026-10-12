"""Scan draft validation and matching (spec 008 R3, R4). No vendor, no database."""

from datetime import date

from src.services.scan_matching import OpenLine, build_draft, clean_date, clean_qty, is_empty, normalise

PO_DATE = date(2026, 9, 1)
TODAY = date(2026, 10, 13)
LINES = [
    OpenLine(id="steel", material="Steel bar 12mm", unit="tonne"),
    OpenLine(id="cement", material="Cement OPC-53", unit="bag"),
    OpenLine(id="sand", material="Sand", unit="truck"),
]


def _row(description, qty="10", unit=None, conf="high", handwritten=False):
    return {"description": description, "qty": qty, "qty_confidence": conf, "unit": unit,
            "handwritten": handwritten}


def _draft(*rows, **extra):
    raw = {"readable": True, "document_date": "2026-10-12", "document_date_confidence": "high",
           "vehicle_ref": "LES-1234", "vehicle_ref_confidence": "high", "lines": list(rows), **extra}
    return build_draft(raw, LINES, PO_DATE, TODAY)


def test_alias_and_reordered_words_match():
    draft = _draft(_row("OPC 53 Grade cement", unit="bags"), _row("12 mm steel bars", unit="MT"))
    assert [line["matched_line_id"] for line in draft["lines"]] == ["cement", "steel"]
    assert all(line["match_confidence"] == "high" for line in draft["lines"])
    assert draft["warnings"] == []


def test_item_not_on_order_is_unmatched_never_a_new_line():
    draft = _draft(_row("Paint white 20L"))
    assert draft["lines"][0]["matched_line_id"] is None
    assert draft["lines"][0]["match_confidence"] is None


def test_two_rows_cannot_take_one_line():
    draft = _draft(_row("Cement OPC 53"), _row("OPC cement"))
    ids = [line["matched_line_id"] for line in draft["lines"]]
    assert ids.count("cement") == 1


def test_unit_mismatch_marks_qty_low_and_warns():
    draft = _draft(_row("Cement OPC 53", unit="MT"))
    assert draft["lines"][0]["qty"]["confidence"] == "low"
    assert "unit_mismatch" in draft["warnings"]


def test_handwritten_is_never_high():
    draft = _draft(_row("Sand", handwritten=True))
    assert draft["lines"][0]["qty"]["confidence"] == "medium"
    assert "handwritten" in draft["warnings"]


def test_qty_validation():
    assert clean_qty("40", "high") == {"value": "40", "confidence": "high"}
    assert clean_qty("1,250.5", "high") == {"value": "1250.5", "confidence": "low"}
    assert clean_qty("12.3456", "high")["value"] is None
    assert clean_qty("-3", "high")["value"] is None
    assert clean_qty("0", "high")["value"] is None
    assert clean_qty("forty", "high")["value"] is None
    assert clean_qty(None, "high") == {"value": None, "confidence": "low"}
    assert clean_qty("5", "certain")["confidence"] == "low"


def test_date_validation():
    assert clean_date("2026-10-12", "high", PO_DATE, TODAY)["value"] == "2026-10-12"
    assert clean_date("2026-10-14", "high", PO_DATE, TODAY)["value"] is None  # future
    assert clean_date("2024-01-01", "high", PO_DATE, TODAY)["value"] is None  # > 1 year before PO
    assert clean_date("12/10/2026", "high", PO_DATE, TODAY)["value"] is None


def test_long_text_is_cut_and_marked_low():
    draft = _draft(vehicle_ref="X" * 150)
    assert len(draft["vehicle_ref"]["value"]) == 100
    assert draft["vehicle_ref"]["confidence"] == "low"


def test_rows_capped_at_fifty():
    draft = _draft(*[_row(f"Item {i}") for i in range(80)])
    assert len(draft["lines"]) == 50


def test_nothing_read_is_empty():
    raw = {"readable": True, "document_date": None, "vehicle_ref": None, "lines": []}
    assert is_empty(build_draft(raw, LINES, PO_DATE, TODAY))


def test_normalise():
    assert normalise("Cement OPC-53") == "cement opc 53"
    assert normalise("OPC 53 Grade") == "opc 53"
    assert normalise("12mm TMT") == "12 mm tmt"
