from datetime import date

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base
from src.models.base import SoftDeleteMixin, TimestampMixin, new_uuid


class Dispatch(Base, TimestampMixin, SoftDeleteMixin):
    """One truck load against one purchase order (constitution XXX).

    Quantities live on `lines`. Soft-deleting the header removes every one of
    its lines from remaining, because calculations filter on this row's
    `deleted_at`.
    """

    __tablename__ = "dispatches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    purchase_order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchase_orders.id"), index=True
    )
    dispatch_date: Mapped[date] = mapped_column(Date)
    vehicle_ref: Mapped[str | None] = mapped_column(String(100), default=None)
    remarks: Mapped[str | None] = mapped_column(Text, default=None)

    lines: Mapped[list["DispatchLine"]] = relationship(
        back_populates="dispatch", cascade="all, delete-orphan"
    )


class DispatchLine(Base, TimestampMixin):
    __tablename__ = "dispatch_lines"
    __table_args__ = (
        # The line must belong to the PO this row names; the application also
        # checks that the PO is the dispatch's PO before inserting.
        ForeignKeyConstraint(
            ["purchase_order_line_id", "purchase_order_id"],
            ["purchase_order_lines.id", "purchase_order_lines.purchase_order_id"],
            name="fk_dispatch_line_po_line",
        ),
        UniqueConstraint("dispatch_id", "purchase_order_line_id", name="uq_dispatch_line_once"),
        CheckConstraint("qty > 0", name="ck_dispatch_line_qty_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    dispatch_id: Mapped[str] = mapped_column(String(36), ForeignKey("dispatches.id"), index=True)
    purchase_order_id: Mapped[str] = mapped_column(String(36))
    purchase_order_line_id: Mapped[str] = mapped_column(String(36), index=True)
    qty: Mapped[float] = mapped_column(Numeric(14, 3))

    dispatch: Mapped[Dispatch] = relationship(back_populates="lines")
