from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import SoftDeleteMixin, TimestampMixin, new_uuid


class PurchaseOrder(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("organization_id", "po_number", name="uq_org_po_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    party_id: Mapped[str] = mapped_column(String(36), ForeignKey("parties.id"), index=True)
    po_number: Mapped[str] = mapped_column(String(50))
    material: Mapped[str] = mapped_column(String(200))
    ordered_qty: Mapped[float] = mapped_column(Numeric(14, 3))
    unit: Mapped[str] = mapped_column(String(20))
    order_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
