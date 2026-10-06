from tests.conftest import auth_headers, signup


def test_signup_creates_isolated_organization(client):
    tokens_a = signup(client, email="a@test.com", org_name="Org A")
    tokens_b = signup(client, email="b@test.com", org_name="Org B")

    client.post(
        "/parties",
        json={"party_code": "P1", "party_name": "Party A"},
        headers=auth_headers(tokens_a),
    )
    client.post(
        "/parties",
        json={"party_code": "P1", "party_name": "Party B"},
        headers=auth_headers(tokens_b),
    )

    resp_a = client.get("/parties", headers=auth_headers(tokens_a))
    resp_b = client.get("/parties", headers=auth_headers(tokens_b))

    assert [p["party_name"] for p in resp_a.json()] == ["Party A"]
    assert [p["party_name"] for p in resp_b.json()] == ["Party B"]


def test_cross_tenant_po_access_returns_404(client):
    tokens_a = signup(client, email="a2@test.com", org_name="Org A2")
    tokens_b = signup(client, email="b2@test.com", org_name="Org B2")

    party = client.post(
        "/parties",
        json={"party_code": "P1", "party_name": "Party"},
        headers=auth_headers(tokens_a),
    ).json()
    po = client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": "PO-1",
            "material": "Steel",
            "ordered_qty": 100,
            "unit": "ton",
            "order_date": "2026-01-01",
            "due_date": "2026-02-01",
        },
        headers=auth_headers(tokens_a),
    ).json()

    resp = client.get(f"/purchase-orders/{po['id']}", headers=auth_headers(tokens_b))
    assert resp.status_code == 404
