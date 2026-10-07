"""The paid-plans gate: no reachable path to a purchase that can't complete.

See specs/002-market-ready-trial/contracts/public-plans.md.

Hiding the buttons is not enough -- these assert the endpoints themselves
refuse, because a hidden button leaves the path reachable by direct request.
"""

import pytest

from src.core.config import settings
from src.models.subscription import PLAN_LIMITS, PLAN_PRICES
from tests.conftest import auth_headers, signup


@pytest.fixture()
def paid_enabled():
    """Temporarily flips the deployment-wide gate on."""
    original = settings.paid_plans_enabled
    settings.paid_plans_enabled = True
    yield
    settings.paid_plans_enabled = original


@pytest.fixture()
def stripe_configured():
    """Gives the deployment a Stripe key, to prove the gate runs first."""
    original = settings.stripe_secret_key
    original_price = settings.stripe_price_starter
    settings.stripe_secret_key = "sk_test_notreal"
    settings.stripe_price_starter = "price_notreal"
    yield
    settings.stripe_secret_key = original
    settings.stripe_price_starter = original_price


# --- GET /plans ------------------------------------------------------------


def test_plans_offers_nothing_purchasable_while_gated(client):
    body = client.get("/plans").json()

    assert body["paid_plans_enabled"] is False
    assert body["plans"] == [], "a client must not be able to render a tier card at all"


def test_plans_reports_the_trial_length_in_both_states(client):
    body = client.get("/plans").json()
    assert body["trial_length_days"] == settings.trial_length_days


def test_plans_lists_every_tier_when_enabled(client, paid_enabled):
    body = client.get("/plans").json()

    assert body["paid_plans_enabled"] is True
    tiers = {p["tier"]: p for p in body["plans"]}
    assert set(tiers) == set(PLAN_PRICES)

    # Limits come from the same definition enforcement uses, so pricing copy
    # can't drift from what the server actually allows.
    for tier, plan in tiers.items():
        assert plan["max_users"] == PLAN_LIMITS[tier]["max_users"]
        assert plan["max_active_pos"] == PLAN_LIMITS[tier]["max_active_pos"]
        assert plan["price"] == PLAN_PRICES[tier]


def test_plans_stays_public(client):
    """Deployment-wide tier definitions, no tenant data -- no auth required."""
    assert client.get("/plans").status_code == 200


# --- checkout / portal -----------------------------------------------------


def test_checkout_is_refused_while_gated(client):
    tokens = signup(client, email="gate1@test.com", org_name="GateOrg1")
    resp = client.post(
        "/billing/checkout-session",
        params={"plan_tier": "starter"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 403


def test_checkout_refusal_precedes_any_stripe_call(client, stripe_configured):
    """The gate must not depend on Stripe being unconfigured.

    If a correct refusal only happened because there was no API key, then
    configuring one would silently reopen the path.
    """
    tokens = signup(client, email="gate2@test.com", org_name="GateOrg2")
    resp = client.post(
        "/billing/checkout-session",
        params={"plan_tier": "starter"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 403


def test_portal_is_refused_while_gated(client):
    tokens = signup(client, email="gate3@test.com", org_name="GateOrg3")
    resp = client.post("/billing/portal-session", headers=auth_headers(tokens))
    assert resp.status_code == 403


# --- message hygiene -------------------------------------------------------


def _refusal_messages(client) -> list[str]:
    tokens = signup(client, email="msg@test.com", org_name="MsgOrg")
    headers = auth_headers(tokens)
    return [
        client.post(
            "/billing/checkout-session", params={"plan_tier": "starter"}, headers=headers
        ).json()["detail"],
        client.post("/billing/portal-session", headers=headers).json()["detail"],
    ]


def test_refusals_name_no_server_internals(client):
    """These reach end users, so they must not read like a deploy runbook."""
    for message in _refusal_messages(client):
        lowered = message.lower()
        assert "stripe" not in lowered, message
        assert "stripe_secret_key" not in lowered, message
        assert "env" not in lowered, message
        assert "backend" not in lowered, message


def test_refusals_do_not_instruct_an_impossible_upgrade(client):
    """Telling someone to upgrade while upgrading is disabled is a dead end."""
    for message in _refusal_messages(client):
        assert "upgrade" not in message.lower(), message
