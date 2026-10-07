from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.core.config import settings
from src.core.db import Base, get_db
from src.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def signup(client, email="owner@test.com", org_name="Test Org") -> dict:
    resp = client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "organization_name": org_name},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def invite_token(membership_id: str) -> str:
    """Mints the invite token the server would have emailed.

    The invite link only ever leaves the app by email, and SMTP is unset in
    tests, so there is no other way to drive the real acceptance path. Signed
    with the same secret and claims as src/api/org.py::invite_member.
    """
    return jwt.encode(
        {
            "sub": membership_id,
            "type": "invite",
            "exp": datetime.now(UTC) + timedelta(days=7),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def accept_invite(client, membership_id: str, password: str = "password123") -> dict:
    """Completes an invitation and returns the new member's token pair."""
    resp = client.post(
        "/auth/invite/accept",
        json={"token": invite_token(membership_id), "password": password},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def auth_headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}
