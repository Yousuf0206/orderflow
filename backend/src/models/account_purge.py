from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import new_uuid


class AccountPurgeRecord(Base):
    """Proof that a requested deletion was carried out (constitution VII).

    Deliberately holds no name, email, or business data -- only that a user or
    organization with this id was deleted on one date and purged on another.
    """

    __tablename__ = "account_purge_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    kind: Mapped[str] = mapped_column(String(20))  # "user" | "organization"
    subject_id: Mapped[str] = mapped_column(String(36))
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    purged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
