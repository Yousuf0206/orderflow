"""Daily purge of deleted accounts past their 30-day window (spec 007 FR-012),
and of delivery-note images older than 30 days (spec 008, constitution XLI).

Run with: `python -m src.scripts.purge_deleted_accounts` from `backend/`, once a
day. It removes only rows whose purge_after has passed, so running it early or
twice is harmless.

Constitution VII: this is the only path that hard-deletes business data, and
only for deletions a user asked for.
"""

from datetime import UTC, datetime

from src.core.db import SessionLocal
from src.services.account_deletion import expire_scans, purge_due


def run() -> dict[str, int]:
    db = SessionLocal()
    try:
        counts = purge_due(db)
        counts["scan_images"] = expire_scans(db, now=datetime.now(UTC))
        db.commit()
        return counts
    finally:
        db.close()


if __name__ == "__main__":
    counts = run()
    print(
        f"purged {counts['organization']} organization(s), {counts['user']} user(s); "
        f"expired {counts['scan_images']} scan image(s)"
    )
