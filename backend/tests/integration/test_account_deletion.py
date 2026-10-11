"""Account deletion (spec 007 FR-012, Option A) and the purge that completes it.

Constitution VII exception: the click soft-deletes and revokes; only the purge
job removes data, never before 30 days, and only what the deletion covered.
"""

from datetime import UTC, datetime, timedelta

from src.core.config import settings
from src.core.db import get_db
from src.main import app
from src.models.account_purge import AccountPurgeRecord
from src.models.organization import Organization
from src.models.purchase_order import PurchaseOrder
from src.models.user import User
from src.services.account_deletion import purge_due
from tests.conftest import accept_invite, auth_headers, signup


def _db():
    return next(app.dependency_overrides[get_db]())


def _org_with_po(client, email="owner@deltest.com", org="Del Org"):
    tokens = signup(client, email=email, org_name=org)
    headers = auth_headers(tokens)
    party = client.post("/parties", json={"party_code": "P1", "party_name": "Party"}, headers=headers).json()
    client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": "PO-1",
            "order_date": "2026-10-01",
            "due_date": "2027-01-01",
            "lines": [{"material": "Steel", "ordered_qty": 10, "unit": "ton"}],
        },
        headers=headers,
    )
    return tokens, headers


def _invite(client, owner_headers, email, role="staff"):
    resp = client.post("/org/members/invite", json={"email": email, "role": role}, headers=owner_headers)
    assert resp.status_code == 201, resp.text
    return auth_headers(accept_invite(client, resp.json()["id"]))


def test_staff_deletion_leaves_the_organization_working(client):
    _, owner = _org_with_po(client)
    staff = _invite(client, owner, "staff@deltest.com")

    preview = client.get("/auth/account/deletion-preview", headers=staff).json()
    assert preview["role_effect"] == "member"
    assert preview["organizations_deleted"] == []
    assert preview["purge_after_days"] == 30

    resp = client.request("DELETE", "/auth/account", json={}, headers=staff)
    assert resp.status_code == 200, resp.text

    assert client.get("/auth/me", headers=staff).status_code == 401
    assert client.post("/auth/login", json={"email": "staff@deltest.com", "password": "password123"}).status_code == 401
    # The owner and the records are untouched.
    assert len(client.get("/purchase-orders", headers=owner).json()) == 1
    members = client.get("/org/members", headers=owner).json()
    assert "staff@deltest.com" not in str(members)


def test_owner_deletion_requires_typing_the_organization_name(client):
    _, owner = _org_with_po(client)
    preview = client.get("/auth/account/deletion-preview", headers=owner).json()
    assert preview["role_effect"] == "owner"
    assert preview["organizations_deleted"][0]["name"] == "Del Org"

    wrong = client.request("DELETE", "/auth/account", json={"confirm_organization_names": ["Nope"]}, headers=owner)
    assert wrong.status_code == 422
    empty = client.request("DELETE", "/auth/account", json={}, headers=owner)
    assert empty.status_code == 422
    # Nothing changed.
    assert client.get("/auth/me", headers=owner).status_code == 200


def test_owner_deletion_locks_every_member_out_at_once(client):
    owner_tokens, owner = _org_with_po(client)
    staff = _invite(client, owner, "staff2@deltest.com")
    resp = client.request(
        "DELETE", "/auth/account", json={"confirm_organization_names": ["Del Org"]}, headers=owner
    )
    assert resp.status_code == 200
    assert client.get("/auth/me", headers=owner).status_code == 401
    assert client.get("/purchase-orders", headers=staff).status_code == 403
    # Refresh tokens stop working too.
    assert client.post("/auth/refresh", json={"refresh_token": owner_tokens["refresh_token"]}).status_code == 401


def test_co_owned_organization_survives_one_owner_leaving(client):
    _, owner = _org_with_po(client)
    co_owner = _invite(client, owner, "co@deltest.com", role="owner")
    preview = client.get("/auth/account/deletion-preview", headers=owner).json()
    assert preview["role_effect"] == "member"
    assert client.request("DELETE", "/auth/account", json={}, headers=owner).status_code == 200
    assert len(client.get("/purchase-orders", headers=co_owner).json()) == 1


def test_same_email_can_sign_up_again_as_a_new_account(client):
    _, staff_owner = _org_with_po(client, email="again@deltest.com", org="Again Org")
    client.request("DELETE", "/auth/account", json={"confirm_organization_names": ["Again Org"]}, headers=staff_owner)
    fresh = signup(client, email="again@deltest.com", org_name="Fresh Org")
    headers = auth_headers(fresh)
    assert client.get("/purchase-orders", headers=headers).json() == []
    assert client.get("/auth/me", headers=headers).json()["organization"]["name"] == "Fresh Org"


def test_purge_waits_thirty_days_then_removes_only_what_was_deleted(client):
    _, owner = _org_with_po(client, email="p1@deltest.com", org="Purge Org")
    _, keep = _org_with_po(client, email="p2@deltest.com", org="Keep Org")
    client.request("DELETE", "/auth/account", json={"confirm_organization_names": ["Purge Org"]}, headers=owner)

    db = _db()
    org = db.query(Organization).filter(Organization.name == "Purge Org").one()
    org_id, deleted_at = org.id, org.deleted_at

    # Day 29: nothing goes.
    assert purge_due(db, now=deleted_at + timedelta(days=29)) == {"organization": 0, "user": 0}
    db.commit()
    assert db.get(Organization, org_id) is not None

    # Day 30: the deleted organization and its records go; the other stays.
    counts = purge_due(db, now=deleted_at + timedelta(days=30, minutes=1))
    db.commit()
    assert counts == {"organization": 1, "user": 1}
    assert db.get(Organization, org_id) is None
    assert db.query(PurchaseOrder).filter(PurchaseOrder.organization_id == org_id).count() == 0
    assert len(client.get("/purchase-orders", headers=keep).json()) == 1

    kinds = sorted(r.kind for r in db.query(AccountPurgeRecord).all())
    assert kinds == ["organization", "user"]
    # The record holds ids and dates only.
    assert not hasattr(AccountPurgeRecord, "email")


def test_purged_member_with_audit_history_keeps_only_a_bare_id(client):
    _, owner = _org_with_po(client, email="o3@deltest.com", org="History Org")
    staff = _invite(client, owner, "hist@deltest.com")
    party = client.post("/parties", json={"party_code": "S1", "party_name": "Staff-made"}, headers=owner).json()
    assert party["id"]
    me = client.get("/auth/me", headers=staff).json()
    client.request("DELETE", "/auth/account", json={}, headers=staff)

    db = _db()
    user = db.get(User, me["user"]["id"])
    assert user.email.endswith("@deleted.invalid")
    assert user.password_hash == ""
    purge_due(db, now=datetime.now(UTC) + timedelta(days=31))
    db.commit()
    # No audit rows reference the staff user here, so the row itself goes.
    assert db.get(User, me["user"]["id"]) is None


def test_cron_endpoint_refuses_without_a_configured_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "")
    assert client.get("/internal/purge-deleted-accounts").status_code == 503
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    assert client.get("/internal/purge-deleted-accounts").status_code == 401
    assert client.get("/internal/purge-deleted-accounts", headers={"Authorization": "Bearer wrong"}).status_code == 401
    ok = client.get("/internal/purge-deleted-accounts", headers={"Authorization": "Bearer s3cret"})
    assert ok.status_code == 200
    assert ok.json() == {"purged": {"organization": 0, "user": 0}}


def test_app_origins_are_allowed_and_others_are_not(client):
    for origin in ("capacitor://localhost", "https://localhost"):
        resp = client.options(
            "/auth/login", headers={"Origin": origin, "Access-Control-Request-Method": "POST"}
        )
        assert resp.headers.get("access-control-allow-origin") == origin
    other = client.options(
        "/auth/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    )
    assert other.headers.get("access-control-allow-origin") is None
