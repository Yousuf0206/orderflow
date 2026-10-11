from collections import defaultdict

from fastapi import APIRouter, Depends

from src.core.tenant import TenantContext, get_tenant_context
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder
from src.services.po_calc import compute_many, remaining_by_unit

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(tenant: TenantContext = Depends(get_tenant_context)) -> dict:
    """Counts and per-unit remaining. Never one remaining figure across units.

    There used to be a `total_remaining_balance` here. With multi-item orders
    it would add tonnes to bags, so it was removed rather than renamed: any
    consumer still reading it fails loudly instead of showing a wrong number
    (constitution XXIX).
    """
    pos = (
        tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder)
        .filter(PurchaseOrder.deleted_at.is_(None))
        .all()
    )
    parties = {
        p.id: p.party_name
        for p in tenant.scoped(tenant.db.query(Party), Party).filter(Party.deleted_at.is_(None)).all()
    }

    status_counts = {"on_track": 0, "due_soon": 0, "overdue": 0, "fully_dispatched": 0}
    all_lines = []
    lines_by_party: dict[str, list] = defaultdict(list)
    open_by_party: dict[str, int] = defaultdict(int)

    # Two queries for every order, not one per order. The overdue count below
    # comes from the same status definition the purchase order list filters
    # on, which is what makes the two agree by construction.
    calcs = compute_many(tenant.db, pos)

    for po in pos:
        calc = calcs[po.id]
        status_counts[calc.status] = status_counts.get(calc.status, 0) + 1
        all_lines.extend(calc.lines)
        lines_by_party[po.party_id].extend(calc.lines)
        if calc.status != "fully_dispatched":
            open_by_party[po.party_id] += 1

    party_summary = [
        {
            "party_id": pid,
            "party_name": parties.get(pid, "Unknown"),
            "open_po_count": open_by_party[pid],
            "remaining_by_unit": remaining_by_unit(lines_by_party[pid]),
        }
        for pid in sorted(open_by_party, key=lambda pid: (-open_by_party[pid], parties.get(pid, "")))
    ]

    return {
        "remaining_by_unit": remaining_by_unit(all_lines),
        "open_po_count": len(pos) - status_counts["fully_dispatched"],
        "overdue_count": status_counts["overdue"],
        "due_soon_count": status_counts["due_soon"],
        "on_track_count": status_counts["on_track"],
        "fully_dispatched_count": status_counts["fully_dispatched"],
        "total_po_count": len(pos),
        "party_summary": party_summary,
    }
