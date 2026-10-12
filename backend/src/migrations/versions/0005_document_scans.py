"""document scans: delivery-note photos read into dispatch drafts

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-13

Spec 008. New tables only; no existing row changes. A scan is never a dispatch
(constitution XXXVIII); images are purged after 30 days (XLI).
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_scans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("purchase_order_id", sa.String(36), sa.ForeignKey("purchase_orders.id"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("read_ms", sa.Integer(), nullable=True),
        sa.Column("draft_json", sa.JSON(), nullable=True),
        sa.Column("dispatch_id", sa.String(36), sa.ForeignKey("dispatches.id"), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_document_scans_org_created", "document_scans", ["organization_id", "created_at"])
    op.create_table(
        "scan_images",
        sa.Column(
            "scan_id",
            sa.String(36),
            sa.ForeignKey("document_scans.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("organization_id", sa.String(36), nullable=False, index=True),
        sa.Column("content_type", sa.String(20), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("scan_images")
    op.drop_index("ix_document_scans_org_created", table_name="document_scans")
    op.drop_table("document_scans")
