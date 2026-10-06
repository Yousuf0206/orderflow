from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.core.config import settings
from src.models.dispatch import Dispatch
from src.models.purchase_order import PurchaseOrder

Status = str  # "fully_dispatched" | "overdue" | "due_soon" | "on_track"


@dataclass
class PoCalc:
    total_dispatched: float
    remaining_balance: float
    days_to_delivery: int
    status: Status


def total_dispatched(db: Session, po_id: str) -> float:
    """Constitution Principle II: Remaining Balance is Sacred.

    Always computed live from non-deleted Dispatches — never read from (or
    written to) a cached column on PurchaseOrder.
    """
    result = (
        db.query(func.coalesce(func.sum(Dispatch.qty), 0))
        .filter(Dispatch.purchase_order_id == po_id, Dispatch.deleted_at.is_(None))
        .scalar()
    )
    return float(result or 0)


def compute(db: Session, po: PurchaseOrder, *, today: date | None = None) -> PoCalc:
    today = today or date.today()
    dispatched = total_dispatched(db, po.id)
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
