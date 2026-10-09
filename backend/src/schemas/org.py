from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr


class OrgOut(BaseModel):
    id: str
    name: str
    logo_url: str | None
    currency: str
    timezone: str
    plan_tier: str

    model_config = {"from_attributes": True}


class OrgUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    currency: str | None = None
    timezone: str | None = None


class MemberInvite(BaseModel):
    email: EmailStr
    role: str


class MemberRoleUpdate(BaseModel):
    role: str


class MemberOut(BaseModel):
    id: str
    user_id: str
    email: str
    role: str
    accepted: bool
    # None means no invitation email has been confirmed delivered. The team
    # list uses it to show "emailed" separately from "pending".
    invitation_email_sent_at: datetime | None = None

    model_config = {"from_attributes": True}


class MemberInviteResult(MemberOut):
    """An invitation, plus the truth about its email.

    `invitation_link` is present whenever no email was delivered, so an owner
    can pass it on by hand. It is a single-use expiring token returned only to
    the Owner who created the invitation, over the same authenticated channel;
    it must not be logged, put in a URL, or sent to analytics.
    """

    email_outcome: Literal["sent", "not_configured", "failed"]
    invitation_link: str | None = None
