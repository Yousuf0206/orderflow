from datetime import UTC, datetime, timedelta
from typing import Literal

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from src.core.config import settings
from src.core.db import get_db
from src.models.membership import Membership
from src.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

# bcrypt only uses the first 72 bytes of the input; truncate explicitly rather
# than let longer passwords silently differ only in their ignored tail.
_MAX_BCRYPT_BYTES = 72


def hash_password(password: str) -> str:
    raw = password.encode("utf-8")[:_MAX_BCRYPT_BYTES]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    raw = password.encode("utf-8")[:_MAX_BCRYPT_BYTES]
    return bcrypt.checkpw(raw, password_hash.encode("utf-8"))


def create_token(subject: str, token_type: Literal["access", "refresh"]) -> str:
    now = datetime.now(UTC)
    if token_type == "access":
        expires = now + timedelta(minutes=settings.access_token_expire_minutes)
    else:
        expires = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": subject, "type": token_type, "iat": now, "exp": expires}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc


class CurrentUser:
    """Resolved identity for the request: the User plus (if any) their
    Membership in the organization implied by the token. Super Admins may have
    no Membership at all.
    """

    def __init__(self, user: User, membership: Membership | None):
        self.user = user
        self.membership = membership

    @property
    def organization_id(self) -> str | None:
        return self.membership.organization_id if self.membership else None

    @property
    def role(self) -> str | None:
        return self.membership.role if self.membership else None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing credentials")
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    user = db.get(User, payload["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    membership = None
    if not user.is_super_admin:
        membership = (
            db.query(Membership)
            .filter(Membership.user_id == user.id, Membership.accepted_at.isnot(None))
            .first()
        )
        if membership is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No active organization membership")
    return CurrentUser(user=user, membership=membership)


def require_role(*allowed_roles: str):
    """FastAPI dependency factory enforcing role-based access (Constitution
    Principle V). Enforcement happens server-side here, never only in the UI.
    """

    def _dependency(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current.role not in allowed_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role for this action")
        return current

    return _dependency


def require_super_admin(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not current.user.is_super_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super admin access required")
    return current
