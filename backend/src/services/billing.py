from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from src.models.membership import Membership
from src.models.purchase_order import PurchaseOrder
from src.models.subscription import PLAN_LIMITS, Subscription


def get_or_create_subscription(db: Session, organization_id: str) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.organization_id == organization_id).first()
    if sub is None:
        limits = PLAN_LIMITS["trial"]
        sub = Subscription(
            organization_id=organization_id,
            plan_tier="trial",
            max_users=limits["max_users"],
            max_active_pos=limits["max_active_pos"],
        )
        db.add(sub)
        db.flush()
    return sub


def apply_plan(db: Session, sub: Subscription, plan_tier: str) -> None:
    limits = PLAN_LIMITS[plan_tier]
    sub.plan_tier = plan_tier
    sub.max_users = limits["max_users"]
    sub.max_active_pos = limits["max_active_pos"]
    sub.is_read_only_locked = False


def count_users(db: Session, organization_id: str) -> int:
    """Seats in use. Shared by enforcement and by the usage figures shown on
    Billing -- if the two counted differently, the UI could say "2 of 3" to
    someone the server is already refusing.
    """
    return db.query(Membership).filter(Membership.organization_id == organization_id).count()


def count_active_pos(db: Session, organization_id: str) -> int:
    """Counts every purchase order that hasn't been soft-deleted.

    Note the name overstates it: this is NOT filtered by status, so fully
    dispatched orders count against `max_active_pos` too. That is the limit
    actually enforced, so user-facing copy must say "purchase orders" rather
    than "active purchase orders" -- promising that completed orders don't
    count would be false. Narrowing the count to genuinely open orders would
    loosen the limit, which is a product decision, not a wording fix.

    Same single-definition reason as count_users above.
    """
    return (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.organization_id == organization_id, PurchaseOrder.deleted_at.is_(None))
        .count()
    )


def enforce_usage_limits(db: Session, organization_id: str, *, adding_user: bool = False, adding_po: bool = False) -> None:
    sub = get_or_create_subscription(db, organization_id)
    # These messages are shown to the user verbatim, so they state the limit
    # that stopped them and nothing they can't act on. "Upgrade to add more"
    # was a dead end while paid plans are closed -- and the number is
    # interpolated from the subscription row, never written into the copy, so
    # it is always the figure actually being enforced.
    if adding_user and count_users(db, organization_id) >= sub.max_users:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"User limit reached — your {sub.plan_tier} includes {sub.max_users} users. "
            "Remove a member to free up a seat, or get in touch and we'll raise it.",
        )
    if adding_po and count_active_pos(db, organization_id) >= sub.max_active_pos:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Purchase order limit reached — your {sub.plan_tier} includes "
            f"{sub.max_active_pos} purchase orders. Get in touch and we'll raise it.",
        )


def check_trial_expiry(db: Session, sub: Subscription) -> None:
    """FR-021: switch to read-only lockout once trial ends without upgrade."""
    if sub.plan_tier != "trial" or sub.trial_ends_at is None:
        return
    trial_ends_at = sub.trial_ends_at
    if trial_ends_at.tzinfo is None:
        # SQLite (used in tests) round-trips DateTime(timezone=True) columns
        # as naive; Postgres (production) keeps them aware. Values are
        # always written in UTC (see signup), so naive == UTC here.
        trial_ends_at = trial_ends_at.replace(tzinfo=UTC)
    if trial_ends_at < datetime.now(UTC):
        sub.is_read_only_locked = True
