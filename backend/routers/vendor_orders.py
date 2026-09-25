"""Whole-order payments and stock-safe deletion for vendor invoices."""
from collections import defaultdict
from decimal import Decimal
from uuid import uuid5
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import VendorOrder, VendorPurchase, VendorPayment, InventoryItem, InventoryTransaction, User
from sessions import current_user
from routers.vendor_ledger import PaymentRequest, commit_ledger

router = APIRouter(prefix='/api/admin/vendor-orders', tags=['Vendor orders'])


def admin_user(user: User = Depends(current_user)):
    if user.role != 'admin':
        raise HTTPException(403, 'Administrator access is required.')
    return user


def locked_order(db, order_id):
    order = db.query(VendorOrder).filter(VendorOrder.order_id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(404, 'Vendor order not found.')
    lines = db.query(VendorPurchase).filter(VendorPurchase.order_id == order_id).order_by(VendorPurchase.purchase_id).with_for_update().all()
    return order, lines


@router.post('/{order_id}/payments', status_code=201)
def pay_order(order_id: int, payload: PaymentRequest, user: User = Depends(admin_user), db: Session = Depends(get_db)):
    if payload.admin_id != user.user_id:
        raise HTTPException(403, 'Administrator access is required.')
    order, lines = locked_order(db, order_id)
    if payload.payment_date < order.purchase_date:
        raise HTTPException(422, 'Payment date cannot be before the order date.')
    if db.query(VendorPayment).filter(VendorPayment.order_payment_key == str(payload.request_key)).first():
        raise HTTPException(409, 'This payment was already recorded. Refresh the ledger.')
    paid = defaultdict(Decimal)
    for payment in db.query(VendorPayment).filter(VendorPayment.purchase_id.in_([line.purchase_id for line in lines])).all():
        paid[payment.purchase_id] += payment.amount
    due = sum((line.cost - paid[line.purchase_id] for line in lines), Decimal(0))
    if payload.amount > due:
        raise HTTPException(422, 'Payment exceeds the outstanding order balance.')
    remaining = payload.amount
    for line in lines:
        amount = min(remaining, line.cost - paid[line.purchase_id])
        if amount <= 0:
            continue
        db.add(VendorPayment(purchase_id=line.purchase_id, amount=amount, method=payload.method,
            payment_date=payload.payment_date, reference=payload.reference or None, recorded_by=user.user_id,
            request_key=str(uuid5(payload.request_key, str(line.purchase_id))), order_payment_key=str(payload.request_key)))
        remaining -= amount
    commit_ledger(db)
    return {'order_id': order_id}


@router.delete('/{order_id}')
def delete_order(order_id: int, user: User = Depends(admin_user), db: Session = Depends(get_db)):
    order, lines = locked_order(db, order_id)
    ids = [line.purchase_id for line in lines]
    if db.query(VendorPayment).filter(VendorPayment.purchase_id.in_(ids)).first():
        raise HTTPException(409, 'Orders with recorded payments cannot be deleted.')
    quantities = defaultdict(Decimal)
    for line in lines:
        quantities[line.item_id] += line.quantity
    stock = db.query(InventoryItem).filter(InventoryItem.item_id.in_(quantities)).order_by(InventoryItem.item_id).with_for_update().all()
    if len(stock) != len(quantities) or any(item.quantity_on_hand < quantities[item.item_id] for item in stock):
        raise HTTPException(409, 'This order cannot be deleted because some received stock has already been used.')
    try:
        # Preserve receipt history and record compensating stock movements.
        for receipt in db.query(InventoryTransaction).filter(InventoryTransaction.purchase_id.in_(ids)).all():
            receipt.purchase_id = None
        for item in stock:
            item.quantity_on_hand -= quantities[item.item_id]
            db.add(InventoryTransaction(item_id=item.item_id, movement_type='remove',
                quantity=quantities[item.item_id], changed_by=user.user_id))
        db.flush()
        for line in lines:
            db.delete(line)
        db.flush()
        db.delete(order)
        commit_ledger(db)
    except Exception:
        db.rollback()
        raise
    return {'deleted_order_id': order_id}
