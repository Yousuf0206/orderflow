from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import SoftDeleteMixin, TimestampMixin, new_uuid


class Party(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "parties"
    __table_args__ = (UniqueConstraint("organization_id", "party_code", name="uq_org_party_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    party_code: Mapped[str] = mapped_column(String(50))
    party_name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(100), default=None)
    contact_person: Mapped[str | None] = mapped_column(String(150), default=None)
    phone: Mapped[str | None] = mapped_column(String(30), default=None)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
