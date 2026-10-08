"""Seed script for local development / demos.

Run with: `python -m src.scripts.seed` from `backend/` (after migrations have
been applied). Creates one organization, one Owner user, two Parties, and a
few Purchase Orders with partial Dispatches so the dashboard/reports have
something to show immediately.
"""

from datetime import UTC, date, datetime, timedelta

from src.core.config import settings
from src.core.db import SessionLocal
from src.core.security import hash_password
from src.models.dispatch import Dispatch
from src.models.membership import Membership
from src.models.organization import Organization
from src.models.party import Party
from src.models.purchase_order import PurchaseOrder
from src.models.subscription import PLAN_LIMITS, Subscription
from src.models.user import User


def run() -> None:
    db = SessionLocal()
    try:
        if db.query(Organization).filter(Organization.name == "Demo Trading Co").first():
            print("Seed data already present, skipping.")
            return

        org = Organization(name="Demo Trading Co", currency="USD", timezone="UTC", plan_tier="trial")
        db.add(org)
        db.flush()

        owner = User(email="owner@demo.orderflow", password_hash=hash_password("password123"))
        db.add(owner)
        db.flush()

        db.add(
            Membership(
                organization_id=org.id,
                user_id=owner.id,
                role="owner",
                invited_at=datetime.now(UTC),
                accepted_at=datetime.now(UTC),
            )
        )
        db.add(
            Subscription(
                organization_id=org.id,
                plan_tier="trial",
                # Reads the same setting signup uses. Hardcoding 14 here meant
                # a deployment that changed the trial length got seeded orgs on
                # a different trial from the ones real signups received.
                trial_ends_at=datetime.now(UTC) + timedelta(days=settings.trial_length_days),
                max_users=PLAN_LIMITS["trial"]["max_users"],
                max_active_pos=PLAN_LIMITS["trial"]["max_active_pos"],
            )
        )

        steel_co = Party(organization_id=org.id, party_code="P-001", party_name="Steel Traders Ltd", city="Lahore")
        cement_co = Party(organization_id=org.id, party_code="P-002", party_name="Cement Supply Co", city="Karachi")
        db.add_all([steel_co, cement_co])
        db.flush()

        po1 = PurchaseOrder(
            organization_id=org.id,
            party_id=steel_co.id,
            po_number="PO-1001",
            material="Steel Rebar",
            ordered_qty=100,
            unit="ton",
            order_date=date.today() - timedelta(days=10),
            due_date=date.today() + timedelta(days=5),
        )
        po2 = PurchaseOrder(
            organization_id=org.id,
            party_id=cement_co.id,
            po_number="PO-1002",
            material="Cement",
            ordered_qty=500,
            unit="bags",
            order_date=date.today() - timedelta(days=20),
            due_date=date.today() - timedelta(days=2),
        )
        db.add_all([po1, po2])
        db.flush()

        db.add(Dispatch(organization_id=org.id, purchase_order_id=po1.id, dispatch_date=date.today() - timedelta(days=3), qty=40))
        db.add(Dispatch(organization_id=org.id, purchase_order_id=po2.id, dispatch_date=date.today() - timedelta(days=10), qty=200))

        db.commit()
        print(f"Seeded org {org.id} with owner login owner@demo.orderflow / password123")
    finally:
        db.close()


if __name__ == "__main__":
    run()
