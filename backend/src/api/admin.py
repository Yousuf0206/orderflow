from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.db import get_db
from src.core.security import require_super_admin
from src.models.membership import Membership
from src.models.organization import Organization
from src.models.purchase_order import PurchaseOrder

router = APIRouter(prefix="/admin", tags=["super-admin"], dependencies=[Depends(require_super_admin)])


@router.get("/organizations")
def list_organizations(db: Session = Depends(get_db)) -> list[dict]:
    orgs = db.query(Organization).all()
    result = []
    for org in orgs:
        user_count = db.query(Membership).filter(Membership.organization_id == org.id).count()
        po_count = (
            db.query(PurchaseOrder)
            .filter(PurchaseOrder.organization_id == org.id, PurchaseOrder.deleted_at.is_(None))
            .count()
        )
        result.append(
            {
                "id": org.id,
                "name": org.name,
                "plan_tier": org.plan_tier,
                "is_suspended": org.is_suspended,
                "user_count": user_count,
                "active_po_count": po_count,
            }
        )
    return result


@router.post("/organizations/{org_id}/suspend")
def suspend_organization(org_id: str, db: Session = Depends(get_db)) -> dict:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    org.is_suspended = True
    db.commit()
    return {"status": "suspended"}


@router.post("/organizations/{org_id}/reactivate")
def reactivate_organization(org_id: str, db: Session = Depends(get_db)) -> dict:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    org.is_suspended = False
    db.commit()
    return {"status": "active"}


@router.get("/metrics")
def platform_metrics(db: Session = Depends(get_db)) -> dict:
    return {
        "organization_count": db.query(Organization).count(),
        "suspended_count": db.query(Organization).filter(Organization.is_suspended.is_(True)).count(),
        "total_active_pos": db.query(PurchaseOrder).filter(PurchaseOrder.deleted_at.is_(None)).count(),
    }
