from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import TimestampMixin, new_uuid


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    purchase_order_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("purchase_orders.id"), default=None
    )
    type: Mapped[str] = mapped_column(String(20))  # due_soon | overdue
    channel: Mapped[str] = mapped_column(String(10))  # in_app | email
    recipient_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
