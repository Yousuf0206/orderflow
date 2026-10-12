"""Turns raw reader output into a draft the user can check (spec 008 R3, R4).

Validation never trusts the model: anything it had to clean is downgraded to
`low` confidence. Matching runs only against the open lines of the purchase
order the scan was started from, so a quantity can never land on another
order's line (constitution XXXVIII, XXXIX). Units are compared, never
converted (XXIX).
"""
import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from rapidfuzz import fuzz

MAX_ROWS = 50
MAX_TEXT = 200
MAX_VEHICLE = 100
MATCH_SURE = 85
MATCH_MAYBE = 60

CONFIDENCES = ("high", "medium", "low")

# Spellings seen on notes for the same thing. Applied to both sides before
# scoring, so "OPC 53 Grade" and "Cement OPC-53" meet in the middle.
ABBREVIATIONS = {
    "ordinary portland cement": "opc",
    "portland pozzolana cement": "ppc",
    "thermo mechanically treated": "tmt",
    "millimetre": "mm",
    "millimeter": "mm",
    "kilogram": "kg",
    "kgs": "kg",
    "grade": "",
    "gr": "",
}

UNIT_ALIASES = {
    "bag": "bag", "bags": "bag", "bg": "bag",
    "mt": "t", "ton": "t", "tons": "t", "tonne": "t", "tonnes": "t", "t": "t",
    "kg": "kg", "kgs": "kg",
    "pc": "pc", "pcs": "pc", "piece": "pc", "pieces": "pc", "nos": "pc", "no": "pc",
    "cft": "cft", "cu ft": "cft",
    "m3": "m3", "cum": "m3",
}


@dataclass
class OpenLine:
    id: str
    material: str
    unit: str


def _conf(value: Any) -> str:
    return value if value in CONFIDENCES else "low"


def normalise(text: str) -> str:
    text = text.lower()
    text = re.sub(r"(\d)([a-z])", r"\1 \2", text)
    text = re.sub(r"([a-z])(\d)", r"\1 \2", text)
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    text = f" {re.sub(r'\s+', ' ', text).strip()} "
    for long, short in ABBREVIATIONS.items():
        text = text.replace(f" {long} ", f" {short} " if short else " ")
    return re.sub(r"\s+", " ", text).strip()


def _unit_key(unit: str | None) -> str | None:
    if not unit:
        return None
    key = re.sub(r"[^a-z0-9 ]", "", unit.lower()).strip()
    return UNIT_ALIASES.get(key, key)


def clean_qty(raw: Any, confidence: Any) -> dict[str, Any]:
    conf = _conf(confidence)
    if raw is None:
        return {"value": None, "confidence": "low"}
    original = str(raw).strip()
    text = original.replace(",", "")
    try:
        value = Decimal(text)
    except InvalidOperation:
        return {"value": None, "confidence": "low"}
    if not value.is_finite() or value <= 0 or value.as_tuple().exponent < -3:
        return {"value": None, "confidence": "low"}
    normalised = format(value.normalize(), "f")
    if normalised != original:
        conf = "low" if conf == "high" else conf
    return {"value": normalised, "confidence": conf}


def clean_date(raw: Any, confidence: Any, po_date: date, today: date) -> dict[str, Any]:
    try:
        value = date.fromisoformat(str(raw)) if raw else None
    except ValueError:
        value = None
    if value is None or value > today or value < po_date - timedelta(days=366):
        return {"value": None, "confidence": "low"}
    return {"value": value.isoformat(), "confidence": _conf(confidence)}


def clean_text(raw: Any, confidence: Any, limit: int) -> dict[str, Any]:
    if raw is None or not str(raw).strip():
        return {"value": None, "confidence": "low"}
    text = str(raw).strip()
    conf = _conf(confidence)
    if len(text) > limit:
        text, conf = text[:limit], "low"
    return {"value": text, "confidence": conf}


def match_rows(rows: list[dict[str, Any]], lines: list[OpenLine]) -> list[str | None]:
    """Greedy best-first assignment, one row per line. Returns a line id or None per row."""
    pairs = []
    for r, row in enumerate(rows):
        description = normalise(row["raw_text"])
        for line in lines:
            score = fuzz.token_set_ratio(description, normalise(line.material))
            if score >= MATCH_MAYBE:
                pairs.append((score, r, line.id))
    pairs.sort(key=lambda p: -p[0])

    assigned: list[str | None] = [None] * len(rows)
    scores: dict[int, float] = {}
    taken: set[str] = set()
    for score, r, line_id in pairs:
        if assigned[r] is None and line_id not in taken:
            assigned[r] = line_id
            scores[r] = score
            taken.add(line_id)
    for r, row in enumerate(rows):
        if assigned[r] is not None:
            row["match_confidence"] = "high" if scores[r] >= MATCH_SURE else "low"
    return assigned


def build_draft(raw: dict[str, Any], lines: list[OpenLine], po_date: date, today: date) -> dict[str, Any]:
    rows = []
    for item in (raw.get("lines") or [])[:MAX_ROWS]:
        if not isinstance(item, dict):
            continue
        text = clean_text(item.get("description"), "high", MAX_TEXT)["value"]
        if not text:
            continue
        qty = clean_qty(item.get("qty"), item.get("qty_confidence"))
        if item.get("handwritten") and qty["confidence"] == "high":
            qty["confidence"] = "medium"
        unit = clean_text(item.get("unit"), "high", 20)["value"]
        rows.append({"raw_text": text, "qty": qty, "unit": unit, "matched_line_id": None,
                     "match_confidence": None})

    warnings: list[str] = []
    by_id = {line.id: line for line in lines}
    for row, line_id in zip(rows, match_rows(rows, lines), strict=True):
        row["matched_line_id"] = line_id
        if line_id is None:
            continue
        read_unit, line_unit = _unit_key(row["unit"]), _unit_key(by_id[line_id].unit)
        if read_unit and read_unit != line_unit:
            row["qty"]["confidence"] = "low"
            if "unit_mismatch" not in warnings:
                warnings.append("unit_mismatch")

    if any(item.get("handwritten") for item in raw.get("lines") or [] if isinstance(item, dict)):
        warnings.append("handwritten")

    return {
        "document_date": clean_date(raw.get("document_date"), raw.get("document_date_confidence"),
                                    po_date, today),
        "vehicle_ref": clean_text(raw.get("vehicle_ref"), raw.get("vehicle_ref_confidence"), MAX_VEHICLE),
        "lines": rows,
        "warnings": warnings,
    }


def is_empty(draft: dict[str, Any]) -> bool:
    """No usable text at all: treated as unreadable, not as an empty draft."""
    return not draft["lines"] and draft["document_date"]["value"] is None and draft["vehicle_ref"]["value"] is None
