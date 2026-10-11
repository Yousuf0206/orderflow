"""Account deletion and the purge that completes it (spec 007 FR-012).

Constitution VII, v2.0.0 exception: the click only soft-deletes and revokes
access; a scheduled purge removes the data no earlier than PURGE_AFTER_DAYS
later, touches only what that deletion covered, and leaves a record that holds
no business data.

Two outcomes, decided per organization the user belongs to:
- the user is that organization's only active owner -> the organization is
  soft-deleted and every member loses access;
- otherwise -> only the user's membership goes, and the organization carries on.
The user's login is removed in both cases.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from src.models.account_purge import AccountPurgeRecord
from src.models.audit_log import AuditLogEntry
from src.models.dispatch import Dispatch, DispatchLine
from src.models.membership import Membership
from src.models.notification import Notification
from src.models.organization import Organization
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder, PurchaseOrderLine
from src.models.subscription import Subscription
from src.models.user import User

PURGE_AFTER_DAYS = 30


@dataclass
class DeletionPlan:
    organizations_deleted: list[Organization]
    organizations_left: list[Organization]

    @property
    def role_effect(self) -> str:
        return "owner" if self.organizations_deleted else "member"


def _active_memberships(db: Session, user_id: str) -> list[Membership]:
    return (
        db.query(Membership)
        .join(Organization, Organization.id == Membership.organization_id)
        .filter(
            Membership.user_id == user_id,
            Membership.deleted_at.is_(None),
            Organization.deleted_at.is_(None),
        )
        .all()
    )


def _is_sole_owner(db: Session, membership: Membership) -> bool:
    if membership.role != "owner":
        return False
    others = (
        db.query(Membership)
        .filter(
            Membership.organization_id == membership.organization_id,
            Membership.role == "owner",
            Membership.id != membership.id,
            Membership.deleted_at.is_(None),
            Membership.accepted_at.isnot(None),
        )
        .count()
    )
    return others == 0


def plan_deletion(db: Session, user: User) -> DeletionPlan:
    deleted, left = [], []
    for membership in _active_memberships(db, user.id):
        org = db.get(Organization, membership.organization_id)
        (deleted if _is_sole_owner(db, membership) else left).append(org)
    return DeletionPlan(organizations_deleted=deleted, organizations_left=left)


def member_count(db: Session, organization_id: str) -> int:
    return (
        db.query(Membership)
        .filter(Membership.organization_id == organization_id, Membership.deleted_at.is_(None))
        .count()
    )


def delete_account(db: Session, user: User, *, now: datetime | None = None) -> DeletionPlan:
    """Soft-delete and revoke. Caller commits. Nothing is removed here."""
    now = now or datetime.now(UTC)
    purge_after = now + timedelta(days=PURGE_AFTER_DAYS)
    plan = plan_deletion(db, user)

    for org in plan.organizations_deleted:
        org.deleted_at = now
        org.purge_after = purge_after
        db.add(
            AuditLogEntry(
                organization_id=org.id,
                actor_user_id=user.id,
                action="delete",
                entity_type="organization",
                entity_id=org.id,
                after_state={"purge_after": purge_after.isoformat()},
            )
        )

    for membership in db.query(Membership).filter(
        Membership.user_id == user.id, Membership.deleted_at.is_(None)
    ):
        membership.deleted_at = now

    user.deleted_at = now
    user.purge_after = purge_after
    # Frees the address for a fresh signup and stops password-reset mail
    # reaching a deleted account. The original address is not kept anywhere.
    user.email = f"deleted-{user.id}@deleted.invalid"
    user.password_hash = ""
    return plan


def _purge_organization(db: Session, org_id: str) -> None:
    po_ids = [r[0] for r in db.query(PurchaseOrder.id).filter(PurchaseOrder.organization_id == org_id)]
    dispatch_ids = [r[0] for r in db.query(Dispatch.id).filter(Dispatch.organization_id == org_id)]
    if dispatch_ids:
        db.query(DispatchLine).filter(DispatchLine.dispatch_id.in_(dispatch_ids)).delete(
            synchronize_session=False
        )
    db.query(Dispatch).filter(Dispatch.organization_id == org_id).delete(synchronize_session=False)
    if po_ids:
        db.query(Notification).filter(Notification.purchase_order_id.in_(po_ids)).delete(
            synchronize_session=False
        )
        db.query(PurchaseOrderLine).filter(PurchaseOrderLine.purchase_order_id.in_(po_ids)).delete(
            synchronize_session=False
        )
    db.query(Notification).filter(Notification.organization_id == org_id).delete(synchronize_session=False)
    db.query(PurchaseOrder).filter(PurchaseOrder.organization_id == org_id).delete(synchronize_session=False)
    db.query(Party).filter(Party.organization_id == org_id).delete(synchronize_session=False)
    db.query(AuditLogEntry).filter(AuditLogEntry.organization_id == org_id).delete(synchronize_session=False)
    db.query(Subscription).filter(Subscription.organization_id == org_id).delete(synchronize_session=False)
    db.query(Membership).filter(Membership.organization_id == org_id).delete(synchronize_session=False)
    db.query(Organization).filter(Organization.id == org_id).delete(synchronize_session=False)


def purge_due(db: Session, *, now: datetime | None = None) -> dict[str, int]:
    """Hard-delete what is past its window, and nothing else. Caller commits.

    Organizations first: an organization's memberships may belong to a user
    purged in the same run.
    """
    now = now or datetime.now(UTC)
    counts = {"organization": 0, "user": 0}

    due_orgs = (
        db.query(Organization)
        .filter(Organization.deleted_at.isnot(None), Organization.purge_after <= now)
        .all()
    )
    for org in due_orgs:
        deleted_at = org.deleted_at
        _purge_organization(db, org.id)
        db.add(AccountPurgeRecord(kind="organization", subject_id=org.id, deleted_at=deleted_at, purged_at=now))
        counts["organization"] += 1

    due_users = db.query(User).filter(User.deleted_at.isnot(None), User.purge_after <= now).all()
    for user in due_users:
        deleted_at = user.deleted_at
        # Their memberships in organizations that carry on. Audit entries they
        # authored there stay with the organization; the actor id no longer
        # resolves to anyone.
        db.query(Membership).filter(Membership.user_id == user.id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.recipient_user_id == user.id).delete(
            synchronize_session=False
        )
        # Audit entries in organizations that carry on still name this user as
        # actor, and the audit log is that organization's record, not the
        # user's. The row then stays as a bare id: its email and password were
        # already erased at deletion, so no personal data remains on it.
        still_referenced = (
            db.query(AuditLogEntry.id).filter(AuditLogEntry.actor_user_id == user.id).first() is not None
        )
        if not still_referenced:
            db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
        else:
            user.purge_after = None
        db.add(AccountPurgeRecord(kind="user", subject_id=user.id, deleted_at=deleted_at, purged_at=now))
        counts["user"] += 1

    return counts
