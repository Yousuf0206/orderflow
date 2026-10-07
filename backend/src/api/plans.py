from fastapi import APIRouter

from src.core.config import settings
from src.models.subscription import PLAN_LIMITS, PLAN_PRICES

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("")
def list_plans() -> dict:
    """Public, unauthenticated plan information for the marketing Pricing page.

    Returns an object rather than a bare list so the trial length travels with
    it -- the Pricing page needs that number and is served to anonymous
    visitors, who have no /billing to read it from.

    `plans` is empty whenever paid plans are gated off. Empty rather than
    flagged-but-populated: a client then cannot render a purchasable tier even
    by ignoring the flag, so the page can't offer a checkout that would be
    refused. Tier limits stay enforced server-side regardless; this withholds
    display, not enforcement.
    """
    plans = (
        [
            {
                "tier": tier,
                "price": PLAN_PRICES[tier],
                "max_users": limits["max_users"],
                "max_active_pos": limits["max_active_pos"],
            }
            for tier, limits in PLAN_LIMITS.items()
            if tier in PLAN_PRICES
        ]
        if settings.paid_plans_enabled
        else []
    )

    return {
        "paid_plans_enabled": settings.paid_plans_enabled,
        # Single source for every stated trial length, so marketing copy and
        # what signup actually grants cannot disagree.
        "trial_length_days": settings.trial_length_days,
        "plans": plans,
    }
