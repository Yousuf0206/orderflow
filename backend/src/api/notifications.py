from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.tenant import TenantContext, get_tenant_context
from src.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(tenant: TenantContext = Depends(get_tenant_context)) -> list[dict]:
    rows = (
        tenant.db.query(Notification)
        .filter(
            Notification.organization_id == tenant.organization_id,
            Notification.recipient_user_id == tenant.current.user.id,
            Notification.channel == "in_app",
        )
        .order_by(Notification.sent_at.desc())
        .all()
    )
    return [
        {
            "id": n.id,
            "type": n.type,
            "purchase_order_id": n.purchase_order_id,
            "sent_at": n.sent_at.isoformat(),
            "read_at": n.read_at.isoformat() if n.read_at else None,
        }
        for n in rows
    ]


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, tenant: TenantContext = Depends(get_tenant_context)) -> dict:
    notif = tenant.db.get(Notification, notification_id)
    if notif is None or notif.organization_id != tenant.organization_id or notif.recipient_user_id != tenant.current.user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    notif.read_at = datetime.now(UTC)
    tenant.db.commit()
    return {"status": "ok"}
