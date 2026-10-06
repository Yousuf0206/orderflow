from datetime import date

from pydantic import BaseModel, Field, field_validator


class PurchaseOrderCreate(BaseModel):
    party_id: str
    po_number: str = Field(min_length=1, max_length=50)
    material: str = Field(min_length=1, max_length=200)
    ordered_qty: float = Field(gt=0)
    unit: str = Field(min_length=1, max_length=20)
    order_date: date
    due_date: date
    notes: str | None = None

    @field_validator("due_date")
    @classmethod
    def due_after_order(cls, due_date: date, info):
        order_date = info.data.get("order_date")
        if order_date and due_date < order_date:
            raise ValueError("due_date must be on or after order_date")
        return due_date


class PurchaseOrderUpdate(BaseModel):
    material: str | None = None
    unit: str | None = None
    due_date: date | None = None
    notes: str | None = None


class PurchaseOrderOut(BaseModel):
    id: str
    party_id: str
    po_number: str
    material: str
    ordered_qty: float
    unit: str
    order_date: date
    due_date: date
    notes: str | None
    total_dispatched: float
    remaining_balance: float
    days_to_delivery: int
    status: str

    model_config = {"from_attributes": True}
