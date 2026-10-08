"""Team, invitations, exports, and the audit log: everything visible works.

See specs/002-market-ready-trial/spec.md User Story 5.
"""

from src.core.config import settings
from tests.conftest import accept_invite, auth_headers, invite_token, signup

# --- invitations -----------------------------------------------------------


def test_invite_creates_a_pending_member_with_visible_status(client):
    """On a default deployment SMTP is unset, so no email is delivered and the
    pending status in the member list is the whole mechanism."""
    assert settings.smtp_host == "", "this test covers the unconfigured-SMTP default"

    tokens = signup(client, email="teamowner@test.com", org_name="TeamOrg")
    headers = auth_headers(tokens)

    invited = client.post(
        "/org/members/invite",
        json={"email": "pending@example.com", "role": "staff"},
        headers=headers,
    )
    assert invited.status_code == 201, invited.text
    assert invited.json()["accepted"] is False

    members = client.get("/org/members", headers=headers).json()
    pending = next(m for m in members if m["email"] == "pending@example.com")
    assert pending["accepted"] is False, "a pending invite must be distinguishable from an active member"
    assert pending["role"] == "staff"


def test_accepting_an_invite_grants_the_invited_role(client):
    tokens = signup(client, email="roleowner@test.com", org_name="RoleOrg")
    headers = auth_headers(tokens)

    invited = client.post(
        "/org/members/invite",
        json={"email": "manager@example.com", "role": "manager"},
        headers=headers,
    ).json()

    accept_invite(client, invited["id"])

    members = client.get("/org/members", headers=headers).json()
    accepted = next(m for m in members if m["email"] == "manager@example.com")
    assert accepted["accepted"] is True
    assert accepted["role"] == "manager"


def test_a_reused_invite_is_refused_understandably(client):
    tokens = signup(client, email="reuse@test.com", org_name="ReuseOrg")
    invited = client.post(
        "/org/members/invite",
        json={"email": "once@example.com", "role": "staff"},
        headers=auth_headers(tokens),
    ).json()

    accept_invite(client, invited["id"])

    second = client.post(
        "/auth/invite/accept",
        json={"token": invite_token(invited["id"]), "password": "password456"},
    )
    assert second.status_code == 400
    detail = second.json()["detail"]
    assert "Traceback" not in detail
    assert detail.strip() != ""


def test_a_tampered_invite_token_is_refused(client):
    resp = client.post(
        "/auth/invite/accept",
        json={"token": "not-a-real-token", "password": "password123"},
    )
    assert resp.status_code in (400, 401)
    assert "Traceback" not in resp.json()["detail"]


# --- the organization always keeps an owner --------------------------------


def test_the_last_owner_cannot_remove_themselves(client):
    tokens = signup(client, email="lastowner@test.com", org_name="LastOwnerOrg")
    headers = auth_headers(tokens)

    me = client.get("/auth/me", headers=headers).json()
    members = client.get("/org/members", headers=headers).json()
    own = next(m for m in members if m["email"] == me["user"]["email"])

    resp = client.delete(f"/org/members/{own['id']}", headers=headers)
    assert resp.status_code == 400
    assert "owner" in resp.json()["detail"].lower()


def test_the_last_owner_cannot_demote_themselves(client):
    """The same guard must hold for demotion, not just deletion.

    Removal-only protection would be bypassable by changing your own role to
    staff, which empties the org of owners just as effectively.
    """
    tokens = signup(client, email="demote@test.com", org_name="DemoteOrg")
    headers = auth_headers(tokens)

    me = client.get("/auth/me", headers=headers).json()
    members = client.get("/org/members", headers=headers).json()
    own = next(m for m in members if m["email"] == me["user"]["email"])

    resp = client.patch(f"/org/members/{own['id']}", json={"role": "staff"}, headers=headers)
    assert resp.status_code == 400
    assert "owner" in resp.json()["detail"].lower()


def test_an_owner_can_step_down_once_another_owner_exists(client):
    """The guard protects the last owner, not every owner."""
    tokens = signup(client, email="two@test.com", org_name="TwoOwnerOrg")
    headers = auth_headers(tokens)

    second = client.post(
        "/org/members/invite",
        json={"email": "second-owner@example.com", "role": "owner"},
        headers=headers,
    ).json()
    accept_invite(client, second["id"])

    me = client.get("/auth/me", headers=headers).json()
    members = client.get("/org/members", headers=headers).json()
    own = next(m for m in members if m["email"] == me["user"]["email"])

    resp = client.patch(f"/org/members/{own['id']}", json={"role": "manager"}, headers=headers)
    assert resp.status_code == 200, resp.text


# --- reports and exports ---------------------------------------------------


def test_remaining_by_party_is_available(client):
    tokens = signup(client, email="rep@test.com", org_name="RepOrg")
    headers = auth_headers(tokens)

    party = client.post(
        "/parties", json={"party_code": "R1", "party_name": "Report Party"}, headers=headers
    ).json()
    po = client.post(
        "/purchase-orders",
        json={
            "party_id": party["id"],
            "po_number": "PO-R1",
            "material": "Steel",
            "ordered_qty": 100,
            "unit": "ton",
            "order_date": "2026-01-01",
            "due_date": "2027-01-01",
        },
        headers=headers,
    ).json()
    client.post(
        f"/purchase-orders/{po['id']}/dispatches",
        json={"dispatch_date": "2026-01-02", "qty": 40},
        headers=headers,
    )

    rows = client.get("/reports/remaining-by-party", headers=headers).json()
    row = next(r for r in rows if r["party_name"] == "Report Party")
    assert row["remaining_balance"] == 60, "report must agree with recorded dispatches"


def test_all_three_export_formats_produce_real_files(client):
    """None of these needs hiding -- the defect was unchecked failures, not a
    missing format."""
    tokens = signup(client, email="exp@test.com", org_name="ExpOrg")
    headers = auth_headers(tokens)

    client.post("/parties", json={"party_code": "E1", "party_name": "Exp Party"}, headers=headers)

    csv = client.get("/reports/remaining-by-party/export?format=csv", headers=headers)
    assert csv.status_code == 200
    assert "text/csv" in csv.headers["content-type"]

    xlsx = client.get("/reports/remaining-by-party/export?format=xlsx", headers=headers)
    assert xlsx.status_code == 200
    assert xlsx.content[:2] == b"PK", "xlsx is a zip container"

    pdf = client.get("/reports/remaining-by-party/export?format=pdf", headers=headers)
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")


def test_exporting_an_empty_report_is_still_a_valid_file(client):
    tokens = signup(client, email="empty@test.com", org_name="EmptyOrg")
    headers = auth_headers(tokens)

    csv = client.get("/reports/remaining-by-party/export?format=csv", headers=headers)
    assert csv.status_code == 200, "an empty report must not fail the export"


# --- audit log -------------------------------------------------------------


def test_audit_log_records_business_changes(client):
    tokens = signup(client, email="audit@test.com", org_name="AuditOrg")
    headers = auth_headers(tokens)

    client.post("/parties", json={"party_code": "A1", "party_name": "Audit Party"}, headers=headers)

    entries = client.get("/audit-log", headers=headers).json()
    assert len(entries) > 0, "creating a party must leave an audit trail"
    assert any(e["entity_type"] == "party" for e in entries)


def test_audit_log_is_empty_but_valid_for_a_fresh_org(client):
    tokens = signup(client, email="freshaudit@test.com", org_name="FreshAuditOrg")
    entries = client.get("/audit-log", headers=auth_headers(tokens)).json()
    assert isinstance(entries, list)
