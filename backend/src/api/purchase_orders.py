from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.security import CurrentUser, require_role
from src.core.tenant import TenantContext, get_tenant_context
from src.models.purchase_order import PurchaseOrder
from src.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderOut, PurchaseOrderUpdate
from src.services.audit import log_action
from src.services.po_calc import VALID_STATUSES, PoCalc, compute, compute_many

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])

# Characters LIKE treats as pattern syntax. A trader's PO numbering scheme
# routinely contains underscores, and an unescaped one silently matches any
# single character -- so a search for "PO_1" would also return "PO-1".
_LIKE_ESCAPE = "\\"


def _escape_like(term: str) -> str:
    for ch in (_LIKE_ESCAPE, "%", "_"):
        term = term.replace(ch, _LIKE_ESCAPE + ch)
    return term


def _out(po: PurchaseOrder, calc: PoCalc) -> PurchaseOrderOut:
    return PurchaseOrderOut(
        id=po.id,
        party_id=po.party_id,
        po_number=po.po_number,
        material=po.material,
        ordered_qty=float(po.ordered_qty),
        unit=po.unit,
        order_date=po.order_date,
        due_date=po.due_date,
        notes=po.notes,
        total_dispatched=calc.total_dispatched,
        remaining_balance=calc.remaining_balance,
        days_to_delivery=calc.days_to_delivery,
        status=calc.status,
    )


def _to_out(db, po: PurchaseOrder) -> PurchaseOrderOut:
    return _out(po, compute(db, po))


def get_active_po(tenant: TenantContext, po_id: str) -> PurchaseOrder:
    po = (
        tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder)
        .filter(PurchaseOrder.id == po_id, PurchaseOrder.deleted_at.is_(None))
        .first()
    )
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    return po


@router.get("", response_model=list[PurchaseOrderOut])
def list_purchase_orders(
    party_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, description="Partial, case-insensitive PO number"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
) -> list[PurchaseOrderOut]:
    query = tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder).filter(
        PurchaseOrder.deleted_at.is_(None)
    )
    if party_id:
        query = query.filter(PurchaseOrder.party_id == party_id)
    if date_from:
        query = query.filter(PurchaseOrder.order_date >= date_from)
    if date_to:
        query = query.filter(PurchaseOrder.order_date <= date_to)

    # Searched where the rows are selected, not by hiding rows already sent to
    # the browser, so a count the user can see is a count the server produced.
    term = (q or "").strip()
    if term:
        query = query.filter(
            PurchaseOrder.po_number.ilike(f"%{_escape_like(term)}%", escape=_LIKE_ESCAPE)
        )

    # An unrecognised status returns nothing rather than everything. Ignoring
    # it would make the filter lie: the user asked to narrow and the list came
    # back wider than they asked for.
    if status_filter is not None and status_filter not in VALID_STATUSES:
        return []

    pos = query.order_by(PurchaseOrder.due_date).all()
    # One grouped aggregate for the whole page instead of one per row. Status
    # is derived (it depends on the organization's due_soon_days), so it is
    # filtered here rather than in SQL -- a second definition of status in SQL
    # is what would let the dashboard's overdue count and this list disagree.
    calcs = compute_many(tenant.db, pos)
    results = [_out(po, calcs[po.id]) for po in pos]
    if status_filter:
        results = [r for r in results if r.status == status_filter]
    return results


@router.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager")),
) -> PurchaseOrderOut:
    tenant.assert_write_allowed()
    tenant.assert_can_add_po()
    existing = (
        tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder)
        .filter(PurchaseOrder.po_number == payload.po_number, PurchaseOrder.deleted_at.is_(None))
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "po_number already in use")

    po = PurchaseOrder(organization_id=tenant.organization_id, **payload.model_dump())
    tenant.db.add(po)
    tenant.db.flush()
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="create",
        entity_type="purchase_order",
        entity_id=po.id,
        after_state=payload.model_dump(mode="json"),
    )
    tenant.db.commit()
    tenant.db.refresh(po)
    return _to_out(tenant.db, po)


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(po_id: str, tenant: TenantContext = Depends(get_tenant_context)) -> PurchaseOrderOut:
    po = get_active_po(tenant, po_id)
    return _to_out(tenant.db, po)


@router.patch("/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(
    po_id: str,
    payload: PurchaseOrderUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager")),
) -> PurchaseOrderOut:
    tenant.assert_write_allowed()
    po = get_active_po(tenant, po_id)
    before = _to_out(tenant.db, po).model_dump(mode="json")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(po, field, value)
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="edit",
        entity_type="purchase_order",
        entity_id=po.id,
        before_state=before,
        after_state=payload.model_dump(exclude_unset=True, mode="json"),
    )
    tenant.db.commit()
    tenant.db.refresh(po)
    return _to_out(tenant.db, po)


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(
    po_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager")),
) -> None:
    tenant.assert_write_allowed()
    po = get_active_po(tenant, po_id)
    po.soft_delete()
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="delete",
        entity_type="purchase_order",
        entity_id=po.id,
    )
    tenant.db.commit()
