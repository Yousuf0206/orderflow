from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base
from src.models.base import SoftDeleteMixin, TimestampMixin, new_uuid


class PurchaseOrder(Base, TimestampMixin, SoftDeleteMixin):
    """The header of one real-world purchase order (constitution XXVIII).

    What was ordered lives on `lines`; the header carries only what is true of
    the order as a whole. Plan limits count these rows, never lines.
    """

    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("organization_id", "po_number", name="uq_org_po_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    party_id: Mapped[str] = mapped_column(String(36), ForeignKey("parties.id"), index=True)
    po_number: Mapped[str] = mapped_column(String(50))
    order_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="purchase_order",
        order_by="PurchaseOrderLine.line_no",
        cascade="all, delete-orphan",
    )


class PurchaseOrderLine(Base, TimestampMixin):
    """One material on a purchase order.

    No `deleted_at`: a line lives and dies with its header, and editing lines
    after create is out of scope for 006 (research R5). Remaining is never
    stored here -- it is derived from dispatch lines (constitution II, XXIX).
    """

    __tablename__ = "purchase_order_lines"
    __table_args__ = (
        UniqueConstraint("purchase_order_id", "line_no", name="uq_po_line_no"),
        # Target of dispatch_lines' composite FK, which is what lets the
        # database refuse a dispatch line pointing at another PO's line.
        UniqueConstraint("id", "purchase_order_id", name="uq_po_line_id_po"),
        CheckConstraint("ordered_qty > 0", name="ck_po_line_ordered_qty_positive"),
        CheckConstraint("line_no >= 1", name="ck_po_line_no_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    purchase_order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchase_orders.id"), index=True
    )
    line_no: Mapped[int] = mapped_column(Integer)
    material: Mapped[str] = mapped_column(String(200))
    ordered_qty: Mapped[float] = mapped_column(Numeric(14, 3))
    unit: Mapped[str] = mapped_column(String(20))

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="lines")
