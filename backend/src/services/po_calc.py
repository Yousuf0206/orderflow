from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.core.config import settings
from src.models.dispatch import Dispatch
from src.models.purchase_order import PurchaseOrder

Status = str  # "fully_dispatched" | "overdue" | "due_soon" | "on_track"

# The only list of status values. `_derive` below produces exactly these, and
# callers validating a status filter compare against this rather than keeping
# their own copy.
VALID_STATUSES: tuple[Status, ...] = ("fully_dispatched", "overdue", "due_soon", "on_track")


@dataclass
class PoCalc:
    total_dispatched: float
    remaining_balance: float
    days_to_delivery: int
    status: Status


def total_dispatched_many(db: Session, po_ids: Sequence[str]) -> dict[str, float]:
    """Dispatched totals for many purchase orders in one query.

    Constitution Principle II: still computed live from non-deleted Dispatches.
    The only thing batching changes is how many round trips it takes to ask.

    Why this exists: the per-order version below is one query per purchase
    order, and the list and dashboard endpoints called it in a loop. At 180
    orders against the hosted database (~300ms per round trip) that is roughly
    54 seconds, well past the client's 12s request deadline. Orders missing
    from the result have no dispatches; callers read them as 0.
    """
    if not po_ids:
        return {}
    rows = (
        db.query(Dispatch.purchase_order_id, func.coalesce(func.sum(Dispatch.qty), 0))
        .filter(Dispatch.purchase_order_id.in_(po_ids), Dispatch.deleted_at.is_(None))
        .group_by(Dispatch.purchase_order_id)
        .all()
    )
    return {po_id: float(total or 0) for po_id, total in rows}


def total_dispatched(db: Session, po_id: str) -> float:
    """Constitution Principle II: Remaining Balance is Sacred.

    Always computed live from non-deleted Dispatches — never read from (or
    written to) a cached column on PurchaseOrder.

    Expressed via the batched query so there is one aggregate definition
    rather than two that could drift.
    """
    return total_dispatched_many(db, [po_id]).get(po_id, 0.0)


def _derive(po: PurchaseOrder, dispatched: float, today: date) -> PoCalc:
    """The single definition of remaining balance and status.

    Both `compute` and `compute_many` route through here. Keeping one copy is
    what makes the dashboard's overdue count and the list's overdue filter
    agree by construction rather than by coincidence.
    """
    ordered = float(po.ordered_qty)
    remaining = ordered - dispatched
    days_to_delivery = (po.due_date - today).days

    if remaining <= 0:
        status: Status = "fully_dispatched"
    elif po.due_date < today:
        status = "overdue"
    elif po.due_date <= today + timedelta(days=settings.due_soon_days):
        status = "due_soon"
    else:
        status = "on_track"

    return PoCalc(
        total_dispatched=dispatched,
        remaining_balance=remaining,
        days_to_delivery=days_to_delivery,
        status=status,
    )


def compute(db: Session, po: PurchaseOrder, *, today: date | None = None) -> PoCalc:
    return _derive(po, total_dispatched(db, po.id), today or date.today())


def compute_many(
    db: Session, pos: Iterable[PurchaseOrder], *, today: date | None = None
) -> dict[str, PoCalc]:
    """Batched `compute`. `compute_many(db, pos)[po.id] == compute(db, po)`.

    That equality is asserted directly in tests/unit/test_po_calc_batch.py
    rather than inferred from endpoint behaviour: this function stands in front
    of the figure Principle II calls sacred, so a divergence here would be a
    wrong remaining balance rather than a slow page.
    """
    pos = list(pos)
    totals = total_dispatched_many(db, [po.id for po in pos])
    today = today or date.today()
    return {po.id: _derive(po, totals.get(po.id, 0.0), today) for po in pos}
