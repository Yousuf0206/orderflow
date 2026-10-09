from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt

from src.core.config import settings
from src.core.security import CurrentUser, require_role
from src.core.tenant import TenantContext, get_tenant_context
from src.models.membership import Membership
from src.models.user import User
from src.schemas.org import (
    MemberInvite,
    MemberInviteResult,
    MemberOut,
    MemberRoleUpdate,
    OrgOut,
    OrgUpdate,
)
from src.services.email import send_email
from src.services.membership import assert_not_last_owner, validate_role

router = APIRouter(prefix="/org", tags=["organization"])


@router.get("", response_model=OrgOut)
def get_org(tenant: TenantContext = Depends(get_tenant_context)) -> OrgOut:
    return OrgOut.model_validate(tenant.organization)


@router.patch("", response_model=OrgOut)
def update_org(
    payload: OrgUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    _owner: CurrentUser = Depends(require_role("owner")),
) -> OrgOut:
    org = tenant.organization
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    tenant.db.commit()
    tenant.db.refresh(org)
    return OrgOut.model_validate(org)


@router.get("/members", response_model=list[MemberOut])
def list_members(
    tenant: TenantContext = Depends(get_tenant_context),
    _ = Depends(require_role("owner", "manager")),
) -> list[MemberOut]:
    rows = (
        tenant.db.query(Membership, User)
        .join(User, User.id == Membership.user_id)
        .filter(Membership.organization_id == tenant.organization_id)
        .all()
    )
    return [
        MemberOut(
            id=m.id,
            user_id=u.id,
            email=u.email,
            role=m.role,
            accepted=m.accepted_at is not None,
            invitation_email_sent_at=m.invitation_email_sent_at,
        )
        for m, u in rows
    ]


def _invite_link(membership_id: str) -> str:
    """A fresh single-use invite link. No token is stored, so every link for a
    pending member is minted on demand rather than recalled."""
    token = jwt.encode(
        {
            "sub": membership_id,
            "type": "invite",
            "exp": datetime.now(UTC) + timedelta(days=7),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return f"{settings.frontend_base_url}/accept-invite?token={token}"


@router.post(
    "/members/invite", response_model=MemberInviteResult, status_code=status.HTTP_201_CREATED
)
def invite_member(
    payload: MemberInvite,
    tenant: TenantContext = Depends(get_tenant_context),
    _owner: CurrentUser = Depends(require_role("owner")),
) -> MemberInviteResult:
    validate_role(payload.role)
    tenant.assert_can_add_user()

    user = tenant.db.query(User).filter(User.email == payload.email).first()
    if user is None:
        # Placeholder password hash; replaced when the invite is accepted.
        user = User(email=payload.email, password_hash="")
        tenant.db.add(user)
        tenant.db.flush()

    existing = (
        tenant.db.query(Membership)
        .filter(Membership.organization_id == tenant.organization_id, Membership.user_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "User is already a member of this organization")

    membership = Membership(
        organization_id=tenant.organization_id,
        user_id=user.id,
        role=payload.role,
        invited_at=datetime.now(UTC),
    )
    tenant.db.add(membership)
    tenant.db.flush()

    link = _invite_link(membership.id)
    outcome = send_email(
        to=user.email,
        subject=f"You've been invited to {tenant.organization.name} on OrderFlow",
        body=f"Accept your invite: {link}",
    )
    # Set only on a confirmed send. Setting it whenever an invitation is
    # created is the bug this replaces: the screen said "invitation sent" while
    # the link had gone to a server log and nowhere else.
    if outcome == "sent":
        membership.invitation_email_sent_at = datetime.now(UTC)

    tenant.db.commit()
    return MemberInviteResult(
        id=membership.id,
        user_id=user.id,
        email=user.email,
        role=membership.role,
        accepted=False,
        invitation_email_sent_at=membership.invitation_email_sent_at,
        email_outcome=outcome,
        # Offered whenever nothing was delivered, so the owner has a way to get
        # their colleague in without a mail service.
        invitation_link=None if outcome == "sent" else link,
    )


@router.post("/members/{membership_id}/resend", response_model=MemberInviteResult)
def resend_invite(
    membership_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    _owner: CurrentUser = Depends(require_role("owner")),
) -> MemberInviteResult:
    """Re-send a pending invitation, or just hand back a usable link."""
    membership = tenant.db.get(Membership, membership_id)
    if membership is None or membership.organization_id != tenant.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    if membership.accepted_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That member has already accepted their invitation"
        )

    user = tenant.db.get(User, membership.user_id)
    link = _invite_link(membership.id)
    outcome = send_email(
        to=user.email,
        subject=f"You've been invited to {tenant.organization.name} on OrderFlow",
        body=f"Accept your invite: {link}",
    )
    if outcome == "sent":
        membership.invitation_email_sent_at = datetime.now(UTC)
    tenant.db.commit()

    return MemberInviteResult(
        id=membership.id,
        user_id=user.id,
        email=user.email,
        role=membership.role,
        accepted=False,
        invitation_email_sent_at=membership.invitation_email_sent_at,
        email_outcome=outcome,
        invitation_link=None if outcome == "sent" else link,
    )


@router.patch("/members/{membership_id}", response_model=MemberOut)
def change_role(
    membership_id: str,
    payload: MemberRoleUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    _owner: CurrentUser = Depends(require_role("owner")),
) -> MemberOut:
    validate_role(payload.role)
    membership = tenant.db.get(Membership, membership_id)
    if membership is None or membership.organization_id != tenant.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    if payload.role != "owner":
        assert_not_last_owner(tenant.db, membership)
    membership.role = payload.role
    tenant.db.commit()
    user = tenant.db.get(User, membership.user_id)
    return MemberOut(
        id=membership.id, user_id=user.id, email=user.email, role=membership.role,
        accepted=membership.accepted_at is not None,
        invitation_email_sent_at=membership.invitation_email_sent_at,
    )


@router.delete("/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    membership_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    _owner: CurrentUser = Depends(require_role("owner")),
) -> None:
    membership = tenant.db.get(Membership, membership_id)
    if membership is None or membership.organization_id != tenant.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    assert_not_last_owner(tenant.db, membership)
    tenant.db.delete(membership)
    tenant.db.commit()
