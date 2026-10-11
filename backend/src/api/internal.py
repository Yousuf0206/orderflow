"""Endpoints called by the platform scheduler, never by users.

Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET
environment variable is set. With no secret configured these endpoints refuse
to run rather than run unauthenticated: a purge anyone can trigger is a purge
nobody controls.
"""

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from src.core.config import settings
from src.core.db import get_db
from src.services.account_deletion import purge_due

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


def _require_cron_secret(authorization: str | None = Header(default=None)) -> None:
    if not settings.cron_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Scheduler secret is not configured")
    expected = f"Bearer {settings.cron_secret}"
    if authorization is None or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authorized")


@router.get("/purge-deleted-accounts", dependencies=[Depends(_require_cron_secret)])
def purge_deleted_accounts(db: Session = Depends(get_db)) -> dict:
    """Daily: removes accounts whose 30-day window has passed (constitution VII)."""
    counts = purge_due(db)
    db.commit()
    return {"purged": counts}
