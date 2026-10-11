"""`compute_many` must agree with `compute` for every order, always.

This runs against a real (SQLite) session rather than a fake, because the thing
under test is a change of query shape: one grouped aggregate in place of one
query per row. A fake that returns whatever the implementation asks for would
pass whether or not the SQL were right.

Why it is asserted directly instead of inferred from endpoint tests: this
function now stands in front of the remaining balance, which Constitution
Principle II calls sacred. A divergence here is not a slow page, it is a wrong
number on a trader's screen and in a file they forward to a customer.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.core.db import Base
from src.models.dispatch import Dispatch, DispatchLine
from src.models.organization import Organization
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder, PurchaseOrderLine
from src.services import po_calc


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def orders(db):
    """Six orders covering every branch of the status rules.

    Includes the two cases most likely to break under batching: an order with
    no dispatch rows at all (absent from a grouped result, so the caller must
    read it as zero) and an order whose only dispatches are soft-deleted (the
    group exists in the table but must be excluded).
    """
    today = date.today()
    org = Organization(name="Batch Org", currency="USD", timezone="UTC", plan_tier="trial")
    db.add(org)
    db.flush()
    party = Party(organization_id=org.id, party_code="P-1", party_name="Batch Party")
    db.add(party)
    db.flush()

    def po(number, ordered, due_offset):
        row = PurchaseOrder(
            organization_id=org.id,
            party_id=party.id,
            po_number=number,
            lines=[
                PurchaseOrderLine(
                    organization_id=org.id, line_no=1, material="Steel", ordered_qty=ordered, unit="ton"
                )
            ],
            order_date=today - timedelta(days=30),
            due_date=today + timedelta(days=due_offset),
        )
        db.add(row)
        return row

    no_dispatches = po("PO-NONE", 100, 30)
    partial = po("PO-PARTIAL", 100, 30)
    exactly_full = po("PO-FULL", 100, 30)
    over = po("PO-OVER", 100, 30)
    overdue = po("PO-OVERDUE", 100, -1)
    due_today = po("PO-TODAY", 100, 0)
    soft_deleted_only = po("PO-SOFTDEL", 100, 30)
    # Two lines in different units: steel fully sent, cement still open.
    multi = PurchaseOrder(
        organization_id=org.id,
        party_id=party.id,
        po_number="PO-MULTI",
        lines=[
            PurchaseOrderLine(organization_id=org.id, line_no=1, material="Steel", ordered_qty=50, unit="ton"),
            PurchaseOrderLine(organization_id=org.id, line_no=2, material="Cement", ordered_qty=200, unit="bag"),
        ],
        order_date=today - timedelta(days=30),
        due_date=today + timedelta(days=30),
    )
    db.add(multi)
    db.flush()

    def dispatch(target, qty, deleted=False, line_index=0):
        line = target.lines[line_index]
        row = Dispatch(
            organization_id=org.id,
            purchase_order_id=target.id,
            dispatch_date=today - timedelta(days=1),
            lines=[
                DispatchLine(
                    organization_id=org.id,
                    purchase_order_id=target.id,
                    purchase_order_line_id=line.id,
                    qty=qty,
                )
            ],
        )
        if deleted:
            row.soft_delete()
        db.add(row)

    dispatch(partial, 40)
    dispatch(partial, 10)
    dispatch(exactly_full, 100)
    dispatch(over, 150)
    dispatch(overdue, 10)
    dispatch(due_today, 10)
    dispatch(soft_deleted_only, 60, deleted=True)
    dispatch(multi, 50, line_index=0)
    dispatch(multi, 80, line_index=1)
    db.commit()

    return [
        no_dispatches,
        partial,
        exactly_full,
        over,
        overdue,
        due_today,
        soft_deleted_only,
        multi,
    ]


def test_compute_many_matches_compute_for_every_order(db, orders):
    batched = po_calc.compute_many(db, orders)
    for po in orders:
        single = po_calc.compute(db, po)
        assert batched[po.id] == single, f"divergence on {po.po_number}"


def test_order_with_no_dispatches_reads_as_zero(db, orders):
    po = next(p for p in orders if p.po_number == "PO-NONE")
    calc = po_calc.compute_many(db, orders)[po.id]
    assert calc.lines[0].dispatched_qty == 0
    assert calc.lines[0].remaining_qty == 100


def test_soft_deleted_dispatches_are_excluded(db, orders):
    po = next(p for p in orders if p.po_number == "PO-SOFTDEL")
    calc = po_calc.compute_many(db, orders)[po.id]
    assert calc.lines[0].dispatched_qty == 0
    assert calc.lines[0].remaining_qty == 100


def test_statuses_cover_every_branch(db, orders):
    by_number = {p.po_number: p for p in orders}
    calcs = po_calc.compute_many(db, orders)
    assert calcs[by_number["PO-PARTIAL"].id].status == "on_track"
    assert calcs[by_number["PO-FULL"].id].status == "fully_dispatched"
    assert calcs[by_number["PO-OVERDUE"].id].status == "overdue"
    # Due today is not yet overdue -- the boundary the rules put at `<` today.
    assert calcs[by_number["PO-TODAY"].id].status == "due_soon"


def test_over_dispatched_is_fully_dispatched_not_negative_status(db, orders):
    po = next(p for p in orders if p.po_number == "PO-OVER")
    calc = po_calc.compute_many(db, orders)[po.id]
    assert calc.lines[0].remaining_qty == -50
    assert calc.status == "fully_dispatched"


def test_multi_line_order_is_open_while_any_line_is(db, orders):
    po = next(p for p in orders if p.po_number == "PO-MULTI")
    calc = po_calc.compute_many(db, orders)[po.id]
    assert [(l.material, l.remaining_qty) for l in calc.lines] == [("Steel", 0), ("Cement", 120)]
    assert calc.status == "on_track"
    assert calc.remaining_by_unit == [{"unit": "bag", "remaining": 120}]
    assert calc.item_count == 2
    assert calc.material_summary == "Steel +1 more"


def test_empty_input_is_an_empty_result(db):
    assert po_calc.compute_many(db, []) == {}


def test_batch_issues_one_aggregate_regardless_of_order_count(db, orders):
    """The whole reason this function exists.

    The previous implementation issued one `SELECT sum(qty)` per purchase
    order. At 180 orders against the hosted database that is ~54s, past the
    client's 12s deadline. Counting statements rather than timing them keeps
    the assertion meaningful on a fast local database.
    """
    from sqlalchemy import event

    # Counts only the dispatch aggregate. Attribute access on an order can also
    # emit a reload if the fixture's commit expired it, which is an artefact of
    # the test rather than of this function -- in the endpoints the orders come
    # from a query in the same transaction and are already loaded.
    aggregates: list[str] = []

    def record(conn, cursor, statement, params, context, executemany):
        if "sum(" in statement.lower() and "dispatch_lines" in statement.lower():
            aggregates.append(statement)

    engine = db.get_bind()
    event.listen(engine, "before_cursor_execute", record)
    try:
        po_calc.compute_many(db, orders)
        many = len(aggregates)
        aggregates.clear()
        po_calc.compute_many(db, orders[:2])
        few = len(aggregates)
    finally:
        event.remove(engine, "before_cursor_execute", record)

    assert many == few == 1, f"{many} aggregates for 8 orders, {few} for 2"
