from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PurchaseOrderLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    material: str = Field(min_length=1, max_length=200)
    ordered_qty: float = Field(gt=0)
    unit: str = Field(min_length=1, max_length=20)

    @field_validator("material", "unit")
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class PurchaseOrderCreate(BaseModel):
    # extra="forbid" so a client still sending the pre-006 top-level
    # material/ordered_qty/unit gets a 422 instead of a PO with those silently
    # dropped.
    model_config = ConfigDict(extra="forbid")

    party_id: str
    po_number: str = Field(min_length=1, max_length=50)
    order_date: date
    due_date: date
    notes: str | None = None
    lines: list[PurchaseOrderLineIn] = Field(min_length=1)

    @field_validator("due_date")
    @classmethod
    def due_after_order(cls, due_date: date, info):
        order_date = info.data.get("order_date")
        if order_date and due_date < order_date:
            raise ValueError("due_date must be on or after order_date")
        return due_date


class PurchaseOrderUpdate(BaseModel):
    """Header edits only. Changing lines after create is out of scope for 006."""

    model_config = ConfigDict(extra="forbid")

    due_date: date | None = None
    notes: str | None = None


class PurchaseOrderLineOut(BaseModel):
    id: str
    line_no: int
    material: str
    unit: str
    ordered_qty: float
    dispatched_qty: float
    remaining_qty: float


class UnitRemaining(BaseModel):
    unit: str
    remaining: float


class PurchaseOrderOut(BaseModel):
    id: str
    party_id: str
    po_number: str
    order_date: date
    due_date: date
    notes: str | None
    days_to_delivery: int
    status: str
    item_count: int
    material_summary: str
    lines: list[PurchaseOrderLineOut]
    remaining_by_unit: list[UnitRemaining]
