"""Entry point for the scheduled Due Soon / Overdue notification sweep (T050).

Intended to be invoked by an external scheduler (cron, systemd timer, cloud
scheduled job) on an hourly cadence, e.g.:

    cd backend && python -m src.scripts.evaluate_notifications
"""

from src.core.db import SessionLocal
from src.services.notifications import evaluate_and_notify


def run() -> None:
    db = SessionLocal()
    try:
        count = evaluate_and_notify(db)
        print(f"Created {count} notifications")
    finally:
        db.close()


if __name__ == "__main__":
    run()
