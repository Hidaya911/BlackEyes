"""Read-only invoice and verified payment receipt snapshots."""
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from access import require_operator
from database import get_db
from models import Order, OrderPayment, User
from services.press_orders import press_order_response

router = APIRouter(prefix="/api/press/orders", tags=["Order documents"])


@router.get("/{order_id}/documents/{kind}")
def document(order_id: int, kind: Literal["invoice", "receipt"], operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found.")
    payment = db.query(OrderPayment).filter(OrderPayment.order_id == order_id).first()
    if kind == "receipt" and (not payment or payment.status != "verified" or payment.amount <= 0):
        raise HTTPException(409, "A receipt is available after a payment has been received and verified.")
    return {
        "kind": kind,
        "number": f"INV-{order.order_id:06d}" if kind == "invoice" else f"RCT-{payment.payment_id:06d}",
        "generated_at": datetime.now(timezone.utc),
        "payment_confirmed_at": payment.confirmed_at if payment and payment.status == "verified" else None,
        "order": press_order_response(order, db),
    }
