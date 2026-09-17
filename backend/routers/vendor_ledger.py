"""API routes for supplier purchases, inventory receipts, and accounts payable."""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from access import require_admin
from database import get_db
from models import InventoryItem, InventoryTransaction, User, Vendor, VendorPayment, VendorPurchase

router = APIRouter(prefix="/api/admin", tags=["Vendor ledger"])
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
    unit_price: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
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


def commit_ledger(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This entry was already recorded or its linked record changed. Refresh the ledger before trying again.")


@router.get("/vendor-ledger")
def get_ledger(admin_id: int, db: Session = Depends(get_db)):
    require_admin(admin_id, db)
    payments_by_purchase = {}
    for payment, recorder in db.query(VendorPayment, User.full_name).join(
        User, User.user_id == VendorPayment.recorded_by
    ).order_by(VendorPayment.payment_date.desc(), VendorPayment.vendor_payment_id.desc()).all():
        payments_by_purchase.setdefault(payment.purchase_id, []).append({
            "vendor_payment_id": payment.vendor_payment_id,
            "amount": str(payment.amount),
            "method": payment.method,
            "payment_date": payment.payment_date,
            "reference": payment.reference,
            "recorded_by": recorder,
        })

    purchases = []
    total_cost = Decimal(0)
    total_paid = Decimal(0)
    rows = db.query(VendorPurchase, InventoryItem, Vendor.name, User.full_name).join(
        InventoryItem, VendorPurchase.item_id == InventoryItem.item_id
    ).join(Vendor, VendorPurchase.vendor_id == Vendor.vendor_id).join(
        User, VendorPurchase.created_by == User.user_id
    ).order_by(VendorPurchase.purchase_date.desc(), VendorPurchase.purchase_id.desc()).all()
    for purchase, item, vendor_name, admin_name in rows:
        payments = payments_by_purchase.get(purchase.purchase_id, [])
        paid = sum((Decimal(payment["amount"]) for payment in payments), Decimal(0))
        remaining = purchase.cost - paid
        total_cost += purchase.cost
        total_paid += paid
        purchases.append({
            "purchase_id": purchase.purchase_id,
            "vendor_id": purchase.vendor_id,
            "vendor_name": vendor_name,
            "item_id": item.item_id,
            "item_name": item.name,
            "item_type": item.type,
            "unit": item.unit,
            "quantity": str(purchase.quantity),
            "unit_price": str(purchase.unit_price),
            "cost": str(purchase.cost),
            "paid": str(paid),
            "remaining": str(remaining),
            "payment_status": "paid" if remaining == 0 else "partial" if paid > 0 else "unpaid",
            "purchase_date": purchase.purchase_date,
            "invoice_reference": purchase.invoice_reference,
            "created_by": admin_name,
            "payments": payments,
        })

    items = [{
        "item_id": item.item_id,
        "name": item.name,
        "type": item.type,
        "unit": item.unit,
        "quantity_on_hand": str(item.quantity_on_hand),
        "low_stock_threshold": str(item.low_stock_threshold),
    } for item in db.query(InventoryItem).order_by(InventoryItem.name).all()]
    return {
        "purchases": purchases,
        "items": items,
        "total_cost": str(total_cost),
        "total_paid": str(total_paid),
        "remaining": str(total_cost - total_paid),
    }


@router.post("/vendors/{vendor_id}/purchases", status_code=201)
def create_purchase(vendor_id: int, payload: PurchaseRequest, db: Session = Depends(get_db)):
    require_admin(payload.admin_id, db)
    vendor = db.query(Vendor).filter(Vendor.vendor_id == vendor_id).with_for_update().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    if db.query(VendorPurchase).filter(VendorPurchase.request_key == str(payload.request_key)).first():
        raise HTTPException(status_code=409, detail="This purchase was already recorded. Refresh the ledger to see it.")
    cost = (payload.quantity * payload.unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if cost > MAX_MONEY:
        raise HTTPException(status_code=422, detail="Purchase total is too large.")
    if payload.initial_payment > cost:
        raise HTTPException(status_code=422, detail="Payment cannot exceed the purchase total.")

    if payload.item_id:
        item = db.query(InventoryItem).filter(InventoryItem.item_id == payload.item_id).with_for_update().first()
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found.")
    else:
        item = db.query(InventoryItem).filter(
            func.lower(InventoryItem.name) == payload.item_name.lower(),
            InventoryItem.type == payload.item_type,
            func.lower(InventoryItem.unit) == payload.unit.lower(),
        ).with_for_update().first()
        if item:
            raise HTTPException(status_code=409, detail="This inventory item already exists. Select it from existing items.")
        item = InventoryItem(
            name=payload.item_name,
            type=payload.item_type,
            unit=payload.unit.lower(),
            low_stock_threshold=payload.low_stock_threshold,
            quantity_on_hand=Decimal(0),
        )
        db.add(item)

    if item.quantity_on_hand + payload.quantity > MAX_QUANTITY:
        raise HTTPException(status_code=422, detail="Resulting inventory quantity is too large.")
    try:
        db.flush()
        purchase = VendorPurchase(
            vendor_id=vendor_id,
            item_id=item.item_id,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            cost=cost,
            purchase_date=payload.purchase_date,
            invoice_reference=payload.invoice_reference or None,
            created_by=payload.admin_id,
            request_key=str(payload.request_key),
        )
        db.add(purchase)
        db.flush()
        item.quantity_on_hand += payload.quantity
        db.add(InventoryTransaction(
            item_id=item.item_id,
            purchase_id=purchase.purchase_id,
            movement_type="add",
            quantity=payload.quantity,
            changed_by=payload.admin_id,
        ))
        if payload.initial_payment:
            db.add(VendorPayment(
                purchase_id=purchase.purchase_id,
                amount=payload.initial_payment,
                method=payload.payment_method,
                payment_date=payload.purchase_date,
                reference=payload.invoice_reference or None,
                recorded_by=payload.admin_id,
                request_key=str(uuid4()),
            ))
        commit_ledger(db)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A matching entry already exists. Refresh the ledger and select the existing item.")
    return {"purchase_id": purchase.purchase_id}


@router.post("/vendor-purchases/{purchase_id}/payments", status_code=201)
def record_payment(purchase_id: int, payload: PaymentRequest, db: Session = Depends(get_db)):
    require_admin(payload.admin_id, db)
    # Serialize payments on a purchase so simultaneous requests cannot overpay it.
    purchase = db.query(VendorPurchase).filter(VendorPurchase.purchase_id == purchase_id).with_for_update().first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found.")
    if db.query(VendorPayment).filter(VendorPayment.request_key == str(payload.request_key)).first():
        raise HTTPException(status_code=409, detail="This payment was already recorded. Refresh the ledger to see it.")
    if payload.payment_date < purchase.purchase_date:
        raise HTTPException(status_code=422, detail="Payment date cannot be before the purchase date.")
    paid = db.query(func.coalesce(func.sum(VendorPayment.amount), 0)).filter(
        VendorPayment.purchase_id == purchase_id
    ).scalar()
    if payload.amount > purchase.cost - paid:
        raise HTTPException(status_code=422, detail="Payment exceeds the outstanding balance. Refresh the ledger to check the latest amount.")
    payment = VendorPayment(
        purchase_id=purchase_id,
        amount=payload.amount,
        method=payload.method,
        payment_date=payload.payment_date,
        reference=payload.reference or None,
        recorded_by=payload.admin_id,
        request_key=str(payload.request_key),
    )
    db.add(payment)
    commit_ledger(db)
    return {"vendor_payment_id": payment.vendor_payment_id}
