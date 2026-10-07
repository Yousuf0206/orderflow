from fastapi import APIRouter

from src.models.subscription import PLAN_LIMITS, PLAN_PRICES

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("")
def list_plans() -> list[dict]:
    """Public, unauthenticated plan list for the marketing Pricing page --
    sourced from the same PLAN_LIMITS used by signup and billing, so pricing
    copy can't silently drift from what the API actually enforces.
    """
    return [
        {
            "tier": tier,
            "price": PLAN_PRICES[tier],
            "max_users": limits["max_users"],
            "max_active_pos": limits["max_active_pos"],
        }
        for tier, limits in PLAN_LIMITS.items()
        if tier in PLAN_PRICES
    ]
