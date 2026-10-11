from fastapi import APIRouter, Depends, HTTPException, status

from src.api.purchase_orders import get_active_po
from src.core.security import CurrentUser, require_role
from src.core.tenant import TenantContext, get_tenant_context
from src.models.dispatch import Dispatch, DispatchLine
from src.models.purchase_order import PurchaseOrder, PurchaseOrderLine
from src.schemas.dispatch import (
    DispatchCreate,
    DispatchCreateResponse,
    DispatchLineOut,
    DispatchOut,
    OverLine,
)
from src.services.audit import log_action
from src.services.po_calc import compute

router = APIRouter(prefix="/purchase-orders/{po_id}/dispatches", tags=["dispatches"])


def _fmt(qty: float) -> str:
    return f"{qty:g}"


def _dispatch_out(dispatch: Dispatch, lines_by_id: dict[str, PurchaseOrderLine]) -> DispatchOut:
    out_lines = []
    for dl in dispatch.lines:
        line = lines_by_id[dl.purchase_order_line_id]
        out_lines.append(
            DispatchLineOut(
                purchase_order_line_id=line.id,
                line_no=line.line_no,
                material=line.material,
                unit=line.unit,
                qty=float(dl.qty),
            )
        )
    out_lines.sort(key=lambda line: line.line_no)
    return DispatchOut(
        id=dispatch.id,
        purchase_order_id=dispatch.purchase_order_id,
        dispatch_date=dispatch.dispatch_date,
        vehicle_ref=dispatch.vehicle_ref,
        remarks=dispatch.remarks,
        lines=out_lines,
    )


def _audit_state(dispatch: Dispatch) -> dict:
    return {
        "dispatch_date": dispatch.dispatch_date.isoformat(),
        "vehicle_ref": dispatch.vehicle_ref,
        "remarks": dispatch.remarks,
        "lines": [
            {"purchase_order_line_id": dl.purchase_order_line_id, "qty": float(dl.qty)}
            for dl in dispatch.lines
        ],
    }


@router.get("", response_model=list[DispatchOut])
def list_dispatches(po_id: str, tenant: TenantContext = Depends(get_tenant_context)) -> list[DispatchOut]:
    po = get_active_po(tenant, po_id)  # 404s if not found / wrong tenant
    rows = (
        tenant.db.query(Dispatch)
        .filter(Dispatch.purchase_order_id == po_id, Dispatch.deleted_at.is_(None))
        .order_by(Dispatch.dispatch_date)
        .all()
    )
    lines_by_id = {line.id: line for line in po.lines}
    return [_dispatch_out(d, lines_by_id) for d in rows]


@router.post("", response_model=DispatchCreateResponse, status_code=status.HTTP_201_CREATED)
def create_dispatch(
    po_id: str,
    payload: DispatchCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager", "staff")),
) -> DispatchCreateResponse:
    tenant.assert_write_allowed()
    po: PurchaseOrder = get_active_po(tenant, po_id)
    lines_by_id = {line.id: line for line in po.lines}

    # A line from another PO -- or another organization -- is a 422 on this
    # request, not a 404: whether that line exists elsewhere is not something
    # this request is entitled to learn.
    unknown = [
        i for i, entry in enumerate(payload.lines) if entry.purchase_order_line_id not in lines_by_id
    ]
    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            [
                {
                    "loc": ["body", "lines", i, "purchase_order_line_id"],
                    "msg": "This line is not on this purchase order.",
                    "type": "value_error",
                }
                for i in unknown
            ],
        )

    # Over-dispatch is judged per line (constitution XXX): a PO-level total
    # within limit must not hide one line going past its own ordered quantity.
    remaining = {line.id: line.remaining_qty for line in compute(tenant.db, po).lines}
    over = [
        OverLine(
            purchase_order_line_id=entry.purchase_order_line_id,
            material=lines_by_id[entry.purchase_order_line_id].material,
            unit=lines_by_id[entry.purchase_order_line_id].unit,
            remaining=remaining[entry.purchase_order_line_id],
            requested=entry.qty,
        )
        for entry in payload.lines
        if entry.qty > remaining[entry.purchase_order_line_id]
    ]
    if over and not payload.confirm:
        # Phrased for the person reading it, not for an API client: the UI
        # gives them a Confirm button, so no request parameter is named.
        detail = "; ".join(
            f"{o.material}: {_fmt(o.requested)} {o.unit} is more than the "
            f"{_fmt(o.remaining)} {o.unit} still remaining"
            for o in over
        )
        return DispatchCreateResponse(
            dispatch=None,
            warning=f"{detail}. Confirm to record it anyway.",
            over_lines=over,
        )

    dispatch = Dispatch(
        organization_id=tenant.organization_id,
        purchase_order_id=po_id,
        dispatch_date=payload.dispatch_date,
        vehicle_ref=payload.vehicle_ref,
        remarks=payload.remarks,
    )
    dispatch.lines = [
        DispatchLine(
            organization_id=tenant.organization_id,
            purchase_order_id=po_id,
            purchase_order_line_id=entry.purchase_order_line_id,
            qty=entry.qty,
        )
        for entry in payload.lines
    ]
    tenant.db.add(dispatch)
    tenant.db.flush()
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="create",
        entity_type="dispatch",
        entity_id=dispatch.id,
        after_state=_audit_state(dispatch),
    )
    tenant.db.commit()
    tenant.db.refresh(dispatch)
    return DispatchCreateResponse(dispatch=_dispatch_out(dispatch, lines_by_id), warning=None)


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
    # Soft-deleting the header returns every one of its lines' quantities to
    # remaining, because calculations filter on the header's deleted_at.
    dispatch.soft_delete()
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="delete",
        entity_type="dispatch",
        entity_id=dispatch.id,
        before_state=_audit_state(dispatch),
    )
    tenant.db.commit()
