"""Customer API routes for profiles, catalog, orders, payments, and artwork."""

from decimal import Decimal
import re
import os
from typing import Literal
from uuid import UUID, uuid4
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from utilities.files import decode_artwork, MAX_TOTAL_FILE_BYTES
from utilities.database import commit
from services.order_details import order_response
from services.profiles import profile_response, set_profile_image
from database import get_db
from models import CustomerSpecialPrice, DesignFile, JobStatusHistory, Order, OrderItem, OrderPayment, Product, User, UserSession
from sessions import pwd_context, require_customer

router = APIRouter(prefix="/api/customer", tags=["Customer portal"])


class CustomerInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ProfileRequest(CustomerInput):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str = Field(default="", max_length=50)
    address: str = Field(default="", max_length=500)
    profile_image: str | None = Field(default=None, max_length=1_500_000)

    @field_validator("email")
    @classmethod
    def email_format(cls, value):
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address.")
        return value.lower()


class PasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class CartItemRequest(CustomerInput):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100000)
    specifications: str = Field(default="", max_length=2000)


class ArtworkRequest(CustomerInput):
    name: str = Field(min_length=1, max_length=255)
    data_url: str = Field(max_length=14_000_000)


class OrderRequest(CustomerInput):
    request_key: UUID
    items: list[CartItemRequest] = Field(min_length=1, max_length=30)
    files: list[ArtworkRequest] = Field(default_factory=list, max_length=3)
    design_request_note: str = Field(default="", max_length=4000)
    contact_phone: str = Field(min_length=3, max_length=50)
    expected_total: int = Field(ge=0, le=99_999_999_999_999)
    payment_reference: str = Field(default="", max_length=100)
    payment_method: Literal["cash", "whish_money"] = "whish_money"
    payment_timing: Literal["on_order", "after_pickup"] = "on_order"

    @model_validator(mode="after")
    def design_required(self):
        if not self.files and not self.design_request_note:
            raise ValueError("Attach a design file or describe the design you need.")
        ids = [item.product_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Combine quantities for the same product into one cart item.")
        if self.payment_method == "cash" and self.payment_reference:
            raise ValueError("A Whish transfer reference cannot be used for a cash order.")
        return self


class TransferRequest(CustomerInput):
    reference: str = Field(min_length=3, max_length=100)


def owned_order(order_id: int, customer: User, db: Session):
    order = db.query(Order).filter(Order.order_id == order_id, Order.customer_id == customer.user_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


@router.get("/profile")
def get_profile(customer: User = Depends(require_customer)):
    return profile_response(customer)


@router.get("/config")
def portal_config(customer: User = Depends(require_customer)):
    return {"whish_phone": os.getenv("WHISH_PHONE", "71293191"), "currency": "USD"}


@router.put("/profile")
def update_profile(payload: ProfileRequest, customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    set_profile_image(customer, payload.profile_image)
    if db.query(User).filter(User.email == payload.email, User.user_id != customer.user_id).first():
        raise HTTPException(status_code=409, detail="That email is already in use.")
    customer.full_name = payload.full_name
    customer.email = payload.email
    customer.phone = payload.phone or None
    customer.address = payload.address or None
    commit(db, "That email is already in use.")
    return profile_response(customer)


@router.put("/password")
def change_password(payload: PasswordRequest, customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    if not pwd_context.verify(payload.current_password, customer.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    if len(payload.new_password.encode()) > 72:
        raise HTTPException(status_code=422, detail="Use a password of at most 72 UTF-8 bytes.")
    customer.password_hash = pwd_context.hash(payload.new_password)
    db.query(UserSession).filter(UserSession.user_id == customer.user_id).delete()
    commit(db)
    return {"message": "Password updated. Please sign in with your new password."}


@router.get("/products")
def get_products(customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    prices = {price.product_id: int(price.special_price * 100) for price in db.query(CustomerSpecialPrice).filter(
        CustomerSpecialPrice.customer_id == customer.user_id
    ).all()}
    return [{
        "product_id": product.product_id, "name": product.name,
        "description": product.description, "image_url": product.image_url,
        "price": prices.get(product.product_id, product.price),
        "standard_price": product.price,
        "special_price": product.product_id in prices,
    } for product in db.query(Product).filter(Product.status == "active").order_by(Product.created_at.desc()).all()]


@router.get("/orders")
def get_orders(customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    return [order_response(order, db) for order in db.query(Order).filter(
        Order.customer_id == customer.user_id
    ).order_by(Order.order_id.desc()).all()]


@router.post("/orders", status_code=201)
def place_order(payload: OrderRequest, customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    # Lock the customer to serialize retries using the same request key.
    db.query(User).filter(User.user_id == customer.user_id).with_for_update().one()
    previous = db.query(Order).filter(Order.request_key == str(payload.request_key)).first()
    if previous:
        if previous.customer_id != customer.user_id:
            raise HTTPException(status_code=409, detail="Please restart checkout.")
        return order_response(previous, db)
    products = {product.product_id: product for product in db.query(Product).filter(
        Product.product_id.in_([item.product_id for item in payload.items]), Product.status == "active"
    ).with_for_update().all()}
    prices = {price.product_id: int(price.special_price * 100) for price in db.query(CustomerSpecialPrice).filter(
        CustomerSpecialPrice.customer_id == customer.user_id
    ).with_for_update().all()}
    lines = []
    total = 0
    for item in payload.items:
        product = products.get(item.product_id)
        if not product:
            raise HTTPException(status_code=409, detail="A product is no longer available. Refresh the catalog and update your basket.")
        price = prices.get(product.product_id, product.price)
        subtotal = price * item.quantity
        total += subtotal
        lines.append((item, product, price, subtotal))
    if total != payload.expected_total:
        raise HTTPException(status_code=409, detail="A product price changed. Refresh the catalog and review your updated total.")
    if total > 99_999_999_999_999:
        raise HTTPException(status_code=422, detail="Order total exceeds the supported limit.")
    decoded = [(file.name, *decode_artwork(file.data_url)) for file in payload.files]
    if sum(len(content) for _, _, content in decoded) > MAX_TOTAL_FILE_BYTES:
        raise HTTPException(status_code=422, detail="Design attachments must total no more than 20 MB.")
    reference = payload.payment_reference.strip().upper()
    if reference and len(reference) < 3:
        raise HTTPException(status_code=422, detail="Enter a valid Whish transfer reference.")
    order = Order(
        customer_id=customer.user_id, total_amount=Decimal(total) / 100,
        contact_phone=payload.contact_phone, customer_name=customer.full_name,
        customer_email=customer.email, design_request_note=payload.design_request_note or None,
        request_key=str(payload.request_key), production_stage="Awaiting review",
        payment_method=payload.payment_method, payment_timing=payload.payment_timing,
        payment_status="paid" if total == 0 else "pending_verification" if reference else "awaiting_payment",
    )
    db.add(order)
    try:
        db.flush()
        db.add(JobStatusHistory(order_id=order.order_id, changed_by=customer.user_id, stage="Awaiting review"))
        for item, product, price, subtotal in lines:
            db.add(OrderItem(
                order_id=order.order_id, product_id=product.product_id, product_name=product.name,
                quantity=item.quantity, unit_price=Decimal(price) / 100,
                subtotal=Decimal(subtotal) / 100, custom_description=item.specifications or None,
            ))
        for name, mime, content in decoded:
            db.add(DesignFile(
                order_id=order.order_id, file_path=f"orders/{order.order_id}/{uuid4().hex}",
                original_name=name, content_type=mime, size=len(content), content=content,
            ))
        if reference and total:
            db.add(OrderPayment(
                order_id=order.order_id, amount=Decimal(total) / 100,
                remaining=Decimal(total) / 100, reference=reference,
                status="pending_verification", method="whish_money",
            ))
        commit(db, "That transfer reference has already been submitted for another order.")
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unable to save this order. Refresh your orders before retrying.")
    return order_response(order, db)


@router.post("/orders/{order_id}/payment-reference")
def submit_reference(order_id: int, payload: TransferRequest, customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.order_id == order_id, Order.customer_id == customer.user_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.payment_status != "awaiting_payment":
        raise HTTPException(status_code=409, detail="This order already has a payment submission.")
    if order.payment_method != "whish_money":
        raise HTTPException(status_code=422, detail="This order uses cash payment at the press.")
    payment = db.query(OrderPayment).filter(OrderPayment.order_id == order_id).first()
    if payment and (payment.status != "unpaid" or payment.amount != 0):
        raise HTTPException(status_code=409, detail="This order already has a payment submission.")
    if payment is None:
        payment = OrderPayment(order_id=order_id)
        db.add(payment)
    payment.amount = order.total_amount
    payment.remaining = order.total_amount
    payment.reference = payload.reference.upper()
    payment.method = "whish_money"
    payment.status = "pending_verification"
    order.payment_status = "pending_verification"
    commit(db, "That transfer reference has already been submitted for another order.")
    return order_response(order, db)


@router.get("/orders/{order_id}/files/{file_id}")
def download_file(order_id: int, file_id: int, customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    owned_order(order_id, customer, db)
    file = db.query(DesignFile).filter(DesignFile.file_id == file_id, DesignFile.order_id == order_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Design file not found.")
    return Response(file.content, media_type=file.content_type, headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(file.original_name, safe='')}",
        "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    })
