"""API routes for supplier purchases, inventory receipts, and accounts payable."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from access import require_admin
from sessions import current_user
from database import get_db
from models import InventoryItem, User, Vendor, VendorPayment, VendorPurchase

from schemas.requests.vendor_ledger import PurchaseRequest, PaymentRequest, ExtractedPurchasesRequest
from services.vendor_ledger import commit_ledger, save_purchase

router = APIRouter(prefix="/api/admin", tags=["Vendor ledger"])


@router.get("/vendor-ledger")
def get_ledger(admin_id: int, db: Session = Depends(get_db)):
    require_admin(admin_id, db)
    payments_by_purchase = {}
    for payment, recorder in db.query(VendorPayment, User.full_name).join(
        User, User.user_id == VendorPayment.recorded_by
    ).order_by(VendorPayment.payment_date.desc(), VendorPayment.vendor_payment_id.desc()).all():
        payments_by_purchase.setdefault(payment.purchase_id, []).append({
            "vendor_payment_id": payment.vendor_payment_id,
            "order_payment_key": payment.order_payment_key,
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
            "order_id": purchase.order_id,
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
    grouped = {}
    for line in purchases:
        key = line['order_id'] or -line['purchase_id']
        order = grouped.setdefault(key, {**line, 'order_id': key, 'lines': [], 'cost': Decimal(0),
                                          'paid': Decimal(0), 'remaining': Decimal(0), 'payments': []})
        order['lines'].append(line)
        for field in ('cost', 'paid', 'remaining'):
            order[field] += Decimal(line[field])
        order['payments'].extend(line['payments'])
    for order in grouped.values():
        combined = {}
        for payment in order['payments']:
            key = payment['order_payment_key'] or payment['vendor_payment_id']
            entry = combined.setdefault(key, {**payment, 'amount': Decimal(0)})
            entry['amount'] += Decimal(payment['amount'])
        order['payments'] = [{**p, 'amount': str(p['amount'])} for p in combined.values()]
        order['payment_status'] = 'paid' if order['remaining'] == 0 else 'partial' if order['paid'] > 0 else 'unpaid'
        for field in ('cost', 'paid', 'remaining'):
            order[field] = str(order[field])
    return {
        "orders": list(grouped.values()),
        "purchases": purchases,
        "items": items,
        "total_cost": str(total_cost),
        "total_paid": str(total_paid),
        "remaining": str(total_cost - total_paid),
    }


@router.post("/vendors/{vendor_id}/purchases", status_code=201)
def create_purchase(vendor_id: int, payload: PurchaseRequest, db: Session = Depends(get_db)):
    return save_purchase(vendor_id, payload, db)


@router.post('/vendors/{vendor_id}/extracted-purchases', status_code=201)
def save_extracted_purchases(vendor_id: int, payload: ExtractedPurchasesRequest,
                             db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role != 'admin' or any(row.admin_id != user.user_id for row in payload.rows):
        raise HTTPException(403, 'Administrator access is required.')
    keys = [str(row.request_key) for row in payload.rows]
    if len(set(keys)) != len(keys):
        raise HTTPException(422, 'Each extracted row must have a unique request key.')
    if not db.query(Vendor).filter(Vendor.vendor_id == vendor_id).with_for_update().first():
        raise HTTPException(404, 'Vendor not found.')
    existing = db.query(VendorPurchase).filter(VendorPurchase.request_key.in_(keys)).all()
    if existing:
        if len(existing) == len(keys) and all(row.vendor_id == vendor_id for row in existing):
            return {'purchase_ids': [row.purchase_id for row in existing], 'already_saved': True}
        raise HTTPException(409, 'Some rows were already recorded. Refresh the ledger before saving again.')
    try:
        first = save_purchase(vendor_id, payload.rows[0], db, commit=False, reuse_existing=True)['purchase_id']
        order_id = db.get(VendorPurchase, first).order_id
        ids = [first] + [save_purchase(vendor_id, row, db, commit=False, reuse_existing=True, order_id=order_id)['purchase_id'] for row in payload.rows[1:]]
        commit_ledger(db)
        return {'order_id': order_id, 'purchase_ids': ids, 'already_saved': False}
    except Exception:
        db.rollback()
        raise


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
