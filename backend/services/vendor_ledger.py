"""Transactional supplier purchase and stock receipt operations."""
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from access import require_admin
from models import InventoryItem, InventoryTransaction, Vendor, VendorPayment, VendorPurchase, VendorOrder
from schemas.requests.vendor_ledger import MAX_MONEY, MAX_QUANTITY


def commit_ledger(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This entry was already recorded or its linked record changed. Refresh the ledger before trying again.")


def save_purchase(vendor_id, payload, db, commit=True, reuse_existing=False, order_id=None):
    require_admin(payload.admin_id, db)
    vendor = db.query(Vendor).filter(Vendor.vendor_id == vendor_id).with_for_update().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    if order_id is None:
        order = None
        if payload.invoice_reference:
            order = db.query(VendorOrder).filter(VendorOrder.vendor_id == vendor_id,
                VendorOrder.purchase_date == payload.purchase_date,
                func.lower(VendorOrder.invoice_reference) == payload.invoice_reference.lower()).first()
        if order is None:
            order = VendorOrder(vendor_id=vendor_id, purchase_date=payload.purchase_date,
                                invoice_reference=payload.invoice_reference or None, created_by=payload.admin_id)
            db.add(order)
            db.flush()
        order_id = order.order_id
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
        if item and not reuse_existing:
            raise HTTPException(status_code=409, detail="This inventory item already exists. Select it from existing items.")
        if not item:
            item = InventoryItem(name=payload.item_name, type=payload.item_type, unit=payload.unit.lower(),
                                 low_stock_threshold=payload.low_stock_threshold, quantity_on_hand=Decimal(0))
            db.add(item)

    if item.quantity_on_hand + payload.quantity > MAX_QUANTITY:
        raise HTTPException(status_code=422, detail="Resulting inventory quantity is too large.")
    try:
        db.flush()
        purchase = VendorPurchase(
            order_id=order_id,
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
        if commit:
            commit_ledger(db)
        else:
            db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A matching entry already exists. Refresh the ledger and select the existing item.")
    return {"purchase_id": purchase.purchase_id}


