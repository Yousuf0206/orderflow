from datetime import date, timedelta

from src.services import po_calc


class FakePO:
    def __init__(self, ordered_qty, due_date, id="po1"):
        self.id = id
        self.ordered_qty = ordered_qty
        self.due_date = due_date


class FakeQuery:
    def __init__(self, total):
        self._total = total

    def filter(self, *args, **kwargs):
        return self

    def scalar(self):
        return self._total


class FakeDB:
    def __init__(self, total_dispatched):
        self._total = total_dispatched

    def query(self, *args, **kwargs):
        return FakeQuery(self._total)


def test_remaining_balance_is_never_cached_always_derived():
    po = FakePO(ordered_qty=100, due_date=date.today() + timedelta(days=30))
    db = FakeDB(total_dispatched=40)
    result = po_calc.compute(db, po)
    assert result.total_dispatched == 40
    assert result.remaining_balance == 60
    assert result.status == "on_track"


def test_status_fully_dispatched_when_balance_zero():
    po = FakePO(ordered_qty=100, due_date=date.today() + timedelta(days=30))
    db = FakeDB(total_dispatched=100)
    result = po_calc.compute(db, po)
    assert result.remaining_balance == 0
    assert result.status == "fully_dispatched"


def test_status_overdue_when_past_due_with_balance():
    po = FakePO(ordered_qty=100, due_date=date.today() - timedelta(days=1))
    db = FakeDB(total_dispatched=10)
    result = po_calc.compute(db, po)
    assert result.status == "overdue"


def test_status_due_soon_within_window():
    po = FakePO(ordered_qty=100, due_date=date.today() + timedelta(days=1))
    db = FakeDB(total_dispatched=10)
    result = po_calc.compute(db, po)
    assert result.status == "due_soon"
