from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import SoftDeleteMixin, TimestampMixin, new_uuid


class Dispatch(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "dispatches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    purchase_order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchase_orders.id"), index=True
    )
    dispatch_date: Mapped[date] = mapped_column(Date)
    qty: Mapped[float] = mapped_column(Numeric(14, 3))
    vehicle_ref: Mapped[str | None] = mapped_column(String(100), default=None)
    remarks: Mapped[str | None] = mapped_column(Text, default=None)
