import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, Query, mapped_column


def _now() -> datetime:
    return datetime.now(UTC)


def new_uuid() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class SoftDeleteMixin:
    """Constitution Principle VII: No Hard Deletes of Business Data.

    Entities using this mixin must be queried through `active()` (or an
    equivalent explicit `deleted_at.is_(None)` filter) in every default list/
    detail/calculation query.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    @classmethod
    def active(cls, query: Query) -> Query:
        return query.filter(cls.deleted_at.is_(None))

    def soft_delete(self) -> None:
        self.deleted_at = _now()
