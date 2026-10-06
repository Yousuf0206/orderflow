from fastapi import APIRouter, Depends

from src.core.tenant import TenantContext, get_tenant_context
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder
from src.services.po_calc import compute

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(tenant: TenantContext = Depends(get_tenant_context)) -> dict:
    pos = (
        tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder)
        .filter(PurchaseOrder.deleted_at.is_(None))
        .all()
    )
    parties = {
        p.id: p.party_name
        for p in tenant.scoped(tenant.db.query(Party), Party).filter(Party.deleted_at.is_(None)).all()
    }

    total_remaining = 0.0
    status_counts = {"on_track": 0, "due_soon": 0, "overdue": 0, "fully_dispatched": 0}
    by_party: dict[str, float] = {}

    for po in pos:
        calc = compute(tenant.db, po)
        total_remaining += max(calc.remaining_balance, 0)
        status_counts[calc.status] = status_counts.get(calc.status, 0) + 1
        if calc.remaining_balance > 0:
            by_party[po.party_id] = by_party.get(po.party_id, 0) + calc.remaining_balance

    party_summary = [
        {"party_id": pid, "party_name": parties.get(pid, "Unknown"), "remaining_balance": bal}
        for pid, bal in sorted(by_party.items(), key=lambda kv: -kv[1])
    ]

    return {
        "total_remaining_balance": total_remaining,
        "overdue_count": status_counts["overdue"],
        "due_soon_count": status_counts["due_soon"],
        "on_track_count": status_counts["on_track"],
        "fully_dispatched_count": status_counts["fully_dispatched"],
        "total_po_count": len(pos),
        "party_summary": party_summary,
    }
