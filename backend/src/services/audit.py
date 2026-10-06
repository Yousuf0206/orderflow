from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.orm import Session

from src.models.audit_log import AuditLogEntry

EntityType = Literal["party", "purchase_order", "dispatch"]
Action = Literal["create", "edit", "delete"]


def log_action(
    db: Session,
    *,
    organization_id: str,
    actor_user_id: str,
    action: Action,
    entity_type: EntityType,
    entity_id: str,
    before_state: dict | None = None,
    after_state: dict | None = None,
) -> AuditLogEntry:
    """Constitution Principle VI: Audit Everything Important.

    Every create/edit/delete on Party, Purchase Order, and Dispatch MUST call
    this (wired in the corresponding API routers) rather than each router
    writing its own ad hoc log entry.
    """
    entry = AuditLogEntry(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_state=before_state,
        after_state=after_state,
        created_at=datetime.now(UTC),
    )
    db.add(entry)
    return entry
