import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.core.config import settings
from src.core.security import require_role
from src.core.tenant import TenantContext, get_tenant_context
from src.services.billing import (
    apply_plan,
    count_active_pos,
    count_users,
    get_or_create_subscription,
)

router = APIRouter(prefix="/billing", tags=["billing"])

stripe.api_key = settings.stripe_secret_key

PRICE_IDS = {
    "starter": settings.stripe_price_starter,
    "business": settings.stripe_price_business,
    "pro": settings.stripe_price_pro,
}


@router.get("")
def get_billing(tenant: TenantContext = Depends(get_tenant_context), _ = Depends(require_role("owner"))) -> dict:
    sub = get_or_create_subscription(tenant.db, tenant.organization_id)
    return {
        "plan_tier": sub.plan_tier,
        "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "is_read_only_locked": sub.is_read_only_locked,
        "max_users": sub.max_users,
        "max_active_pos": sub.max_active_pos,
        # Usage counted by the same helpers enforcement uses, so the figures on
        # Billing can't drift from the point where creates actually get refused.
        "current_users": count_users(tenant.db, tenant.organization_id),
        "current_active_pos": count_active_pos(tenant.db, tenant.organization_id),
        "trial_length_days": settings.trial_length_days,
        "paid_plans_enabled": settings.paid_plans_enabled,
        # Whether billing management could succeed at all -- a trial org has no
        # Stripe customer, so the portal would always fail for it. The boolean
        # is all the UI needs; the customer id itself stays server-side.
        "has_billing_account": bool(sub.stripe_customer_id),
    }


@router.post("/checkout-session")
def create_checkout_session(
    plan_tier: str,
    tenant: TenantContext = Depends(get_tenant_context),
    _ = Depends(require_role("owner")),
) -> dict:
    # First, before any vendor lookup: a hidden button still leaves this
    # endpoint reachable by direct request, and the gate must not depend on
    # Stripe happening to be unconfigured -- otherwise adding a key would
    # silently reopen a checkout nobody has verified.
    if not settings.paid_plans_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Paid plans are not available yet.")
    if plan_tier not in PRICE_IDS or not PRICE_IDS[plan_tier]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown or unconfigured plan")
    if not settings.stripe_secret_key:
        # Reachable only once paid plans are deliberately enabled, so this is
        # an operator-facing misconfiguration rather than something a trial
        # user can trip over.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Checkout is temporarily unavailable. Please try again later.",
        )
    sub = get_or_create_subscription(tenant.db, tenant.organization_id)
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=sub.stripe_customer_id,
        line_items=[{"price": PRICE_IDS[plan_tier], "quantity": 1}],
        success_url=f"{settings.frontend_base_url}/billing?checkout=success",
        cancel_url=f"{settings.frontend_base_url}/billing?checkout=cancelled",
        metadata={"organization_id": tenant.organization_id, "plan_tier": plan_tier},
    )
    return {"checkout_url": session.url}


@router.post("/portal-session")
def create_portal_session(
    tenant: TenantContext = Depends(get_tenant_context),
    _ = Depends(require_role("owner")),
) -> dict:
    if not settings.paid_plans_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Billing management is not available yet.")
    sub = get_or_create_subscription(tenant.db, tenant.organization_id)
    if not sub.stripe_customer_id:
        # Doesn't tell the user to go and upgrade: while paid plans are gated
        # that's an instruction they can't act on.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "No billing account on file for this organization."
        )
    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{settings.frontend_base_url}/billing",
    )
    return {"portal_url": session.url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request) -> dict:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature") from exc

    from src.core.db import SessionLocal

    db = SessionLocal()
    try:
        data = event["data"]["object"]
        org_id = (data.get("metadata") or {}).get("organization_id")
        plan_tier = (data.get("metadata") or {}).get("plan_tier")
        if org_id and plan_tier and event["type"] in ("checkout.session.completed", "customer.subscription.updated"):
            sub = get_or_create_subscription(db, org_id)
            sub.stripe_customer_id = data.get("customer") or sub.stripe_customer_id
            sub.stripe_subscription_id = data.get("subscription") or sub.stripe_subscription_id
            apply_plan(db, sub, plan_tier)
            db.commit()
    finally:
        db.close()
    return {"received": True}
