from fastapi import APIRouter, Depends, status

from src.api.purchase_orders import get_active_po
from src.core.security import CurrentUser, require_role
from src.core.tenant import TenantContext, get_tenant_context
from src.models.dispatch import Dispatch
from src.schemas.dispatch import DispatchCreate, DispatchCreateResponse, DispatchOut
from src.services.audit import log_action
from src.services.po_calc import compute

router = APIRouter(prefix="/purchase-orders/{po_id}/dispatches", tags=["dispatches"])


@router.get("", response_model=list[DispatchOut])
def list_dispatches(po_id: str, tenant: TenantContext = Depends(get_tenant_context)) -> list[DispatchOut]:
    get_active_po(tenant, po_id)  # 404s if not found / wrong tenant
    rows = (
        tenant.db.query(Dispatch)
        .filter(Dispatch.purchase_order_id == po_id, Dispatch.deleted_at.is_(None))
        .order_by(Dispatch.dispatch_date)
        .all()
    )
    return [DispatchOut.model_validate(d) for d in rows]


@router.post("", response_model=DispatchCreateResponse, status_code=status.HTTP_201_CREATED)
def create_dispatch(
    po_id: str,
    payload: DispatchCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager", "staff")),
) -> DispatchCreateResponse:
    tenant.assert_write_allowed()
    po = get_active_po(tenant, po_id)
    calc = compute(tenant.db, po)

    if payload.qty > calc.remaining_balance and not payload.confirm:
        return DispatchCreateResponse(
            dispatch=None,
            # Phrased for the person reading it, not for an API client:
            # "resubmit with confirm=true" named a request parameter the user
            # has no way to set -- the UI gives them a Confirm button instead.
            warning=(
                f"This dispatch of {payload.qty} is more than the {calc.remaining_balance} "
                f"still remaining on this order. Confirm to record it anyway."
            ),
        )

    dispatch = Dispatch(
        organization_id=tenant.organization_id,
        purchase_order_id=po_id,
        dispatch_date=payload.dispatch_date,
        qty=payload.qty,
        vehicle_ref=payload.vehicle_ref,
        remarks=payload.remarks,
    )
    tenant.db.add(dispatch)
    tenant.db.flush()
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="create",
        entity_type="dispatch",
        entity_id=dispatch.id,
        after_state=payload.model_dump(mode="json", exclude={"confirm"}),
    )
    tenant.db.commit()
    tenant.db.refresh(dispatch)
    return DispatchCreateResponse(dispatch=DispatchOut.model_validate(dispatch), warning=None)


@router.delete("/{dispatch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dispatch(
    po_id: str,
    dispatch_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager")),
) -> None:
    tenant.assert_write_allowed()
    get_active_po(tenant, po_id)
    dispatch = (
        tenant.db.query(Dispatch)
        .filter(Dispatch.id == dispatch_id, Dispatch.purchase_order_id == po_id, Dispatch.deleted_at.is_(None))
        .first()
    )
    if dispatch is None:
        return
    dispatch.soft_delete()
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="delete",
        entity_type="dispatch",
        entity_id=dispatch.id,
    )
    tenant.db.commit()
