from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import TimestampMixin, new_uuid


class AuditLogEntry(Base, TimestampMixin):
    __tablename__ = "audit_log_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    actor_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(10))  # create | edit | delete
    entity_type: Mapped[str] = mapped_column(String(30))  # party | purchase_order | dispatch
    entity_id: Mapped[str] = mapped_column(String(36))
    before_state: Mapped[dict | None] = mapped_column(JSON, default=None)
    after_state: Mapped[dict | None] = mapped_column(JSON, default=None)
