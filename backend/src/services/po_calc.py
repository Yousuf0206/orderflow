from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.core.config import settings
from src.models.dispatch import Dispatch, DispatchLine
from src.models.purchase_order import PurchaseOrder, PurchaseOrderLine

Status = str  # "fully_dispatched" | "overdue" | "due_soon" | "on_track"

# The only list of status values. `po_status` below produces exactly these, and
# callers validating a status filter compare against this rather than keeping
# their own copy.
VALID_STATUSES: tuple[Status, ...] = ("fully_dispatched", "overdue", "due_soon", "on_track")


@dataclass
class LineCalc:
    id: str
    line_no: int
    material: str
    unit: str
    ordered_qty: float
    dispatched_qty: float
    remaining_qty: float


@dataclass
class PoCalc:
    lines: list[LineCalc]
    days_to_delivery: int
    status: Status
    # [{"unit": str, "remaining": float}] over open lines only. Never summed
    # across units (constitution XXIX).
    remaining_by_unit: list[dict] = field(default_factory=list)

    @property
    def item_count(self) -> int:
        return len(self.lines)

    @property
    def material_summary(self) -> str:
        if not self.lines:
            return ""
        first = self.lines[0].material
        extra = len(self.lines) - 1
        return f"{first} +{extra} more" if extra else first


def unit_key(unit: str) -> str:
    """Two spellings of one unit ("Bag", "bag ") group together; nothing is converted."""
    return unit.strip().lower()


def line_remaining(ordered_qty: float, dispatched_qty: float) -> float:
    return ordered_qty - dispatched_qty


def po_is_complete(remainings: Iterable[float]) -> bool:
    """Fully dispatched only when every line is (constitution XXIX)."""
    return all(r <= 0 for r in remainings)


def po_status(remainings: Sequence[float], due_date: date, today: date) -> Status:
    """The single definition of status. Derived from lines; the PO due date sets severity."""
    if po_is_complete(remainings):
        return "fully_dispatched"
    if due_date < today:
        return "overdue"
    if due_date <= today + timedelta(days=settings.due_soon_days):
        return "due_soon"
    return "on_track"


def remaining_by_unit(lines: Iterable[LineCalc]) -> list[dict]:
    totals: dict[str, float] = defaultdict(float)
    for line in lines:
        if line.remaining_qty > 0:
            totals[unit_key(line.unit)] += line.remaining_qty
    return [{"unit": unit, "remaining": totals[unit]} for unit in sorted(totals)]


def dispatched_by_line_many(db: Session, line_ids: Sequence[str]) -> dict[str, float]:
    """Dispatched totals for many lines in one query.

    Constitution Principle II: computed live from dispatch lines whose dispatch
    is not soft-deleted. Batched because per-row queries against the hosted
    database (~300ms a round trip) blew the client's 12s deadline at ~180
    orders. Lines missing from the result have no dispatches; read them as 0.
    """
    if not line_ids:
        return {}
    rows = (
        db.query(DispatchLine.purchase_order_line_id, func.coalesce(func.sum(DispatchLine.qty), 0))
        .join(Dispatch, Dispatch.id == DispatchLine.dispatch_id)
        .filter(DispatchLine.purchase_order_line_id.in_(line_ids), Dispatch.deleted_at.is_(None))
        .group_by(DispatchLine.purchase_order_line_id)
        .all()
    )
    return {line_id: float(total or 0) for line_id, total in rows}


def lines_for_many(db: Session, po_ids: Sequence[str]) -> dict[str, list[PurchaseOrderLine]]:
    """Every line of many purchase orders, in display order, in one query."""
    if not po_ids:
        return {}
    by_po: dict[str, list[PurchaseOrderLine]] = defaultdict(list)
    rows = (
        db.query(PurchaseOrderLine)
        .filter(PurchaseOrderLine.purchase_order_id.in_(po_ids))
        .order_by(PurchaseOrderLine.purchase_order_id, PurchaseOrderLine.line_no)
        .all()
    )
    for line in rows:
        by_po[line.purchase_order_id].append(line)
    return by_po


def _derive(
    po: PurchaseOrder, lines: Sequence[PurchaseOrderLine], dispatched: dict[str, float], today: date
) -> PoCalc:
    calcs = []
    for line in lines:
        ordered = float(line.ordered_qty)
        done = dispatched.get(line.id, 0.0)
        calcs.append(
            LineCalc(
                id=line.id,
                line_no=line.line_no,
                material=line.material,
                unit=line.unit,
                ordered_qty=ordered,
                dispatched_qty=done,
                remaining_qty=line_remaining(ordered, done),
            )
        )
    return PoCalc(
        lines=calcs,
        days_to_delivery=(po.due_date - today).days,
        status=po_status([c.remaining_qty for c in calcs], po.due_date, today),
        remaining_by_unit=remaining_by_unit(calcs),
    )


def compute_many(
    db: Session, pos: Iterable[PurchaseOrder], *, today: date | None = None
) -> dict[str, PoCalc]:
    """Two queries for any number of orders: one for lines, one for dispatched totals.

    `compute_many(db, pos)[po.id] == compute(db, po)` is asserted directly in
    tests/unit/test_po_calc_batch.py: this stands in front of the figure
    Principle II calls sacred, so a divergence would be a wrong balance.
    """
    pos = list(pos)
    lines = lines_for_many(db, [po.id for po in pos])
    dispatched = dispatched_by_line_many(db, [line.id for ls in lines.values() for line in ls])
    today = today or date.today()
    return {po.id: _derive(po, lines.get(po.id, []), dispatched, today) for po in pos}


def compute(db: Session, po: PurchaseOrder, *, today: date | None = None) -> PoCalc:
    return compute_many(db, [po], today=today)[po.id]
