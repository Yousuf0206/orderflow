"""Fixture for the landing-page screenshot capture.

Run with: `python -m src.scripts.seed_landing_demo` from `backend/` (after
migrations have been applied), then capture with
`npm run capture:landing` from `frontend/`.

Deliberately separate from `seed.py`. That script is what local development
expects to find -- one org called "Demo Trading Co" with PO-1001 at 100 ordered
-- and bending it to produce the landing page's numbers would change every
developer's database. This one owns a different organization name so the two
coexist and neither short-circuits the other.

Values here are fixed by
specs/003-landing-page-upgrade/data-model.md: the hero screenshot must read
1,000 ordered / 400 dispatched / 600 remaining, built from two dispatches so
Dispatch History shows a history rather than a single line. All data is
fictional (constitution Principle XVII / spec FR-018).

Pass --recreate to soft-delete and rebuild, so a re-capture starts from known
numbers.
"""

import argparse
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

ORG_NAME = "OrderFlow Demo"
OWNER_EMAIL = "demo@orderflow.example"
OWNER_PASSWORD = "password123"  # noqa: S105 - local fixture only, never deployed


def _delete_existing(db, org: Organization) -> None:
    """Hard-delete the fixture org's rows so a re-capture starts clean.

    Principle VII forbids hard deletes of *business* data. This is fixture
    data in a local or staging database, and soft-deleting would leave the
    unique (organization_id, po_number) rows in place and break the rebuild.
    """
    org_id = org.id
    db.query(Dispatch).filter(Dispatch.organization_id == org_id).delete()
    db.query(PurchaseOrder).filter(PurchaseOrder.organization_id == org_id).delete()
    db.query(Party).filter(Party.organization_id == org_id).delete()
    db.query(Subscription).filter(Subscription.organization_id == org_id).delete()
    db.query(Membership).filter(Membership.organization_id == org_id).delete()
    db.query(User).filter(User.email == OWNER_EMAIL).delete()
    db.query(Organization).filter(Organization.id == org_id).delete()
    db.commit()


def run(recreate: bool = False) -> None:
    db = SessionLocal()
    try:
        existing = db.query(Organization).filter(Organization.name == ORG_NAME).first()
        if existing is not None:
            if not recreate:
                print(f"Fixture org {ORG_NAME!r} already present, skipping. Use --recreate to rebuild.")
                return
            print(f"Removing existing {ORG_NAME!r} before rebuilding...")
            _delete_existing(db, existing)

        org = Organization(name=ORG_NAME, currency="USD", timezone="UTC", plan_tier="trial")
        db.add(org)
        db.flush()

        owner = User(email=OWNER_EMAIL, password_hash=hash_password(OWNER_PASSWORD))
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
                # Same setting signup reads, for the same reason seed.py does:
                # a hardcoded length drifts from what real signups receive.
                trial_ends_at=datetime.now(UTC) + timedelta(days=settings.trial_length_days),
                max_users=PLAN_LIMITS["trial"]["max_users"],
                max_active_pos=PLAN_LIMITS["trial"]["max_active_pos"],
            )
        )

        party = Party(
            organization_id=org.id,
            party_code="P-101",
            party_name="Northgate Steel Works",
            city="Lahore",
        )
        # A second party, so the dashboard's Remaining Balance by Party panel
        # shows a comparison rather than a single bar -- the asset contract
        # requires at least two parties with balances.
        party_two = Party(
            organization_id=org.id,
            party_code="P-102",
            party_name="Civic Cement Traders",
            city="Karachi",
        )
        db.add_all([party, party_two])
        db.flush()

        today = date.today()

        # The hero subject. 1,000 ordered, 400 dispatched across two rows,
        # leaving 600 remaining -- computed by the app, never stored
        # (Principle II), which is the whole point of capturing rather than
        # drawing the screenshot.
        hero_po = PurchaseOrder(
            organization_id=org.id,
            party_id=party.id,
            po_number="PO-2001",
            material="TMT Steel Bars 12mm",
            ordered_qty=1000,
            unit="ton",
            order_date=today - timedelta(days=18),
            due_date=today + timedelta(days=12),
        )
        # Supporting orders so the dashboard's by-party panel and the party's
        # open-orders table each show more than one row. Partially dispatched
        # and not overdue, so no screenshot reads as a problem state.
        support_po_1 = PurchaseOrder(
            organization_id=org.id,
            party_id=party.id,
            po_number="PO-2002",
            material="MS Angle 50x50",
            ordered_qty=600,
            unit="ton",
            order_date=today - timedelta(days=12),
            due_date=today + timedelta(days=20),
        )
        support_po_2 = PurchaseOrder(
            organization_id=org.id,
            party_id=party_two.id,
            po_number="PO-2003",
            material="OPC Cement 50kg",
            ordered_qty=900,
            unit="bags",
            order_date=today - timedelta(days=6),
            due_date=today + timedelta(days=25),
        )
        db.add_all([hero_po, support_po_1, support_po_2])
        db.flush()

        db.add_all(
            [
                Dispatch(
                    organization_id=org.id,
                    purchase_order_id=hero_po.id,
                    dispatch_date=today - timedelta(days=11),
                    qty=250,
                    vehicle_ref="TLX-4417",
                ),
                Dispatch(
                    organization_id=org.id,
                    purchase_order_id=hero_po.id,
                    dispatch_date=today - timedelta(days=4),
                    qty=150,
                    vehicle_ref="TLX-6082",
                ),
                Dispatch(
                    organization_id=org.id,
                    purchase_order_id=support_po_1.id,
                    dispatch_date=today - timedelta(days=5),
                    qty=200,
                    vehicle_ref="KHR-1193",
                ),
                Dispatch(
                    organization_id=org.id,
                    purchase_order_id=support_po_2.id,
                    dispatch_date=today - timedelta(days=2),
                    qty=300,
                    vehicle_ref="KHR-7725",
                ),
            ]
        )

        db.commit()
        print(
            f"Seeded landing fixture org {org.id}\n"
            f"  login: {OWNER_EMAIL} / {OWNER_PASSWORD}\n"
            f"  hero PO: {hero_po.po_number} (1000 ordered / 400 dispatched / 600 remaining)\n"
            f"  party: {party.party_code} {party.party_name}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the landing-page screenshot fixture.")
    parser.add_argument("--recreate", action="store_true", help="Remove and rebuild the fixture org.")
    args = parser.parse_args()
    run(recreate=args.recreate)
