"""The schema must reach head before the app serves a request.

Regression test for the 2026-10-09 outage: migration 0002 added
memberships.invitation_email_sent_at, the code shipped, the migration never ran
against production, and every request touching Membership returned 500 --
signup and, through get_current_user, every authenticated endpoint.

These run against a real PostgreSQL only, because the mechanism under test is a
PostgreSQL advisory lock plus alembic history. Set TEST_PG_URL to enable them,
e.g.

    docker run -d --name pg -e POSTGRES_USER=orderflow \\
      -e POSTGRES_PASSWORD=orderflow -e POSTGRES_DB=orderflow -p 5434:5432 postgres:16
    TEST_PG_URL=postgresql+psycopg://orderflow:orderflow@localhost:5434/orderflow pytest

Skipped otherwise, so the default suite stays dependency-free -- which does
mean CI will not run them until a Postgres service is added to the workflow.
"""

import os

import pytest
from sqlalchemy import create_engine, text

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_PG_URL"),
    reason="needs a real PostgreSQL; set TEST_PG_URL",
)

PG_URL = os.environ.get("TEST_PG_URL", "")


@pytest.fixture()
def blank_database(monkeypatch):
    """A database with nothing in it, pointed at by settings."""
    engine = create_engine(PG_URL)
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.commit()
    engine.dispose()

    from src.core.config import settings

    monkeypatch.setattr(settings, "database_url", PG_URL, raising=False)
    monkeypatch.setattr(settings, "auto_migrate", True, raising=False)
    yield PG_URL


def _columns(url: str, table: str) -> set[str]:
    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            return {
                r[0]
                for r in conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :t"
                    ),
                    {"t": table},
                ).fetchall()
            }
    finally:
        engine.dispose()


def test_startup_brings_an_empty_database_to_head(blank_database):
    from src.core.migrate import run_migrations

    run_migrations()

    columns = _columns(blank_database, "memberships")
    assert "invitation_email_sent_at" in columns


def test_startup_brings_a_database_stuck_one_revision_behind_to_head(blank_database):
    """The outage, exactly: schema at 0001, code expecting 0002."""
    from alembic import command
    from alembic.config import Config

    from src.core.migrate import ALEMBIC_INI, BACKEND_ROOT, run_migrations

    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(BACKEND_ROOT / "src" / "migrations"))
    config.set_main_option("sqlalchemy.url", blank_database)
    command.upgrade(config, "0001")

    assert "invitation_email_sent_at" not in _columns(blank_database, "memberships")

    run_migrations()

    assert "invitation_email_sent_at" in _columns(blank_database, "memberships")


def test_running_twice_is_harmless(blank_database):
    """Every cold start calls this; it has to be a no-op once current."""
    from src.core.migrate import run_migrations

    run_migrations()
    run_migrations()

    assert "invitation_email_sent_at" in _columns(blank_database, "memberships")


def test_the_advisory_lock_is_released(blank_database):
    """A lock left held would stall every later cold start behind it."""
    from src.core.migrate import MIGRATION_LOCK_KEY, run_migrations

    run_migrations()

    engine = create_engine(blank_database)
    try:
        with engine.connect() as conn:
            held = conn.execute(
                text("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND objid = :k"),
                {"k": MIGRATION_LOCK_KEY & 0xFFFFFFFF},
            ).scalar()
            assert held == 0
    finally:
        engine.dispose()


def test_auto_migrate_off_leaves_the_schema_alone(blank_database, monkeypatch):
    """The escape hatch has to actually escape."""
    from src.core.config import settings
    from src.core.migrate import run_migrations

    monkeypatch.setattr(settings, "auto_migrate", False, raising=False)
    run_migrations()

    assert _columns(blank_database, "memberships") == set()
