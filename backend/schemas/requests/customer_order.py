"""Customer artwork assignments and local-payment checkout validation."""
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


class CustomerInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ArtworkRequest(CustomerInput):
    name: str = Field(min_length=1, max_length=255)
    data_url: str = Field(max_length=14_000_000)


class ItemDesignRequest(CustomerInput):
    quantity: int = Field(gt=0, le=100000)
    brief: str = Field(default="", max_length=4000)
    file: ArtworkRequest | None = None

    @model_validator(mode="after")
    def artwork_or_brief(self):
        if not self.file and not self.brief:
            raise ValueError("Upload a file or describe the design for each design group.")
        return self


class CartItemRequest(CustomerInput):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100000)
    specifications: str = Field(default="", max_length=2000)
    designs: list[ItemDesignRequest] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def quantities_match(self):
        if self.designs and sum(d.quantity for d in self.designs) != self.quantity:
            raise ValueError("Design quantities must add up to the item quantity.")
        return self


class OrderRequest(CustomerInput):
    request_key: UUID
    items: list[CartItemRequest] = Field(min_length=1, max_length=30)
    # Retain support for older baskets with an order-level brief or attachment.
    files: list[ArtworkRequest] = Field(default_factory=list, max_length=3)
    design_request_note: str = Field(default="", max_length=4000)
    contact_phone: str = Field(min_length=3, max_length=50)
    expected_total: int = Field(ge=0, le=99_999_999_999_999)
    payment_reference: str = Field(default="", max_length=0)
    payment_method: Literal["cash"] = "cash"
    payment_timing: Literal["after_pickup"] = "after_pickup"

    @model_validator(mode="after")
    def validate_designs(self):
        ids = [item.product_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Combine quantities for the same product into one cart item.")
        if any(not item.designs for item in self.items) and not self.files and not self.design_request_note:
            raise ValueError("Provide artwork or a design brief for every item.")
        count = len(self.files) + sum(d.file is not None for item in self.items for d in item.designs)
        if count > 30:
            raise ValueError("Attach at most 30 design files per order (20 MB combined).")
        return self
