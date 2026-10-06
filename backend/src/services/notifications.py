"""FR-014: in-app notifications + email alerts for Overdue / Due Soon POs.

MVP simplification: this is an on-demand evaluation function (`evaluate_and_notify`)
rather than a live background scheduler. Wire it to a cron job / scheduled task
(e.g. `python -m src.scripts.evaluate_notifications`, run hourly) in deployment;
the function itself is idempotent-ish per run (it does not re-notify a PO that
already has a notification of the same type sent within the last 24h).
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from src.models.membership import Membership
from src.models.notification import Notification
from src.models.organization import Organization
from src.models.purchase_order import PurchaseOrder
from src.models.user import User
from src.services.email import send_email
from src.services.po_calc import compute


def _already_notified_recently(db: Session, po_id: str, notif_type: str) -> bool:
    cutoff = datetime.now(UTC) - timedelta(hours=24)
    return (
        db.query(Notification)
        .filter(
            Notification.purchase_order_id == po_id,
            Notification.type == notif_type,
            Notification.sent_at >= cutoff,
        )
        .first()
        is not None
    )


def evaluate_and_notify(db: Session) -> int:
    """Scans all non-deleted POs across all organizations, creates in-app +
    email Notifications for any that are newly Due Soon / Overdue. Returns
    the number of notifications created.
    """
    created = 0
    pos = db.query(PurchaseOrder).filter(PurchaseOrder.deleted_at.is_(None)).all()
    for po in pos:
        calc = compute(db, po)
        if calc.status not in ("due_soon", "overdue"):
            continue
        if _already_notified_recently(db, po.id, calc.status):
            continue

        org = db.get(Organization, po.organization_id)
        recipients = (
            db.query(Membership)
            .filter(Membership.organization_id == po.organization_id, Membership.role.in_(["owner", "manager"]))
            .all()
        )
        for membership in recipients:
            user = db.get(User, membership.user_id)
            now = datetime.now(UTC)
            db.add(
                Notification(
                    organization_id=po.organization_id,
                    purchase_order_id=po.id,
                    type=calc.status,
                    channel="in_app",
                    recipient_user_id=user.id,
                    sent_at=now,
                )
            )
            if calc.status == "overdue":
                db.add(
                    Notification(
                        organization_id=po.organization_id,
                        purchase_order_id=po.id,
                        type=calc.status,
                        channel="email",
                        recipient_user_id=user.id,
                        sent_at=now,
                    )
                )
                send_email(
                    to=user.email,
                    subject=f"PO {po.po_number} is overdue",
                    body=(
                        f"Purchase Order {po.po_number} ({po.material}) at {org.name} is overdue "
                        f"with {calc.remaining_balance} {po.unit} remaining."
                    ),
                )
            created += 1
    db.commit()
    return created
