from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.security import CurrentUser, require_role
from src.core.tenant import TenantContext, get_tenant_context
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder
from src.schemas.party import PartyCreate, PartyOut, PartyUpdate
from src.services.audit import log_action
from src.services.po_calc import compute

router = APIRouter(prefix="/parties", tags=["parties"])


def _get_active_party(tenant: TenantContext, party_id: str) -> Party:
    party = (
        tenant.scoped(tenant.db.query(Party), Party)
        .filter(Party.id == party_id, Party.deleted_at.is_(None))
        .first()
    )
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    return party


@router.get("", response_model=list[PartyOut])
def list_parties(
    q: str | None = Query(default=None, description="Search by name or code"),
    include_archived: bool = False,
    tenant: TenantContext = Depends(get_tenant_context),
) -> list[PartyOut]:
    query = tenant.scoped(tenant.db.query(Party), Party).filter(Party.deleted_at.is_(None))
    if not include_archived:
        query = query.filter(Party.archived_at.is_(None))
    if q:
        like = f"%{q}%"
        query = query.filter((Party.party_name.ilike(like)) | (Party.party_code.ilike(like)))
    return [PartyOut.model_validate(p) for p in query.order_by(Party.party_name).all()]


@router.post("", response_model=PartyOut, status_code=status.HTTP_201_CREATED)
def create_party(
    payload: PartyCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager")),
) -> PartyOut:
    tenant.assert_write_allowed()
    existing = (
        tenant.scoped(tenant.db.query(Party), Party)
        .filter(Party.party_code == payload.party_code, Party.deleted_at.is_(None))
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "party_code already in use")

    party = Party(organization_id=tenant.organization_id, **payload.model_dump())
    tenant.db.add(party)
    tenant.db.flush()
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="create",
        entity_type="party",
        entity_id=party.id,
        after_state=payload.model_dump(),
    )
    tenant.db.commit()
    tenant.db.refresh(party)
    return PartyOut.model_validate(party)


@router.get("/{party_id}")
def get_party(party_id: str, tenant: TenantContext = Depends(get_tenant_context)) -> dict:
    party = _get_active_party(tenant, party_id)
    open_pos = (
        tenant.scoped(tenant.db.query(PurchaseOrder), PurchaseOrder)
        .filter(PurchaseOrder.party_id == party.id, PurchaseOrder.deleted_at.is_(None))
        .all()
    )
    po_items = []
    for po in open_pos:
        calc = compute(tenant.db, po)
        if calc.status != "fully_dispatched":
            po_items.append(
                {
                    "id": po.id,
                    "po_number": po.po_number,
                    "material": po.material,
                    "remaining_balance": calc.remaining_balance,
                    "status": calc.status,
                    "due_date": po.due_date.isoformat(),
                }
            )
    return {"party": PartyOut.model_validate(party), "open_orders": po_items}


@router.patch("/{party_id}", response_model=PartyOut)
def update_party(
    party_id: str,
    payload: PartyUpdate,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager")),
) -> PartyOut:
    tenant.assert_write_allowed()
    party = _get_active_party(tenant, party_id)
    before = PartyOut.model_validate(party).model_dump(mode="json")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(party, field, value)
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="edit",
        entity_type="party",
        entity_id=party.id,
        before_state=before,
        after_state=payload.model_dump(exclude_unset=True),
    )
    tenant.db.commit()
    tenant.db.refresh(party)
    return PartyOut.model_validate(party)


@router.post("/{party_id}/archive", response_model=PartyOut)
def archive_party(
    party_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    current: CurrentUser = Depends(require_role("owner", "manager")),
) -> PartyOut:
    tenant.assert_write_allowed()
    party = _get_active_party(tenant, party_id)
    party.archived_at = datetime.now(UTC)
    log_action(
        tenant.db,
        organization_id=tenant.organization_id,
        actor_user_id=current.user.id,
        action="edit",
        entity_type="party",
        entity_id=party.id,
        after_state={"archived": True},
    )
    tenant.db.commit()
    tenant.db.refresh(party)
    return PartyOut.model_validate(party)
