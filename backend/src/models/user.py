from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import TimestampMixin, new_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False)
