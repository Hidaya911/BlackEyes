"""Money comes from the UI in integer cents, just like order entry."""
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class CustomerPaymentRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    request_key: UUID
    order_id: int = Field(gt=0)
    amount: int = Field(gt=0, le=99_999_999_999_999, strict=True)
    method: Literal["cash", "whish_money"] = "cash"
    reference: str = Field(default="", max_length=100)
    note: str = Field(default="", max_length=1000)
