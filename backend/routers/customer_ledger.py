"""Staff/admin customer debt statements and partial settlements."""
import hashlib
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from access import require_operator
from database import get_db
from models import CustomerPayment, Order, User
from schemas.requests.customer_payment import CustomerPaymentRequest
from services.customer_ledger import balances, statement, customer_record
from services.customer_payments import record_settlement
from utilities.database import commit

router = APIRouter(prefix="/api/press/customer-ledger", tags=["Customer ledger"])
CustomerKind = Literal["account", "walk_in"]


@router.get("")
def list_balances(operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    return balances(db)


@router.get("/{kind}/{customer_id}")
def get_statement(kind: CustomerKind, customer_id: int, operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    return statement(db, kind, customer_id)


@router.post("/{kind}/{customer_id}/payments")
def settle(kind: CustomerKind, customer_id: int, payload: CustomerPaymentRequest, operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    customer_record(db, kind, customer_id)
    identity = Order.customer_id if kind == "account" else Order.walk_in_customer_id
    order = db.query(Order).filter(Order.order_id == payload.order_id, identity == customer_id).with_for_update().first()
    if not order:
        raise HTTPException(404, "This order does not belong to the selected customer.")
    fingerprint = hashlib.sha256(payload.model_dump_json(exclude={"request_key"}).encode()).hexdigest()
    previous = db.query(CustomerPayment).filter(CustomerPayment.request_key == str(payload.request_key)).first()
    if previous:
        if previous.order_id != order.order_id or previous.recorded_by != operator.user_id or previous.request_fingerprint != fingerprint:
            raise HTTPException(409, "This payment submission has already been used with different details.")
        return {"transaction_id": previous.transaction_id, "statement": statement(db, kind, customer_id)}
    receipt = record_settlement(db, order, operator.user_id, Decimal(payload.amount) / 100,
        payload.method, payload.reference, payload.note, str(payload.request_key), fingerprint)
    commit(db, "This payment conflicts with another entry. Refresh the ledger before retrying.")
    return {"transaction_id": receipt.transaction_id, "statement": statement(db, kind, customer_id)}
