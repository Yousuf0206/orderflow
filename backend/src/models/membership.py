from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import TimestampMixin, new_uuid

ROLES = ("owner", "manager", "staff", "viewer")


class Membership(Base, TimestampMixin):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    # When a mail service accepted the invitation message. NULL means no email
    # has been confirmed delivered -- none attempted, none configured, or the
    # attempt failed. It MUST NOT be set optimistically: the whole point is
    # that an owner can tell "we emailed them" from "we could not".
    #
    # Distinct from `invited_at`, which records that the invitation exists. The
    # gap between the two is what an owner needs to see when a colleague says
    # nothing arrived.
    invitation_email_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
