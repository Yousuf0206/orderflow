from datetime import date

from pydantic import BaseModel, Field


class DispatchCreate(BaseModel):
    dispatch_date: date
    qty: float = Field(gt=0)
    vehicle_ref: str | None = None
    remarks: str | None = None
    confirm: bool = False


class DispatchOut(BaseModel):
    id: str
    purchase_order_id: str
    dispatch_date: date
    qty: float
    vehicle_ref: str | None
    remarks: str | None

    model_config = {"from_attributes": True}


class DispatchCreateResponse(BaseModel):
    dispatch: DispatchOut | None
    warning: str | None = None
