"""Verified payment history and atomic updates to existing order balances.

Callers must lock the order before recording a settlement. No function commits.
"""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from models import CustomerPayment, OrderPayment


def received(payment):
    return payment.amount if payment and payment.status == "verified" else Decimal(0)


def preserve_previous_payment(db, order, payment):
    """Import the old cumulative receipt once, without inventing installments."""
    history = db.query(CustomerPayment).filter(CustomerPayment.order_id == order.order_id).all()
    paid = received(payment)
    if history:
        if sum((row.amount for row in history), Decimal(0)) != paid:
            raise HTTPException(409, "Payment history and balance differ. Please ask an administrator to reconcile this order.")
    elif paid > 0:
        db.add(CustomerPayment(order_id=order.order_id, amount=paid, method=payment.method,
            reference=payment.reference, source="legacy", recorded_by=payment.confirmed_by,
            recorded_at=payment.confirmed_at or payment.payment_date or order.created_at,
            request_key=f"legacy-payment-{payment.payment_id}",
            note="Previous verified payment total. Individual earlier installments are unavailable."))


def record_settlement(db, order, operator_id, amount, method, reference="", note="", request_key=None, fingerprint=None):
    payment = db.query(OrderPayment).filter(OrderPayment.order_id == order.order_id).first()
    paid = received(payment)
    if amount <= 0 or amount > order.total_amount - paid:
        raise HTTPException(409, "Payment exceeds the current outstanding balance. Refresh the ledger before retrying.")
    preserve_previous_payment(db, order, payment)
    now = datetime.now(timezone.utc)
    transaction = CustomerPayment(order_id=order.order_id, amount=amount, method=method,
        reference=reference or None, note=note or None, recorded_by=operator_id, recorded_at=now,
        source="settlement", request_key=request_key or str(uuid4()), request_fingerprint=fingerprint)
    db.add(transaction)
    if not payment:
        payment = OrderPayment(order_id=order.order_id)
        db.add(payment)
    payment.amount = paid + amount
    payment.remaining = order.total_amount - payment.amount
    payment.status = "verified"
    payment.method = method
    payment.reference = reference or None
    payment.confirmed_by = operator_id
    payment.confirmed_at = now
    order.payment_status = "paid" if payment.remaining == 0 else "partially_paid"
    # The summary describes the most recently received method; older ones remain in history.
    order.payment_method = method
    return transaction
