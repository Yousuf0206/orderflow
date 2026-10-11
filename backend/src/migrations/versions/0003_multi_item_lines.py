"""split purchase orders and dispatches into header + lines

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-12

Feature 006. Every existing purchase order becomes a header with exactly one
line; every existing dispatch becomes a header with one dispatch line against
that sole line (constitution XXXI). Soft-deleted rows are backfilled too, so
history stays recoverable; deletion remains on the header.

All of it runs in one transaction. Before the old columns are dropped, the
backfill is checked in SQL -- row counts, one line per PO, and every PO's
remaining before equal to its line's remaining after. Any mismatch raises,
which rolls the whole revision back and makes the startup migrator fail loud
(src/core/migrate.py) rather than serve code against a half-moved schema.

PostgreSQL only: it relies on transactional DDL and gen_random_uuid().
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _scalar(sql: str):
    return op.get_bind().execute(sa.text(sql)).scalar()


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(f"0003 backfill verification failed: {message}")


def upgrade() -> None:
    op.create_table(
        "purchase_order_lines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("purchase_order_id", sa.String(36), sa.ForeignKey("purchase_orders.id"), nullable=False),
        sa.Column("line_no", sa.Integer, nullable=False),
        sa.Column("material", sa.String(200), nullable=False),
        sa.Column("ordered_qty", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("purchase_order_id", "line_no", name="uq_po_line_no"),
        sa.UniqueConstraint("id", "purchase_order_id", name="uq_po_line_id_po"),
        sa.CheckConstraint("ordered_qty > 0", name="ck_po_line_ordered_qty_positive"),
        sa.CheckConstraint("line_no >= 1", name="ck_po_line_no_positive"),
    )
    op.create_index("ix_purchase_order_lines_organization_id", "purchase_order_lines", ["organization_id"])
    op.create_index(
        "ix_purchase_order_lines_purchase_order_id", "purchase_order_lines", ["purchase_order_id"]
    )

    op.create_table(
        "dispatch_lines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("dispatch_id", sa.String(36), sa.ForeignKey("dispatches.id"), nullable=False),
        sa.Column("purchase_order_id", sa.String(36), nullable=False),
        sa.Column("purchase_order_line_id", sa.String(36), nullable=False),
        sa.Column("qty", sa.Numeric(14, 3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["purchase_order_line_id", "purchase_order_id"],
            ["purchase_order_lines.id", "purchase_order_lines.purchase_order_id"],
            name="fk_dispatch_line_po_line",
        ),
        sa.UniqueConstraint("dispatch_id", "purchase_order_line_id", name="uq_dispatch_line_once"),
        sa.CheckConstraint("qty > 0", name="ck_dispatch_line_qty_positive"),
    )
    op.create_index("ix_dispatch_lines_organization_id", "dispatch_lines", ["organization_id"])
    op.create_index("ix_dispatch_lines_dispatch_id", "dispatch_lines", ["dispatch_id"])
    op.create_index(
        "ix_dispatch_lines_purchase_order_line_id", "dispatch_lines", ["purchase_order_line_id"]
    )

    # Remaining per PO before anything moves, kept for the comparison below.
    op.execute(
        """
        CREATE TEMP TABLE _0003_before ON COMMIT DROP AS
        SELECT po.id AS po_id,
               po.ordered_qty - COALESCE(
                   (SELECT SUM(d.qty) FROM dispatches d
                     WHERE d.purchase_order_id = po.id AND d.deleted_at IS NULL), 0
               ) AS remaining
          FROM purchase_orders po
        """
    )

    op.execute(
        """
        INSERT INTO purchase_order_lines
            (id, organization_id, purchase_order_id, line_no, material, ordered_qty, unit,
             created_at, updated_at)
        SELECT gen_random_uuid()::text, organization_id, id, 1, material, ordered_qty, unit,
               created_at, updated_at
          FROM purchase_orders
        """
    )

    op.execute(
        """
        INSERT INTO dispatch_lines
            (id, organization_id, dispatch_id, purchase_order_id, purchase_order_line_id, qty,
             created_at, updated_at)
        SELECT gen_random_uuid()::text, d.organization_id, d.id, d.purchase_order_id, l.id, d.qty,
               d.created_at, d.updated_at
          FROM dispatches d
          JOIN purchase_order_lines l ON l.purchase_order_id = d.purchase_order_id
        """
    )

    pos = _scalar("SELECT COUNT(*) FROM purchase_orders")
    lines = _scalar("SELECT COUNT(*) FROM purchase_order_lines")
    _assert(pos == lines, f"{pos} purchase orders but {lines} lines")

    dispatches = _scalar("SELECT COUNT(*) FROM dispatches")
    dispatch_lines = _scalar("SELECT COUNT(*) FROM dispatch_lines")
    _assert(
        dispatches == dispatch_lines, f"{dispatches} dispatches but {dispatch_lines} dispatch lines"
    )

    not_one = _scalar(
        """
        SELECT COUNT(*) FROM purchase_orders po
         WHERE (SELECT COUNT(*) FROM purchase_order_lines l WHERE l.purchase_order_id = po.id) <> 1
        """
    )
    _assert(not_one == 0, f"{not_one} purchase orders do not have exactly one line")

    drifted = _scalar(
        """
        SELECT COUNT(*) FROM _0003_before b
          JOIN purchase_order_lines l ON l.purchase_order_id = b.po_id
         WHERE b.remaining <> l.ordered_qty - COALESCE(
                 (SELECT SUM(dl.qty) FROM dispatch_lines dl
                    JOIN dispatches d ON d.id = dl.dispatch_id
                   WHERE dl.purchase_order_line_id = l.id AND d.deleted_at IS NULL), 0)
        """
    )
    _assert(drifted == 0, f"{drifted} purchase orders changed remaining balance")

    op.drop_column("purchase_orders", "material")
    op.drop_column("purchase_orders", "ordered_qty")
    op.drop_column("purchase_orders", "unit")
    op.drop_column("dispatches", "qty")


def downgrade() -> None:
    multi = _scalar(
        """
        SELECT COUNT(*) FROM (
            SELECT purchase_order_id FROM purchase_order_lines
             GROUP BY purchase_order_id HAVING COUNT(*) > 1
        ) m
        """
    )
    if multi:
        raise RuntimeError(
            f"Cannot downgrade 0003: {multi} purchase orders have more than one line, "
            "and the single-material schema has nowhere to put them."
        )
    multi_dispatch = _scalar(
        """
        SELECT COUNT(*) FROM (
            SELECT dispatch_id FROM dispatch_lines GROUP BY dispatch_id HAVING COUNT(*) > 1
        ) m
        """
    )
    if multi_dispatch:
        raise RuntimeError(f"Cannot downgrade 0003: {multi_dispatch} dispatches cover several lines.")

    op.add_column("purchase_orders", sa.Column("material", sa.String(200), nullable=True))
    op.add_column("purchase_orders", sa.Column("ordered_qty", sa.Numeric(14, 3), nullable=True))
    op.add_column("purchase_orders", sa.Column("unit", sa.String(20), nullable=True))
    op.add_column("dispatches", sa.Column("qty", sa.Numeric(14, 3), nullable=True))
    op.execute(
        """
        UPDATE purchase_orders po
           SET material = l.material, ordered_qty = l.ordered_qty, unit = l.unit
          FROM purchase_order_lines l WHERE l.purchase_order_id = po.id
        """
    )
    op.execute(
        "UPDATE dispatches d SET qty = dl.qty FROM dispatch_lines dl WHERE dl.dispatch_id = d.id"
    )
    op.alter_column("purchase_orders", "material", nullable=False)
    op.alter_column("purchase_orders", "ordered_qty", nullable=False)
    op.alter_column("purchase_orders", "unit", nullable=False)
    op.alter_column("dispatches", "qty", nullable=False)
    op.drop_table("dispatch_lines")
    op.drop_table("purchase_order_lines")
