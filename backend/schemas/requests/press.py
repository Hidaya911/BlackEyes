"""Validated input for in-press orders and operator settings."""

import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PressInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ContactInput(PressInput):
    full_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=3, max_length=50)
    email: str = Field(default="", max_length=255)
    address: str = Field(default="", max_length=500)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        if value and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address.")
        return value.lower()


class LocalOrderItem(PressInput):
    product_id: int | None = Field(default=None, gt=0)
    name: str = Field(default="", max_length=255)
    quantity: int = Field(gt=0, le=100000)
    unit_price: int | None = Field(default=None, ge=0, le=99_999_999)
    specifications: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def custom_details(self):
        if self.product_id is None and (not self.name or self.unit_price is None):
            raise ValueError("Custom jobs need a name and unit price.")
        return self


class LocalArtwork(PressInput):
    name: str = Field(min_length=1, max_length=255)
    data_url: str = Field(max_length=14_000_000)


class LocalOrderRequest(PressInput):
    request_key: UUID
    customer_id: int | None = Field(default=None, gt=0)
    walk_in_customer_id: int | None = Field(default=None, gt=0)
    customer: ContactInput | None = None
    contact_phone: str = Field(default="", max_length=50)
    items: list[LocalOrderItem] = Field(min_length=1, max_length=30)
    files: list[LocalArtwork] = Field(default_factory=list, max_length=3)
    design_request_note: str = Field(default="", max_length=4000)
    expected_total: int = Field(ge=0, le=99_999_999_999_999)
    amount_paid: int = Field(default=0, ge=0, le=99_999_999_999_999)
    payment_method: Literal["cash", "whish_money"] = "cash"
    payment_reference: str = Field(default="", max_length=100)

    @model_validator(mode="after")
    def validate_order(self):
        if sum(value is not None for value in (self.customer_id, self.walk_in_customer_id, self.customer)) != 1:
            raise ValueError("Choose one existing customer or enter a new customer's details.")
        if self.amount_paid > self.expected_total:
            raise ValueError("Payment cannot exceed the order total.")
        if self.payment_method == "cash" and self.payment_reference:
            raise ValueError("Cash payments do not need a transfer reference.")
        if self.payment_method == "whish_money" and self.amount_paid and len(self.payment_reference) < 3:
            raise ValueError("Enter the reference for the received Whish payment.")
        if self.payment_reference and not self.amount_paid:
            raise ValueError("A payment reference needs a received payment amount.")
        return self


class OperatorProfile(ContactInput):
    phone: str = Field(default="", max_length=50)
    email: str = Field(min_length=3, max_length=255)
    profile_image: str | None = Field(default=None, max_length=1_500_000)


class OperatorPassword(PressInput):
    model_config = ConfigDict(str_strip_whitespace=False, extra="forbid")
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode()) > 72:
            raise ValueError("Use a password of at most 72 UTF-8 bytes.")
        return value
