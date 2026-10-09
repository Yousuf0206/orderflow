"""record whether an invitation email was actually dispatched

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-09

Additive and nullable, so it is backward compatible and needs no backfill.
NULL is the honest value for memberships that predate the column: nothing can
be asserted about whether their invitations were ever emailed, and NULL is the
same value a failed send produces -- in both cases the truthful statement to an
owner is "we cannot confirm an email reached them".
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "memberships",
        sa.Column("invitation_email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("memberships", "invitation_email_sent_at")
