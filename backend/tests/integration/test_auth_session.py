from datetime import UTC, datetime, timedelta

from jose import jwt

from src.core.config import settings
from tests.conftest import auth_headers, signup


def _expired_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": datetime.now(UTC) - timedelta(minutes=60),
        "exp": datetime.now(UTC) - timedelta(minutes=30),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def test_expired_access_token_is_rejected(client):
    tokens = signup(client, email="expiry@test.com")
    valid_payload = jwt.decode(tokens["access_token"], settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    expired = _expired_access_token(valid_payload["sub"])

    resp = client.get("/dashboard", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


def test_refresh_token_issues_a_working_new_access_token(client):
    tokens = signup(client, email="refresh@test.com")

    resp = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 200
    new_tokens = resp.json()
    assert new_tokens["access_token"]

    check = client.get("/dashboard", headers=auth_headers(new_tokens))
    assert check.status_code == 200


def test_access_token_rejected_as_a_refresh_token(client):
    tokens = signup(client, email="wrongtype@test.com")

    resp = client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert resp.status_code == 401
