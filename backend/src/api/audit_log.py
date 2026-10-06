from datetime import date

from fastapi import APIRouter, Depends, Query

from src.core.security import require_role
from src.core.tenant import TenantContext, get_tenant_context
from src.models.audit_log import AuditLogEntry
from src.models.user import User

router = APIRouter(prefix="/audit-log", tags=["audit-log"])


@router.get("")
def list_audit_log(
    entity_type: str | None = Query(default=None),
    actor_user_id: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    _ = Depends(require_role("owner", "manager")),
) -> list[dict]:
    query = tenant.scoped(tenant.db.query(AuditLogEntry), AuditLogEntry)
    if entity_type:
        query = query.filter(AuditLogEntry.entity_type == entity_type)
    if actor_user_id:
        query = query.filter(AuditLogEntry.actor_user_id == actor_user_id)
    if date_from:
        query = query.filter(AuditLogEntry.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLogEntry.created_at <= date_to)

    rows = query.order_by(AuditLogEntry.created_at.desc()).limit(500).all()
    actor_emails = {u.id: u.email for u in tenant.db.query(User).all()}
    return [
        {
            "id": e.id,
            "actor_email": actor_emails.get(e.actor_user_id, "unknown"),
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "before_state": e.before_state,
            "after_state": e.after_state,
            "created_at": e.created_at.isoformat(),
        }
        for e in rows
    ]
