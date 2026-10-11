"""Migration 0003 must move every pre-006 record without changing a balance.

Constitution XXXI: each existing PO becomes a header with exactly one line,
each dispatch a header with one dispatch line on that line, and every remaining
balance is identical afterwards. Runs against a real PostgreSQL (TEST_PG_URL),
because the migration relies on transactional DDL and gen_random_uuid().

Skipped locally without TEST_PG_URL, but in CI a skip is a failure: a skipped
test for the change most able to corrupt customer balances guards nothing.
"""

import os
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

PG_URL = os.environ.get("TEST_PG_URL", "")

if not PG_URL and os.environ.get("CI"):
    pytest.fail("TEST_PG_URL is not set in CI; the 0003 migration test must run there.", pytrace=False)

pytestmark = pytest.mark.skipif(not PG_URL, reason="needs a real PostgreSQL; set TEST_PG_URL")

BACKEND_ROOT = Path(__file__).resolve().parents[2]
NOW = datetime(2026, 10, 1, tzinfo=UTC)


def _alembic_config() -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "src" / "migrations"))
    return config


@pytest.fixture()
def pre_006_database(monkeypatch):
    """An empty schema brought to 0002 and filled with pre-006 rows."""
    from src.core.config import settings

    monkeypatch.setattr(settings, "database_url", PG_URL, raising=False)
    engine = create_engine(PG_URL)
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.commit()

    command.upgrade(_alembic_config(), "0002")

    with engine.begin() as conn:
        ts = {"now": NOW}
        conn.execute(
            text(
                "INSERT INTO organizations (id, name, currency, timezone, plan_tier, is_suspended,"
                " created_at, updated_at) VALUES ('org1', 'Org', 'USD', 'UTC', 'trial', false,"
                " :now, :now)"
            ),
            ts,
        )
        conn.execute(
            text(
                "INSERT INTO parties (id, organization_id, party_code, party_name, created_at,"
                " updated_at) VALUES ('party1', 'org1', 'P1', 'Party', :now, :now)"
            ),
            ts,
        )
        pos = [
            # id, qty, unit, deleted
            ("po-partial", "100", "bag", None),
            ("po-none", "50.5", "ton", None),
            ("po-over", "10", "truck", None),
            ("po-deleted", "70", "bag", NOW),
        ]
        for po_id, qty, unit, deleted in pos:
            conn.execute(
                text(
                    "INSERT INTO purchase_orders (id, organization_id, party_id, po_number, material,"
                    " ordered_qty, unit, order_date, due_date, deleted_at, created_at, updated_at)"
                    " VALUES (:id, 'org1', 'party1', :id, :mat, :qty, :unit, :od, :dd, :deleted,"
                    " :now, :now)"
                ),
                {
                    "id": po_id,
                    "mat": f"Material {po_id}",
                    "qty": qty,
                    "unit": unit,
                    "od": date(2026, 9, 1),
                    "dd": date(2026, 11, 1),
                    "deleted": deleted,
                    "now": NOW,
                },
            )
        dispatches = [
            ("d1", "po-partial", "40", None),
            ("d2", "po-partial", "25", None),
            ("d3", "po-partial", "5", NOW),  # soft-deleted: must not count
            ("d4", "po-over", "15", None),
            ("d5", "po-deleted", "20", None),
        ]
        for d_id, po_id, qty, deleted in dispatches:
            conn.execute(
                text(
                    "INSERT INTO dispatches (id, organization_id, purchase_order_id, dispatch_date,"
                    " qty, deleted_at, created_at, updated_at) VALUES (:id, 'org1', :po, :dd, :qty,"
                    " :deleted, :now, :now)"
                ),
                {"id": d_id, "po": po_id, "dd": date(2026, 9, 10), "qty": qty, "deleted": deleted,
                 "now": NOW},
            )
    yield engine
    engine.dispose()


def _remaining_after(conn) -> dict[str, float]:
    rows = conn.execute(
        text(
            """
            SELECT l.purchase_order_id, l.ordered_qty - COALESCE(
                (SELECT SUM(dl.qty) FROM dispatch_lines dl JOIN dispatches d ON d.id = dl.dispatch_id
                  WHERE dl.purchase_order_line_id = l.id AND d.deleted_at IS NULL), 0)
              FROM purchase_order_lines l
            """
        )
    ).all()
    return {po_id: float(rem) for po_id, rem in rows}


def test_every_record_moves_and_no_balance_changes(pre_006_database):
    command.upgrade(_alembic_config(), "head")

    with pre_006_database.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM purchase_order_lines")).scalar() == 4
        assert conn.execute(text("SELECT COUNT(*) FROM dispatch_lines")).scalar() == 5
        assert _remaining_after(conn) == {
            "po-partial": 35.0,  # 100 - 40 - 25; the deleted 5 does not count
            "po-none": 50.5,
            "po-over": -5.0,
            "po-deleted": 50.0,
        }
        line = conn.execute(
            text(
                "SELECT line_no, material, ordered_qty, unit FROM purchase_order_lines"
                " WHERE purchase_order_id = 'po-none'"
            )
        ).one()
        assert (line.line_no, line.material, float(line.ordered_qty), line.unit) == (
            1,
            "Material po-none",
            50.5,
            "ton",
        )
        # Soft-delete stays on the header.
        assert conn.execute(
            text("SELECT deleted_at IS NOT NULL FROM purchase_orders WHERE id = 'po-deleted'")
        ).scalar()
        assert conn.execute(
            text("SELECT deleted_at IS NOT NULL FROM dispatches WHERE id = 'd3'")
        ).scalar()

        columns = {
            (r.table_name, r.column_name)
            for r in conn.execute(
                text(
                    "SELECT table_name, column_name FROM information_schema.columns"
                    " WHERE table_name IN ('purchase_orders', 'dispatches')"
                )
            )
        }
        for gone in (
            ("purchase_orders", "material"),
            ("purchase_orders", "ordered_qty"),
            ("purchase_orders", "unit"),
            ("dispatches", "qty"),
        ):
            assert gone not in columns


def test_upgrading_again_is_a_no_op(pre_006_database):
    command.upgrade(_alembic_config(), "head")
    command.upgrade(_alembic_config(), "head")
    with pre_006_database.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM purchase_order_lines")).scalar() == 4
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0003"


def test_database_refuses_a_dispatch_line_on_another_pos_line(pre_006_database):
    command.upgrade(_alembic_config(), "head")
    with pre_006_database.connect() as conn:
        other_line = conn.execute(
            text("SELECT id FROM purchase_order_lines WHERE purchase_order_id = 'po-none'")
        ).scalar()
        with pytest.raises(Exception, match="fk_dispatch_line_po_line"):
            conn.execute(
                text(
                    "INSERT INTO dispatch_lines (id, organization_id, dispatch_id, purchase_order_id,"
                    " purchase_order_line_id, qty, created_at, updated_at)"
                    " VALUES ('x', 'org1', 'd1', 'po-partial', :line, 1, now(), now())"
                ),
                {"line": other_line},
            )


def test_downgrade_restores_single_material_columns(pre_006_database):
    command.upgrade(_alembic_config(), "head")
    command.downgrade(_alembic_config(), "0002")
    with pre_006_database.connect() as conn:
        row = conn.execute(
            text("SELECT material, ordered_qty, unit FROM purchase_orders WHERE id = 'po-partial'")
        ).one()
        assert (row.material, float(row.ordered_qty), row.unit) == ("Material po-partial", 100.0, "bag")
        assert float(conn.execute(text("SELECT qty FROM dispatches WHERE id = 'd2'")).scalar()) == 25.0


def test_rehearsal_script_passes_on_a_clean_migration(pre_006_database):
    from src.scripts import verify_0003

    before = verify_0003.snapshot(PG_URL)
    command.upgrade(_alembic_config(), "head")
    assert verify_0003.compare(before, verify_0003.current(PG_URL)) == []


def test_rehearsal_script_reports_a_changed_balance(pre_006_database):
    from src.scripts import verify_0003

    before = verify_0003.snapshot(PG_URL)
    command.upgrade(_alembic_config(), "head")
    with pre_006_database.begin() as conn:
        conn.execute(text("UPDATE dispatch_lines SET qty = 41 WHERE dispatch_id = 'd1'"))
    problems = verify_0003.compare(before, verify_0003.current(PG_URL))
    assert problems == ["PO po-partial: remaining 35 -> 34"]
