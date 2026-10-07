from tests.conftest import auth_headers, signup


def test_active_po_limit_is_enforced_for_trial_plan(client):
    """Trial plan caps max_active_pos at 25 (PLAN_LIMITS)."""
    tokens = signup(client, email="polimit@test.com", org_name="PoLimitOrg")
    headers = auth_headers(tokens)

    party = client.post(
        "/parties", json={"party_code": "P1", "party_name": "Limit Party"}, headers=headers
    ).json()

    for i in range(25):
        resp = client.post(
            "/purchase-orders",
            json={
                "party_id": party["id"],
                "po_number": f"PO-{i}",
                "material": "Steel",
                "ordered_qty": 10,
                "unit": "ton",
                "order_date": "2026-01-01",
                "due_date": "2027-01-01",
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text

    over_limit = client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": "PO-OVER",
            "material": "Steel",
            "ordered_qty": 10,
            "unit": "ton",
            "order_date": "2026-01-01",
            "due_date": "2027-01-01",
        },
        headers=headers,
    )
    assert over_limit.status_code == 403
    assert "limit" in over_limit.json()["detail"].lower()


def test_user_limit_is_enforced_for_trial_plan(client):
    """Trial plan caps max_users at 3 (PLAN_LIMITS): owner + 2 invites succeed, 3rd is rejected."""
    tokens = signup(client, email="userlimit@test.com", org_name="UserLimitOrg")
    headers = auth_headers(tokens)

    for email in ["invitee1@test.com", "invitee2@test.com"]:
        resp = client.post("/org/members/invite", json={"email": email, "role": "staff"}, headers=headers)
        assert resp.status_code == 201, resp.text

    over_limit = client.post(
        "/org/members/invite", json={"email": "invitee3@test.com", "role": "staff"}, headers=headers
    )
    assert over_limit.status_code == 403
    assert "limit" in over_limit.json()["detail"].lower()
