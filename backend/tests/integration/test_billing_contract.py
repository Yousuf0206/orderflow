"""Contract tests for GET /billing as the single source of displayed limits.

See specs/002-market-ready-trial/contracts/billing-info.md.
"""

from src.models.subscription import PLAN_LIMITS
from tests.conftest import accept_invite, auth_headers, signup


def _po_payload(party_id: str, n: int) -> dict:
    return {
        "party_id": party_id,
        "po_number": f"PO-{n}",
        "material": "Steel",
        "ordered_qty": 10,
        "unit": "ton",
        "order_date": "2026-01-01",
        "due_date": "2027-01-01",
    }


def test_billing_exposes_every_contract_field(client):
    tokens = signup(client, email="contract@test.com", org_name="ContractOrg")
    body = client.get("/billing", headers=auth_headers(tokens)).json()

    for field in (
        "plan_tier",
        "trial_ends_at",
        "is_read_only_locked",
        "max_users",
        "max_active_pos",
        "current_users",
        "current_active_pos",
        "trial_length_days",
        "paid_plans_enabled",
        "has_billing_account",
    ):
        assert field in body, f"{field} missing from GET /billing"


def test_limits_come_from_the_subscription_row(client):
    """Displayed limits must be this organization's enforced limits, not copy."""
    tokens = signup(client, email="limits@test.com", org_name="LimitsOrg")
    body = client.get("/billing", headers=auth_headers(tokens)).json()

    assert body["plan_tier"] == "trial"
    assert body["max_users"] == PLAN_LIMITS["trial"]["max_users"]
    assert body["max_active_pos"] == PLAN_LIMITS["trial"]["max_active_pos"]


def test_usage_counts_agree_with_where_enforcement_blocks(client):
    """The count shown must be the count enforced against.

    If display counted differently from enforcement, a user could read "24 of
    25" and still be refused -- the drift this field exists to prevent.
    """
    tokens = signup(client, email="usage@test.com", org_name="UsageOrg")
    headers = auth_headers(tokens)

    party = client.post(
        "/parties", json={"party_code": "U1", "party_name": "Usage Party"}, headers=headers
    ).json()

    limit = client.get("/billing", headers=headers).json()["max_active_pos"]

    for i in range(limit):
        assert client.post("/purchase-orders", json=_po_payload(party["id"], i), headers=headers).status_code == 201

    body = client.get("/billing", headers=headers).json()
    assert body["current_active_pos"] == limit, "displayed usage disagrees with what was created"

    # At exactly the displayed count, the next create must be refused -- i.e.
    # the number shown is the number that stops you.
    refused = client.post("/purchase-orders", json=_po_payload(party["id"], 999), headers=headers)
    assert refused.status_code == 403


def test_current_users_starts_at_one_for_a_new_org(client):
    tokens = signup(client, email="solo@test.com", org_name="SoloOrg")
    body = client.get("/billing", headers=auth_headers(tokens)).json()
    assert body["current_users"] == 1


def test_trial_org_has_no_billing_account(client):
    """Decides FR-007: a portal control would always fail for a trial org."""
    tokens = signup(client, email="nostripe@test.com", org_name="NoStripeOrg")
    body = client.get("/billing", headers=auth_headers(tokens)).json()
    assert body["has_billing_account"] is False


def test_billing_never_leaks_the_stripe_customer_id(client):
    """has_billing_account carries the decision; the identifier stays server-side."""
    tokens = signup(client, email="noleak@test.com", org_name="NoLeakOrg")
    body = client.get("/billing", headers=auth_headers(tokens)).json()

    assert "stripe_customer_id" not in body
    assert "has_billing_account" in body


def test_billing_is_owner_only(client):
    """Principle V: authorization stays server-side, not hidden in the UI."""
    owner = signup(client, email="owner2@test.com", org_name="RbacOrg")

    invite = client.post(
        "/org/members/invite",
        json={"email": "staff2@test.com", "role": "staff"},
        headers=auth_headers(owner),
    )
    assert invite.status_code == 201, invite.text

    staff_tokens = accept_invite(client, invite.json()["id"])
    resp = client.get("/billing", headers=auth_headers(staff_tokens))
    assert resp.status_code == 403
