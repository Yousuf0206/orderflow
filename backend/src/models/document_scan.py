from sqlalchemy import JSON, ForeignKey, Index, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import TimestampMixin, new_uuid


class DocumentScan(Base, TimestampMixin):
    """One delivery-note photo read for one purchase order (spec 008).

    Never a dispatch and never counted in remaining (constitution XXXVIII).
    `dispatch_id` is set only when the user confirms the draft through the
    ordinary dispatch POST.
    """

    __tablename__ = "document_scans"
    __table_args__ = (Index("ix_document_scans_org_created", "organization_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"))
    purchase_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("purchase_orders.id"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    # "read" | "unreadable" | "failed" | "confirmed"
    status: Mapped[str] = mapped_column(String(20))
    read_ms: Mapped[int | None] = mapped_column(Integer, default=None)
    # The draft as returned to the client; nulled after 30 days (constitution XLI).
    draft_json: Mapped[dict | None] = mapped_column(JSON, default=None)
    dispatch_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("dispatches.id"), unique=True, default=None
    )


class ScanImage(Base, TimestampMixin):
    """The compressed photo behind a scan, deleted after 30 days (constitution XLI)."""

    __tablename__ = "scan_images"

    scan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("document_scans.id", ondelete="CASCADE"), primary_key=True
    )
    organization_id: Mapped[str] = mapped_column(String(36), index=True)
    content_type: Mapped[str] = mapped_column(String(20))
    data: Mapped[bytes] = mapped_column(LargeBinary)
