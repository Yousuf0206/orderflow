"""Tenant-scoping layer (Constitution Principle I: Multi-tenancy First).

Every query against a tenant-owned table MUST go through `scoped()` (or
otherwise filter by `organization_id` resolved from `TenantContext`, never
from a client-supplied parameter) so that cross-tenant data leakage is
structurally prevented rather than left to per-endpoint discipline.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Query, Session

from src.core.db import get_db
from src.core.security import CurrentUser, get_current_user
from src.models.organization import Organization
from src.models.subscription import Subscription


class TenantContext:
    def __init__(self, db: Session, current: CurrentUser, organization: Organization):
        self.db = db
        self.current = current
        self.organization = organization

    @property
    def organization_id(self) -> str:
        return self.organization.id

    @property
    def role(self) -> str | None:
        return self.current.role

    def scoped(self, query: Query, model) -> Query:
        return query.filter(model.organization_id == self.organization_id)

    def assert_write_allowed(self) -> None:
        """Blocks create/edit actions once trial has expired without upgrade
        (FR-021: read-only lockout). Reads, exports, and reports remain
        available.
        """
        sub = (
            self.db.query(Subscription)
            .filter(Subscription.organization_id == self.organization_id)
            .first()
        )
        if sub is not None and sub.is_read_only_locked:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Organization is in read-only mode: trial expired. Upgrade to continue editing.",
            )


def get_tenant_context(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TenantContext:
    if current.organization_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No organization context")
    org = db.get(Organization, current.organization_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    if org.is_suspended:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Organization access is suspended")
    return TenantContext(db=db, current=current, organization=org)
