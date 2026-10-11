"""The pure rules behind remaining and status, with no database involved.

Since 006 these take per-line remainings: a PO is fully dispatched only when
every line is, and its due date sets severity while any line is open
(constitution XXIX).
"""

from datetime import date, timedelta

from src.services import po_calc
from src.services.po_calc import LineCalc

TODAY = date(2026, 10, 12)


def _line(remaining, unit="ton", ordered=100):
    return LineCalc(
        id="l",
        line_no=1,
        material="m",
        unit=unit,
        ordered_qty=ordered,
        dispatched_qty=ordered - remaining,
        remaining_qty=remaining,
    )


def test_remaining_is_ordered_minus_dispatched():
    assert po_calc.line_remaining(100, 40) == 60
    assert po_calc.line_remaining(100, 150) == -50


def test_fully_dispatched_only_when_every_line_is():
    future = TODAY + timedelta(days=30)
    assert po_calc.po_status([0, 0], future, TODAY) == "fully_dispatched"
    assert po_calc.po_status([0, -5], future, TODAY) == "fully_dispatched"
    assert po_calc.po_status([0, 10], future, TODAY) == "on_track"


def test_overdue_when_any_line_open_and_past_due():
    assert po_calc.po_status([0, 10], TODAY - timedelta(days=1), TODAY) == "overdue"


def test_past_due_but_complete_is_not_overdue():
    assert po_calc.po_status([0, 0], TODAY - timedelta(days=1), TODAY) == "fully_dispatched"


def test_due_soon_within_window_and_due_today_is_not_overdue():
    assert po_calc.po_status([10], TODAY + timedelta(days=1), TODAY) == "due_soon"
    assert po_calc.po_status([10], TODAY, TODAY) == "due_soon"


def test_remaining_by_unit_never_adds_across_units():
    lines = [_line(30, "ton"), _line(100, "bag"), _line(20, "Ton "), _line(0, "truck")]
    assert po_calc.remaining_by_unit(lines) == [
        {"unit": "bag", "remaining": 100},
        {"unit": "ton", "remaining": 50},
    ]


def test_remaining_by_unit_ignores_over_dispatched_lines():
    # An over-dispatched line must not subtract from another line's open qty.
    assert po_calc.remaining_by_unit([_line(-50, "ton"), _line(30, "ton")]) == [
        {"unit": "ton", "remaining": 30}
    ]
