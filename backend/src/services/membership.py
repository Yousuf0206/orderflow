from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from src.models.membership import ROLES, Membership


def validate_role(role: str) -> None:
    if role not in ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid role: {role}")


def assert_not_last_owner(db: Session, membership: Membership) -> None:
    """Constitution-adjacent safety rule (data-model.md): an organization must
    always retain at least one Owner.
    """
    if membership.role != "owner":
        return
    other_owners = (
        db.query(Membership)
        .filter(
            Membership.organization_id == membership.organization_id,
            Membership.role == "owner",
            Membership.id != membership.id,
        )
        .count()
    )
    if other_owners == 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Cannot remove or demote the organization's last remaining Owner",
        )
