"""account deletion: soft-delete fields and the purge record

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-12

Spec 007 FR-012 and constitution VII's account-deletion exception. Additive and
nullable, so no backfill: every existing user, membership and organization is
simply not deleted.
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("purge_after", sa.DateTime(timezone=True), nullable=True))
    op.add_column("memberships", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizations", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizations", sa.Column("purge_after", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "account_purge_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("subject_id", sa.String(36), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("purged_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("account_purge_records")
    op.drop_column("organizations", "purge_after")
    op.drop_column("organizations", "deleted_at")
    op.drop_column("memberships", "deleted_at")
    op.drop_column("users", "purge_after")
    op.drop_column("users", "deleted_at")
