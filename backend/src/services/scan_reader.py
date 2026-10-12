"""Reads a delivery-note photo into raw draft fields (spec 008 research R1).

One vision call with a forced tool whose input schema is the draft shape, so
the reply is data, not prose. Nothing returned here is trusted: scan_matching
validates every field and matches rows to purchase order lines itself.

Tests replace `get_reader` through FastAPI's dependency overrides; no test
calls the vendor (constitution XXVII).
"""
import base64
from typing import Any, Literal, Protocol

from src.core.config import settings

READ_TIMEOUT_S = 12.0

# Anthropic "Covered Models" require 30-day retention and are excluded from
# Zero Data Retention, so they may never read a delivery note.
# https://support.claude.com/en/articles/15425695-covered-models
ZDR_EXCLUDED_MODEL_MARKERS = ("fable", "mythos")


def zero_retention_ready() -> bool:
    """True only when the reading service is configured not to retain images.

    Keep this call to the plain Messages API with a client tool and an inline
    image: those are ZDR-eligible. Do not add the Files API, Batches, code
    execution, MCP connector or skills here -- they are not covered by ZDR.
    """
    model = settings.scan_model.lower()
    return settings.anthropic_zero_retention_confirmed and not any(
        marker in model for marker in ZDR_EXCLUDED_MODEL_MARKERS
    )

ReaderFailure = Literal["unreadable", "reader_failed", "reader_timeout"]


class ReaderError(Exception):
    def __init__(self, kind: ReaderFailure):
        super().__init__(kind)
        self.kind = kind


class Reader(Protocol):
    def read(self, image: bytes, content_type: str) -> dict[str, Any]: ...


_CONF = {"type": "string", "enum": ["high", "medium", "low"]}

DRAFT_TOOL = {
    "name": "record_delivery_note",
    "description": "Record what is printed or written on this delivery note / goods-received note.",
    "input_schema": {
        "type": "object",
        "properties": {
            "readable": {
                "type": "boolean",
                "description": "False if the image is not a legible delivery note.",
            },
            "document_date": {"type": ["string", "null"], "description": "YYYY-MM-DD, or null"},
            "document_date_confidence": _CONF,
            "vehicle_ref": {"type": ["string", "null"], "description": "Vehicle / truck / reference number"},
            "vehicle_ref_confidence": _CONF,
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string", "description": "Material as written"},
                        "qty": {"type": ["string", "null"], "description": "Quantity digits only, or null"},
                        "qty_confidence": _CONF,
                        "unit": {"type": ["string", "null"]},
                        "handwritten": {"type": "boolean"},
                    },
                    "required": ["description", "qty", "qty_confidence", "unit", "handwritten"],
                },
            },
        },
        "required": [
            "readable",
            "document_date",
            "document_date_confidence",
            "vehicle_ref",
            "vehicle_ref_confidence",
            "lines",
        ],
    },
}

PROMPT = (
    "This is a photo of a delivery note or goods-received note for building materials. "
    "Copy what it says into the tool. Do not guess: if a value is unclear, give your best reading "
    "with confidence 'low', or null if you cannot read it at all. Do not convert units. "
    "Do not add items that are not on the note."
)


class AnthropicReader:
    def read(self, image: bytes, content_type: str) -> dict[str, Any]:
        import anthropic

        client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key, timeout=READ_TIMEOUT_S, max_retries=0
        )
        try:
            message = client.messages.create(
                model=settings.scan_model,
                max_tokens=2000,
                tools=[DRAFT_TOOL],
                tool_choice={"type": "tool", "name": DRAFT_TOOL["name"]},
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": content_type,
                                    "data": base64.b64encode(image).decode("ascii"),
                                },
                            },
                            {"type": "text", "text": PROMPT},
                        ],
                    }
                ],
            )
        except anthropic.APITimeoutError as exc:
            raise ReaderError("reader_timeout") from exc
        except anthropic.APIError as exc:
            raise ReaderError("reader_failed") from exc

        for block in message.content:
            if block.type == "tool_use" and block.name == DRAFT_TOOL["name"]:
                data = block.input
                if not isinstance(data, dict):
                    raise ReaderError("reader_failed")
                if not data.get("readable", False):
                    raise ReaderError("unreadable")
                return data
        raise ReaderError("reader_failed")


def get_reader() -> Reader:
    return AnthropicReader()
