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

    model_config = {"from_attributes": True}
