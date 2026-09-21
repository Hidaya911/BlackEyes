"""Admin management of login customers and saved walk-in contacts."""
import re
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session
from database import get_db
from models import User, WalkInCustomer, Order, UserSession, CustomerSpecialPrice
from sessions import current_user, pwd_context
from utilities.database import commit

router = APIRouter(prefix="/api/admin/customers", tags=["Customers"])


def admin_session(user: User = Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Administrator access is required.")
    return user


class CustomerInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=50)
    address: str = Field(default="", max_length=500)
    status: Literal["active", "inactive"] = "active"
    password: str = Field(default="", max_length=72)

    @model_validator(mode="after")
    def validate_fields(self):
        self.email = self.email.lower()
        if self.email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", self.email):
            raise ValueError("Enter a valid email address.")
        if self.password and (len(self.password) < 8 or len(self.password.encode()) > 72):
            raise ValueError("Password must contain at least 8 characters and at most 72 UTF-8 bytes.")
        return self


def record(db, kind, customer_id):
    if kind not in {"account", "walk_in"}:
        raise HTTPException(404, "Customer not found.")
    query = db.query(User).filter(User.user_id == customer_id, User.role == "customer") if kind == "account" else db.query(WalkInCustomer).filter(WalkInCustomer.customer_id == customer_id)
    person = query.with_for_update().first()
    if not person:
        raise HTTPException(404, "Customer not found.")
    return person


def response(person, kind):
    return dict(id=person.user_id if kind == "account" else person.customer_id, kind=kind,
        full_name=person.full_name, email=person.email or "", phone=person.phone or "",
        address=person.address or "", status=person.status if kind == "account" else "active")


@router.get("")
def list_customers(admin=Depends(admin_session), db: Session = Depends(get_db)):
    return [response(p, kind) for kind, records in (
        ("account", db.query(User).filter(User.role == "customer").order_by(User.full_name).all()),
        ("walk_in", db.query(WalkInCustomer).order_by(WalkInCustomer.full_name).all())) for p in records]


@router.post("/{kind}", status_code=201)
def create_customer(kind: Literal["account", "walk_in"], payload: CustomerInput, admin=Depends(admin_session), db: Session = Depends(get_db)):
    values = payload.model_dump(exclude={"password", "status"})
    if kind == "account":
        if not payload.email or not payload.password:
            raise HTTPException(422, "Email and password are required for a login account.")
        person = User(**values, role="customer", status=payload.status, password_hash=pwd_context.hash(payload.password))
    else:
        if len(payload.phone) < 3:
            raise HTTPException(422, "Enter a contact phone.")
        person = WalkInCustomer(**values, created_by=admin.user_id)
    db.add(person)
    commit(db, "This email is already in use.")
    return response(person, kind)


@router.put("/{kind}/{customer_id}")
def update_customer(kind: str, customer_id: int, payload: CustomerInput, admin=Depends(admin_session), db: Session = Depends(get_db)):
    person = record(db, kind, customer_id)
    if kind == "account" and not payload.email:
        raise HTTPException(422, "Email is required.")
    if kind == "walk_in" and len(payload.phone) < 3:
        raise HTTPException(422, "Enter a contact phone.")
    for key, value in payload.model_dump(exclude={"password", "status"}).items():
        setattr(person, key, value)
    if kind == "account":
        person.status = payload.status
        if payload.password:
            person.password_hash = pwd_context.hash(payload.password)
        if payload.password or payload.status == "inactive":
            db.query(UserSession).filter(UserSession.user_id == customer_id).delete()
    commit(db, "This email is already in use.")
    return response(person, kind)


@router.delete("/{kind}/{customer_id}")
def delete_customer(kind: str, customer_id: int, admin=Depends(admin_session), db: Session = Depends(get_db)):
    person = record(db, kind, customer_id)
    column = Order.customer_id if kind == "account" else Order.walk_in_customer_id
    if db.query(Order).filter(column == customer_id).first():
        raise HTTPException(409, "This customer has orders and cannot be deleted. You can deactivate a login account to preserve its history.")
    if kind == "account":
        db.query(UserSession).filter(UserSession.user_id == customer_id).delete()
        db.query(CustomerSpecialPrice).filter(CustomerSpecialPrice.customer_id == customer_id).delete()
    db.delete(person)
    commit(db)
    return {"message": "Customer deleted."}
