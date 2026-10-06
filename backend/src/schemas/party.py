from datetime import datetime

from pydantic import BaseModel, Field


class PartyCreate(BaseModel):
    party_code: str = Field(min_length=1, max_length=50)
    party_name: str = Field(min_length=1, max_length=200)
    city: str | None = None
    contact_person: str | None = None
    phone: str | None = None


class PartyUpdate(BaseModel):
    party_name: str | None = None
    city: str | None = None
    contact_person: str | None = None
    phone: str | None = None


class PartyOut(BaseModel):
    id: str
    party_code: str
    party_name: str
    city: str | None
    contact_person: str | None
    phone: str | None
    archived_at: datetime | None

    model_config = {"from_attributes": True}
