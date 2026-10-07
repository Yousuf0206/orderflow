from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base import TimestampMixin, new_uuid

PLAN_LIMITS = {
    "trial": {"max_users": 3, "max_active_pos": 25},
    "starter": {"max_users": 5, "max_active_pos": 100},
    "business": {"max_users": 20, "max_active_pos": 1000},
    "pro": {"max_users": 1_000_000, "max_active_pos": 1_000_000},
}

# Display-only list price per paid tier (not wired to Stripe, which only
# deals in opaque price IDs). Single source for the public /plans endpoint
# and the marketing Pricing page, so the two can't drift independently.
PLAN_PRICES = {
    "starter": "$29/mo",
    "business": "$79/mo",
    "pro": "$199/mo",
}


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id"), unique=True, index=True
    )
    plan_tier: Mapped[str] = mapped_column(String(20), default="trial")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), default=None)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(100), default=None)
    max_users: Mapped[int] = mapped_column(Integer, default=PLAN_LIMITS["trial"]["max_users"])
    max_active_pos: Mapped[int] = mapped_column(
        Integer, default=PLAN_LIMITS["trial"]["max_active_pos"]
    )
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    is_read_only_locked: Mapped[bool] = mapped_column(Boolean, default=False)
