from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import TimestampMixin, new_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    # Account deletion (constitution VII exception, spec 007 FR-012). Set on
    # the click; the row is only removed by the purge job once purge_after has
    # passed. A deleted user's email is replaced so the address is free to
    # sign up again as a new account.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    purge_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
