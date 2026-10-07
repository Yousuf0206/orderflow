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
from src.services.billing import check_trial_expiry, enforce_usage_limits, get_or_create_subscription


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

    def assert_can_add_user(self) -> None:
        """Blocks inviting past the plan's max_users (billing.PLAN_LIMITS)."""
        enforce_usage_limits(self.db, self.organization_id, adding_user=True)

    def assert_can_add_po(self) -> None:
        """Blocks creating past the plan's max_active_pos (billing.PLAN_LIMITS)."""
        enforce_usage_limits(self.db, self.organization_id, adding_po=True)


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

    # Lazily re-evaluate trial expiry on every authenticated request rather
    # than relying on an external scheduler -- there was previously no path
    # that ever flipped is_read_only_locked to True, so trials never
    # actually expired in practice.
    sub = get_or_create_subscription(db, org.id)
    was_locked = sub.is_read_only_locked
    check_trial_expiry(db, sub)
    if sub.is_read_only_locked != was_locked:
        db.commit()

    return TenantContext(db=db, current=current, organization=org)
