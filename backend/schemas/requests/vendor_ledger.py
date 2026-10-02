"""Validated input contracts for supplier purchases and payments."""
from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MoneyMethod = Literal["cash", "bank_transfer", "whish_money", "other"]
MAX_MONEY = Decimal("999999999999.99")
MAX_QUANTITY = Decimal("99999999999.999")


class LedgerRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    admin_id: int
    request_key: UUID


class PurchaseRequest(LedgerRequest):
    item_id: int | None = Field(default=None, gt=0)
    item_name: str = Field(default="", max_length=255)
    item_type: Literal["paper", "ink", "other"] = "paper"
    unit: str = Field(default="", max_length=30)
    low_stock_threshold: Decimal = Field(default=Decimal(0), ge=0, max_digits=14, decimal_places=3)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    unit_price: Decimal = Field(ge=0, max_digits=18, decimal_places=6)
    purchase_date: date
    invoice_reference: str = Field(default="", max_length=100)
    initial_payment: Decimal = Field(default=Decimal(0), ge=0, max_digits=14, decimal_places=2)
    payment_method: MoneyMethod = "cash"

    @field_validator("purchase_date")
    @classmethod
    def no_future_purchase(cls, value):
        if value > date.today():
            raise ValueError("Purchase date cannot be in the future.")
        return value

    @model_validator(mode="after")
    def check_new_item(self):
        if self.item_id is None and (not self.item_name or not self.unit):
            raise ValueError("Item name and unit are required for a new inventory item.")
        return self


class PaymentRequest(LedgerRequest):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    payment_date: date
    method: MoneyMethod = "cash"
    reference: str = Field(default="", max_length=100)

    @field_validator("payment_date")
    @classmethod
    def no_future_payment(cls, value):
        if value > date.today():
            raise ValueError("Payment date cannot be in the future.")
        return value


class ExtractedPurchasesRequest(BaseModel):
    rows: list[PurchaseRequest] = Field(min_length=1, max_length=100)

    @model_validator(mode='after')
    def same_invoice(self):
        if len({(row.purchase_date, row.invoice_reference) for row in self.rows}) != 1:
            raise ValueError('All items must belong to the same invoice and purchase date.')
        return self


