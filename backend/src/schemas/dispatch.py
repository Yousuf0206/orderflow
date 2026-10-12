from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DispatchLineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    purchase_order_line_id: str
    qty: float = Field(gt=0)


class DispatchCreate(BaseModel):
    # extra="forbid": a pre-006 client sending a top-level `qty` is refused,
    # not recorded as a dispatch of nothing.
    model_config = ConfigDict(extra="forbid")

    dispatch_date: date
    vehicle_ref: str | None = None
    remarks: str | None = None
    lines: list[DispatchLineIn] = Field(min_length=1)
    confirm: bool = False
    # Set when this dispatch is a confirmed scan draft (spec 008 R10). Links
    # the photo for support; changes nothing about the dispatch itself.
    source_scan_id: str | None = None

    @field_validator("lines")
    @classmethod
    def one_entry_per_line(cls, lines: list[DispatchLineIn]) -> list[DispatchLineIn]:
        ids = [line.purchase_order_line_id for line in lines]
        if len(ids) != len(set(ids)):
            raise ValueError("each line may appear only once in a dispatch")
        return lines


class DispatchLineOut(BaseModel):
    purchase_order_line_id: str
    line_no: int
    material: str
    unit: str
    qty: float


class DispatchOut(BaseModel):
    id: str
    purchase_order_id: str
    dispatch_date: date
    vehicle_ref: str | None
    remarks: str | None
    lines: list[DispatchLineOut]


class OverLine(BaseModel):
    purchase_order_line_id: str
    material: str
    unit: str
    remaining: float
    requested: float


Confidence = Literal["high", "medium", "low"]


class ScanField(BaseModel):
    value: str | None
    confidence: Confidence


class ScanDraftLine(BaseModel):
    raw_text: str
    qty: ScanField
    unit: str | None
    matched_line_id: str | None
    match_confidence: Literal["high", "low"] | None


class ScanDraftOut(BaseModel):
    """A draft only (constitution XXXVIII): contracts/parse-document.md."""

    scan_id: str
    document_date: ScanField
    vehicle_ref: ScanField
    lines: list[ScanDraftLine]
    warnings: list[str]


class DispatchCreateResponse(BaseModel):
    dispatch: DispatchOut | None
    warning: str | None = None
    over_lines: list[OverLine] = Field(default_factory=list)
