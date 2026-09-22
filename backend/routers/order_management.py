"""Press-side review for orders placed through the customer portal."""

from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from utilities.database import commit
from services.order_details import order_response
from database import get_db
from models import DesignFile, JobStatusHistory, Order, OrderPayment, User
from access import require_operator
from services.customer_payments import record_settlement, received

router = APIRouter(prefix="/api/press/orders", tags=["Order review"])


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    production_stage: Literal["Awaiting review", "Queued", "In Prepress", "Printing", "Finishing", "Ready for Pickup"]
    approve_artwork: bool = False
    confirm_payment: bool = False
    expected_stage: str | None = None


@router.get("")
def list_orders(operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    return [{
        **order_response(order, db),
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
    } for order in db.query(Order).order_by(Order.order_id.desc()).all()]


@router.patch("/{order_id}")
def review_order(order_id: int, payload: ReviewRequest, operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.order_id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if payload.expected_stage is not None and order.production_stage != payload.expected_stage:
        raise HTTPException(status_code=409, detail="This order was updated by another operator. Refresh orders before trying again.")
    files = db.query(DesignFile).filter(DesignFile.order_id == order_id).all()
    if payload.approve_artwork:
        for file in files:
            file.verification_status = "verified"
    if payload.production_stage != "Awaiting review" and any(file.verification_status != "verified" for file in files):
        raise HTTPException(status_code=422, detail="Review and approve the artwork before moving the order into production.")
    if payload.confirm_payment and order.payment_status != "paid":
        payment = db.query(OrderPayment).filter(OrderPayment.order_id == order_id).first()
        due = order.total_amount - received(payment)
        if due > 0:
            record_settlement(db, order, operator.user_id, due, order.payment_method,
                payment.reference if payment and payment.status != "verified" else "",
                note="Full outstanding balance received through order review.")
        else:
            order.payment_status = "paid"
    if payload.production_stage != order.production_stage:
        order.production_stage = payload.production_stage
        db.add(JobStatusHistory(order_id=order_id, changed_by=operator.user_id, stage=payload.production_stage))
    order.staff_id = operator.user_id
    commit(db)
    return {**order_response(order, db), "customer_name": order.customer_name, "customer_email": order.customer_email}


@router.get("/{order_id}/files/{file_id}")
def download_artwork(order_id: int, file_id: int, operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    file = db.query(DesignFile).filter(DesignFile.order_id == order_id, DesignFile.file_id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Design file not found.")
    return Response(file.content, media_type=file.content_type, headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(file.original_name, safe='')}",
        "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    })
