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


def enforce_usage_limits(db: Session, organization_id: str, *, adding_user: bool = False, adding_po: bool = False) -> None:
    sub = get_or_create_subscription(db, organization_id)
    if adding_user:
        current_users = db.query(Membership).filter(Membership.organization_id == organization_id).count()
        if current_users >= sub.max_users:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"User limit ({sub.max_users}) reached for the {sub.plan_tier} plan. Upgrade to add more users.",
            )
    if adding_po:
        current_pos = (
            db.query(PurchaseOrder)
            .filter(PurchaseOrder.organization_id == organization_id, PurchaseOrder.deleted_at.is_(None))
            .count()
        )
        if current_pos >= sub.max_active_pos:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Active PO limit ({sub.max_active_pos}) reached for the {sub.plan_tier} plan. Upgrade to add more.",
            )


def check_trial_expiry(db: Session, sub: Subscription) -> None:
    """FR-021: switch to read-only lockout once trial ends without upgrade."""
    if sub.plan_tier == "trial" and sub.trial_ends_at and sub.trial_ends_at < datetime.now(UTC):
        sub.is_read_only_locked = True
