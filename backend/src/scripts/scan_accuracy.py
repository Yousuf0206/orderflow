"""Measures delivery-note reading against real notes (spec 008 SC-002, task T040).

Usage, from backend/ with a staging ANTHROPIC_API_KEY (never production's):

    python -m src.scripts.scan_accuracy path/to/notes

Each note is an image (`name.jpg` / `name.png`) beside `name.json`:

    {
      "po_lines": [{"id": "a", "material": "Cement OPC-53", "unit": "bag"}, ...],
      "expected": [{"line_id": "a", "qty": "40"}, ...]
    }

`po_lines` are the open lines of the order the note was delivered against;
`expected` is what a person read off the note. The notes are real customer
paper: keep the folder outside the repository. The script reads no database.

Reports, before any correction: the share of expected lines matched to the
right order line, and the share whose quantity was also read exactly.
Target: both >= 80% on >= 20 printed notes.
"""

import json
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

from src.services.scan_matching import OpenLine, build_draft
from src.services.scan_reader import AnthropicReader, ReaderError

TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


def score_note(draft: dict, expected: list[dict]) -> tuple[int, int]:
    read = {row["matched_line_id"]: row["qty"]["value"] for row in draft["lines"] if row["matched_line_id"]}
    matched = qty_right = 0
    for item in expected:
        if item["line_id"] in read:
            matched += 1
            value = read[item["line_id"]]
            qty_right += value is not None and Decimal(value) == Decimal(str(item["qty"]))
    return matched, qty_right


def main(folder: Path) -> int:
    reader = AnthropicReader()
    notes = sorted(p for p in folder.iterdir() if p.suffix.lower() in TYPES)
    total = matched = qty_right = failed = 0
    for image in notes:
        spec_path = image.with_suffix(".json")
        if not spec_path.exists():
            print(f"skip {image.name}: no {spec_path.name}")
            continue
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        lines = [OpenLine(**line) for line in spec["po_lines"]]
        total += len(spec["expected"])
        try:
            raw = reader.read(image.read_bytes(), TYPES[image.suffix.lower()])
        except ReaderError as exc:
            failed += 1
            print(f"{image.name}: {exc.kind}")
            continue
        draft = build_draft(raw, lines, date(1900, 1, 1), date.today())
        m, q = score_note(draft, spec["expected"])
        matched, qty_right = matched + m, qty_right + q
        print(f"{image.name}: matched {m}/{len(spec['expected'])}, qty right {q}")

    if total == 0:
        print("no notes with expected values found")
        return 1
    print(
        f"\n{len(notes)} notes, {failed} unreadable/failed. "
        f"Lines matched: {matched}/{total} ({matched / total:.0%}). "
        f"Matched with exact qty: {qty_right}/{total} ({qty_right / total:.0%})."
    )
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(Path(sys.argv[1])))
