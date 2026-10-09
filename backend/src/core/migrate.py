"""Bring the schema to head before this process serves a request.

Why this exists, concretely: migration 0002 added
memberships.invitation_email_sent_at, the code was deployed, and the migration
was never run against the production database. Every INSERT and SELECT touching
Membership then referenced a column that did not exist -- so signup returned
500, and because get_current_user queries Membership, so did every
authenticated request. Login still succeeded, which made it worse: users signed
in and then every screen failed.

Nothing in the pipeline owned that ordering. Vercel deploys on push; CI runs in
parallel and does not deploy; and overriding a service's buildCommand replaces
its build rather than adding to it. Doing it at startup is the one place that
can guarantee schema-at-least-code for the process about to serve traffic,
whatever deploys it.

Trade-off, stated plainly: this lets the serving application change the schema,
which some teams forbid, and it makes a cold start depend on the database. The
second part matters least here -- an instance that cannot reach the database
cannot serve anything useful anyway -- and the first is the price of having no
separate release phase. If a release phase appears later, move this into it and
set AUTO_MIGRATE=false.
"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from src.core.config import settings

logger = logging.getLogger("orderflow.migrate")

# backend/ -- alembic.ini and src/migrations live here.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"

# Arbitrary but fixed. Every instance takes the same lock, so concurrent cold
# starts queue rather than racing to run the same migration twice.
MIGRATION_LOCK_KEY = 0x0F10_0F10


def _is_postgres(url: str) -> bool:
    return url.startswith("postgresql")


def run_migrations() -> None:
    """Run `alembic upgrade head`, once, under an advisory lock.

    A no-op when the schema is already current -- it costs one SELECT of
    alembic_version on each cold start, which is cheap enough to pay for
    knowing the code and the schema agree.

    Raises on failure. That is deliberate: a process whose schema is behind its
    code produces 500s on every request that touches the drifted table, and
    failing to start is both louder and shorter-lived than that.
    """
    if not settings.auto_migrate:
        logger.info("AUTO_MIGRATE is off; skipping schema upgrade")
        return

    if not _is_postgres(settings.database_url):
        # Tests build their schema with create_all against SQLite, which has no
        # advisory locks and no migration history to speak of.
        logger.info("Non-PostgreSQL database; skipping schema upgrade")
        return

    engine = create_engine(settings.database_url, poolclass=None)
    try:
        with engine.connect() as connection:
            connection.execute(
                text("SELECT pg_advisory_lock(:key)"), {"key": MIGRATION_LOCK_KEY}
            )
            try:
                config = Config(str(ALEMBIC_INI))
                config.set_main_option("script_location", str(BACKEND_ROOT / "src" / "migrations"))
                # Hand alembic the connection that holds the lock, so the
                # upgrade and the lock cannot end up on different sessions.
                config.attributes["connection"] = connection
                command.upgrade(config, "head")
                connection.commit()
                logger.info("schema is at head")
            finally:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:key)"), {"key": MIGRATION_LOCK_KEY}
                )
    finally:
        engine.dispose()
