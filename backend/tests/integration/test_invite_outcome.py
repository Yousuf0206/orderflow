"""An invitation must report what actually happened to its email.

Covers spec FR-026 to FR-030 and contracts/invite-outcome.md. The defect being
closed: `send_email` returned None on every path, including the one that only
logs because no mail service is configured, so the team screen told owners an
invitation had been emailed when the link had gone to a server log and nowhere
else -- and the owner waited two days.
"""

import smtplib

import pytest

from src.core.config import settings
from src.models.membership import Membership
from src.services import email as email_service
from tests.conftest import auth_headers, signup


@pytest.fixture()
def no_smtp(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", "", raising=False)


def _invite(client, headers, address="colleague@test.com", role="staff"):
    return client.post("/org/members/invite", json={"email": address, "role": role}, headers=headers)


def test_unconfigured_mail_is_reported_as_not_sent_with_a_link(client, no_smtp):
    headers = auth_headers(signup(client, email="i1@test.com", org_name="Invite Org 1"))
    resp = _invite(client, headers)
    assert resp.status_code == 201, resp.text

    body = resp.json()
    assert body["email_outcome"] == "not_configured"
    assert body["invitation_email_sent_at"] is None
    assert body["invitation_link"]
    assert "/accept-invite?token=" in body["invitation_link"]
    assert body["accepted"] is False


def test_the_offered_link_actually_works(client, no_smtp):
    """FR-027 is only satisfied if the link an owner passes on gets their
    colleague in."""
    headers = auth_headers(signup(client, email="i2@test.com", org_name="Invite Org 2"))
    link = _invite(client, headers).json()["invitation_link"]
    token = link.split("token=", 1)[1]

    accepted = client.post(
        "/auth/invite/accept", json={"token": token, "password": "password123"}
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["access_token"]


def test_successful_send_sets_the_timestamp_and_offers_no_link(client, monkeypatch):
    monkeypatch.setattr(email_service, "send_email", lambda **kwargs: "sent")
    import src.api.org as org_api

    monkeypatch.setattr(org_api, "send_email", lambda **kwargs: "sent")

    headers = auth_headers(signup(client, email="i3@test.com", org_name="Invite Org 3"))
    body = _invite(client, headers).json()

    assert body["email_outcome"] == "sent"
    assert body["invitation_email_sent_at"] is not None
    assert body["invitation_link"] is None


def test_a_failed_send_is_not_reported_as_sent_and_stays_usable(client, monkeypatch):
    """FR-029. A failed email must not discard a valid invitation."""
    import src.api.org as org_api

    monkeypatch.setattr(org_api, "send_email", lambda **kwargs: "failed")

    headers = auth_headers(signup(client, email="i4@test.com", org_name="Invite Org 4"))
    resp = _invite(client, headers)
    assert resp.status_code == 201, resp.text

    body = resp.json()
    assert body["email_outcome"] == "failed"
    assert body["invitation_email_sent_at"] is None
    assert body["invitation_link"]

    token = body["invitation_link"].split("token=", 1)[1]
    accepted = client.post(
        "/auth/invite/accept", json={"token": token, "password": "password123"}
    )
    assert accepted.status_code == 200


def test_send_email_reports_failure_rather_than_raising(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", "127.0.0.1", raising=False)
    monkeypatch.setattr(settings, "smtp_port", 1, raising=False)

    def boom(*args, **kwargs):
        raise smtplib.SMTPConnectError(421, "nope")

    monkeypatch.setattr(smtplib, "SMTP", boom)
    assert email_service.send_email(to="a@b.com", subject="s", body="b") == "failed"


def test_send_email_reports_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", "", raising=False)
    assert email_service.send_email(to="a@b.com", subject="s", body="b") == "not_configured"


def test_member_list_exposes_whether_an_email_was_sent(client, no_smtp):
    headers = auth_headers(signup(client, email="i5@test.com", org_name="Invite Org 5"))
    _invite(client, headers)

    members = client.get("/org/members", headers=headers).json()
    invited = [m for m in members if m["email"] == "colleague@test.com"]
    assert len(invited) == 1
    assert invited[0]["accepted"] is False
    assert invited[0]["invitation_email_sent_at"] is None


def test_resend_mints_a_fresh_working_link(client, no_smtp):
    headers = auth_headers(signup(client, email="i6@test.com", org_name="Invite Org 6"))
    membership_id = _invite(client, headers).json()["id"]

    resent = client.post(f"/org/members/{membership_id}/resend", headers=headers)
    assert resent.status_code == 200, resent.text
    assert resent.json()["email_outcome"] == "not_configured"

    token = resent.json()["invitation_link"].split("token=", 1)[1]
    accepted = client.post(
        "/auth/invite/accept", json={"token": token, "password": "password123"}
    )
    assert accepted.status_code == 200


def test_resend_refuses_an_already_accepted_member(client, no_smtp):
    headers = auth_headers(signup(client, email="i7@test.com", org_name="Invite Org 7"))
    membership_id = _invite(client, headers).json()["id"]
    token = (
        client.post(f"/org/members/{membership_id}/resend", headers=headers)
        .json()["invitation_link"]
        .split("token=", 1)[1]
    )
    client.post("/auth/invite/accept", json={"token": token, "password": "password123"})

    again = client.post(f"/org/members/{membership_id}/resend", headers=headers)
    assert again.status_code == 409


def test_accepted_and_unknown_invitations_read_differently(client, no_smtp):
    """The remedies differ -- "log in instead" versus "ask for a new
    invitation" -- so one message for both is one message too few."""
    headers = auth_headers(signup(client, email="i8@test.com", org_name="Invite Org 8"))
    membership_id = _invite(client, headers).json()["id"]
    link = client.post(f"/org/members/{membership_id}/resend", headers=headers).json()[
        "invitation_link"
    ]
    token = link.split("token=", 1)[1]

    client.post("/auth/invite/accept", json={"token": token, "password": "password123"})
    reused = client.post("/auth/invite/accept", json={"token": token, "password": "password123"})
    assert reused.status_code == 400
    assert "already been accepted" in reused.json()["detail"]


def test_resend_cannot_reach_another_organizations_member(client, no_smtp):
    headers_a = auth_headers(signup(client, email="i9a@test.com", org_name="Invite Org 9a"))
    headers_b = auth_headers(signup(client, email="i9b@test.com", org_name="Invite Org 9b"))
    membership_id = _invite(client, headers_a).json()["id"]

    resp = client.post(f"/org/members/{membership_id}/resend", headers=headers_b)
    assert resp.status_code == 404


def test_membership_column_is_nullable_and_defaults_to_null(client, no_smtp):
    """data-model.md: NULL is the honest value for a membership whose email was
    never confirmed delivered, including the owner's own membership."""
    headers = auth_headers(signup(client, email="i10@test.com", org_name="Invite Org 10"))
    assert Membership.__table__.c.invitation_email_sent_at.nullable is True

    members = client.get("/org/members", headers=headers).json()
    owner = next(m for m in members if m["email"] == "i10@test.com")
    assert owner["invitation_email_sent_at"] is None
