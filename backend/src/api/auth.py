from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy.orm import Session

from src.core.config import settings
from src.core.db import get_db
from src.core.security import (
    CurrentUser,
    create_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from src.models.membership import Membership
from src.models.organization import Organization
from src.models.subscription import PLAN_LIMITS, Subscription
from src.models.user import User
from src.schemas.auth import (
    InviteAcceptRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    SignupRequest,
    TokenPair,
)
from src.services.email import send_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> TokenPair:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()

    trial_ends_at = datetime.now(UTC) + timedelta(days=settings.trial_length_days)
    org = Organization(name=payload.organization_name, plan_tier="trial", trial_ends_at=trial_ends_at)
    db.add(org)
    db.flush()

    membership = Membership(
        organization_id=org.id,
        user_id=user.id,
        role="owner",
        invited_at=datetime.now(UTC),
        accepted_at=datetime.now(UTC),
    )
    db.add(membership)

    limits = PLAN_LIMITS["trial"]
    db.add(
        Subscription(
            organization_id=org.id,
            plan_tier="trial",
            trial_ends_at=trial_ends_at,
            max_users=limits["max_users"],
            max_active_pos=limits["max_active_pos"],
        )
    )
    db.commit()

    return TokenPair(
        access_token=create_token(user.id, "access"),
        refresh_token=create_token(user.id, "refresh"),
    )


@router.get("/me")
def me(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    org = db.get(Organization, current.organization_id) if current.organization_id else None
    return {
        "user": {"id": current.user.id, "email": current.user.email},
        "organization": {"id": org.id, "name": org.name} if org else None,
        "role": current.role,
    }


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return TokenPair(
        access_token=create_token(user.id, "access"),
        refresh_token=create_token(user.id, "refresh"),
    )


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    user = db.get(User, data["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return TokenPair(
        access_token=create_token(user.id, "access"),
        refresh_token=create_token(user.id, "refresh"),
    )


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def password_reset_request(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None:
        token = jwt.encode(
            {
                "sub": user.id,
                "type": "reset",
                "exp": datetime.now(UTC) + timedelta(hours=1),
            },
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        link = f"{settings.frontend_base_url}/reset-password?token={token}"
        send_email(
            to=user.email,
            subject="Reset your OrderFlow password",
            body=f"Reset your password: {link}",
        )
    # Always 202, regardless of whether the email exists, to avoid leaking account existence.
    return {"status": "accepted"}


@router.post("/password-reset/confirm")
def password_reset_confirm(payload: PasswordResetConfirm, db: Session = Depends(get_db)) -> dict:
    data = decode_token(payload.token)
    if data.get("type") != "reset":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    user = db.get(User, data["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"status": "ok"}


@router.post("/invite/accept", response_model=TokenPair)
def accept_invite(payload: InviteAcceptRequest, db: Session = Depends(get_db)) -> TokenPair:
    data = decode_token(payload.token)
    if data.get("type") != "invite":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    membership = db.get(Membership, data["sub"])
    if membership is None or membership.accepted_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invite is invalid or already used")
    user = db.get(User, membership.user_id)
    user.password_hash = hash_password(payload.password)
    membership.accepted_at = datetime.now(UTC)
    db.commit()
    return TokenPair(
        access_token=create_token(user.id, "access"),
        refresh_token=create_token(user.id, "refresh"),
    )
