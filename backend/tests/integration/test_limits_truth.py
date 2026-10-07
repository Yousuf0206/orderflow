"""Limit refusals must be readable, honest, and not instruct a dead action.

See specs/002-market-ready-trial/contracts/billing-info.md.
"""

from src.core.config import settings
from tests.conftest import auth_headers, signup


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


def _fill_to_po_limit(client, headers, party_id: str, limit: int) -> None:
    for i in range(limit):
        assert client.post("/purchase-orders", json=_po_payload(party_id, i), headers=headers).status_code == 201


def test_po_limit_refusal_is_readable_and_names_the_limit(client):
    tokens = signup(client, email="polimit2@test.com", org_name="PoLimitOrg2")
    headers = auth_headers(tokens)

    party = client.post(
        "/parties", json={"party_code": "L1", "party_name": "Limit Party"}, headers=headers
    ).json()

    limit = client.get("/billing", headers=headers).json()["max_active_pos"]
    _fill_to_po_limit(client, headers, party["id"], limit)

    resp = client.post("/purchase-orders", json=_po_payload(party["id"], 999), headers=headers)
    assert resp.status_code == 403

    detail = resp.json()["detail"]
    assert str(limit) in detail, "the refusal must name the number that stopped them"
    assert "upgrade" not in detail.lower(), "upgrading is not possible while paid plans are gated"


def test_po_limit_refusal_does_not_create_the_record(client):
    tokens = signup(client, email="polimit3@test.com", org_name="PoLimitOrg3")
    headers = auth_headers(tokens)

    party = client.post(
        "/parties", json={"party_code": "L2", "party_name": "Limit Party 2"}, headers=headers
    ).json()

    limit = client.get("/billing", headers=headers).json()["max_active_pos"]
    _fill_to_po_limit(client, headers, party["id"], limit)
    client.post("/purchase-orders", json=_po_payload(party["id"], 999), headers=headers)

    after = client.get("/billing", headers=headers).json()
    assert after["current_active_pos"] == limit, "a refused create must not have been persisted"


def test_user_limit_refusal_is_readable_and_names_the_limit(client):
    tokens = signup(client, email="ulimit@test.com", org_name="ULimitOrg")
    headers = auth_headers(tokens)

    limit = client.get("/billing", headers=headers).json()["max_users"]

    # Owner already occupies one seat.
    for i in range(limit - 1):
        resp = client.post(
            "/org/members/invite",
            json={"email": f"member{i}@ulimit.example.com", "role": "staff"},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text

    over = client.post(
        "/org/members/invite",
        json={"email": "one-too-many@ulimit.example.com", "role": "staff"},
        headers=headers,
    )
    assert over.status_code == 403

    detail = over.json()["detail"]
    assert str(limit) in detail
    assert "upgrade" not in detail.lower()


def test_user_limit_refusal_does_not_create_the_member(client):
    tokens = signup(client, email="ulimit2@test.com", org_name="ULimitOrg2")
    headers = auth_headers(tokens)

    limit = client.get("/billing", headers=headers).json()["max_users"]
    for i in range(limit - 1):
        client.post(
            "/org/members/invite",
            json={"email": f"m{i}@ulimit2.example.com", "role": "staff"},
            headers=headers,
        )

    client.post(
        "/org/members/invite",
        json={"email": "rejected@ulimit2.example.com", "role": "staff"},
        headers=headers,
    )

    after = client.get("/billing", headers=headers).json()
    assert after["current_users"] == limit


def test_refusals_read_as_plain_language(client):
    """No status codes, field paths, or server internals in what a user reads."""
    tokens = signup(client, email="plain@test.com", org_name="PlainOrg")
    headers = auth_headers(tokens)

    party = client.post(
        "/parties", json={"party_code": "PL", "party_name": "Plain Party"}, headers=headers
    ).json()
    limit = client.get("/billing", headers=headers).json()["max_active_pos"]
    _fill_to_po_limit(client, headers, party["id"], limit)

    detail = client.post(
        "/purchase-orders", json=_po_payload(party["id"], 999), headers=headers
    ).json()["detail"]

    for forbidden in ("403", "max_active_pos", "Traceback", "None", "null"):
        assert forbidden not in detail, f"{forbidden!r} leaked into a user-facing message: {detail}"


# --- trial length coupling -------------------------------------------------


def test_trial_length_is_reported_from_the_configured_value(client):
    original = settings.trial_length_days
    settings.trial_length_days = 21
    try:
        assert client.get("/plans").json()["trial_length_days"] == 21
    finally:
        settings.trial_length_days = original


def test_signup_grants_the_configured_trial_length(client):
    """Public copy and the granted trial must move together (SC-004a)."""
    from datetime import UTC, datetime

    original = settings.trial_length_days
    settings.trial_length_days = 21
    try:
        tokens = signup(client, email="len21@test.com", org_name="Len21Org")
        body = client.get("/billing", headers=auth_headers(tokens)).json()

        ends = datetime.fromisoformat(body["trial_ends_at"].replace("Z", "")).replace(tzinfo=UTC)
        days = (ends - datetime.now(UTC)).days
        # 20 or 21 depending on where the clock falls within the day.
        assert days in (20, 21), f"expected ~21 days of trial, got {days}"

        assert body["trial_length_days"] == 21
        assert client.get("/plans").json()["trial_length_days"] == 21
    finally:
        settings.trial_length_days = original


def test_changing_trial_length_does_not_move_existing_trials(client):
    """An org's granted end date is persisted, not recomputed on read."""
    tokens = signup(client, email="stable@test.com", org_name="StableOrg")
    headers = auth_headers(tokens)
    before = client.get("/billing", headers=headers).json()["trial_ends_at"]

    original = settings.trial_length_days
    settings.trial_length_days = 60
    try:
        after = client.get("/billing", headers=headers).json()["trial_ends_at"]
        assert after == before, "an existing organization's trial end date must not shift"
    finally:
        settings.trial_length_days = original
