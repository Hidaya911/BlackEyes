"""Counter order entry for authenticated staff and administrators."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from access import require_operator
from database import get_db
from models import User
from schemas.requests.press import LocalOrderRequest
from services.press_orders import catalog, create_local_order, customer_options

router = APIRouter(prefix="/api/press", tags=["Counter orders"])


@router.get("/customers")
def find_customers(q: str = Query(default="", max_length=255), operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    return customer_options(db, q.strip())


@router.get("/catalog")
def get_catalog(customer_id: int | None = Query(default=None, gt=0), operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    return catalog(db, customer_id)


@router.post("/orders", status_code=201)
def create_order(payload: LocalOrderRequest, operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    return create_local_order(payload, operator, db)
