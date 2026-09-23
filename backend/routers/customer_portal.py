"""Customer API routes for profiles, catalog, orders, payments, and artwork."""

from decimal import Decimal
import re
import hashlib
from uuid import uuid4
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from utilities.files import decode_artwork, MAX_TOTAL_FILE_BYTES
from utilities.database import commit
from services.order_details import order_response
from services.inventory import consume_materials
from services.profiles import profile_response, set_profile_image
from database import get_db
from models import CustomerSpecialPrice, DesignFile, JobStatusHistory, Order, OrderItem, OrderPayment, Product, User, UserSession
from sessions import pwd_context, require_customer
from schemas.requests.customer_order import OrderRequest
from models import OrderItemDesign

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
    return {"currency": "USD", "payment_methods": ["cash"]}


@router.put("/profile")
def update_profile(payload: ProfileRequest, customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    if "profile_image" in payload.model_fields_set:
        set_profile_image(customer, payload.profile_image)
    if db.query(User).filter(User.email == payload.email, User.user_id != customer.user_id).first():
        raise HTTPException(status_code=409, detail="That email is already in use.")
    customer.full_name = payload.full_name
    customer.email = payload.email
    if "phone" in payload.model_fields_set:
        customer.phone = payload.phone or None
    if "address" in payload.model_fields_set:
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
        "price": product.wholesale_price if customer.role == "wholesaler" else prices.get(product.product_id, product.price),
        "standard_price": product.wholesale_price if customer.role == "wholesaler" else product.price,
        "is_customizable": product.is_customizable,
        "special_price": customer.role != "wholesaler" and product.product_id in prices,
        "price_kind": "wholesale" if customer.role == "wholesaler" else "retail",
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
    fingerprint = hashlib.sha256(payload.model_dump_json(exclude={"request_key"}).encode()).hexdigest()
    previous = db.query(Order).filter(Order.request_key == str(payload.request_key)).first()
    if previous:
        if previous.customer_id != customer.user_id:
            raise HTTPException(status_code=409, detail="Please restart checkout.")
        if previous.request_fingerprint and previous.request_fingerprint != fingerprint:
            raise HTTPException(409, "This order was already submitted with different details. Refresh your orders.")
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
        if not product.is_customizable and (item.designs or item.specifications):
            raise HTTPException(422, f"{product.name} does not support customization. Refresh your basket.")
        if product.is_customizable and not item.designs and not payload.files and not payload.design_request_note:
            raise HTTPException(422, f"Provide artwork or a design brief for {product.name}.")
        price = product.wholesale_price if customer.role == "wholesaler" else prices.get(product.product_id, product.price)
        if price is None:
            raise HTTPException(422, f"Contact the press for a wholesale price for {product.name}.")
        subtotal = price * item.quantity
        total += subtotal
        lines.append((item, product, price, subtotal))
    if total != payload.expected_total:
        raise HTTPException(status_code=409, detail="A product price changed. Refresh the catalog and review your updated total.")
    if total > 99_999_999_999_999:
        raise HTTPException(status_code=422, detail="Order total exceeds the supported limit.")
    if not any(product.is_customizable for product in products.values()) and (payload.files or payload.design_request_note):
        raise HTTPException(422, "These products do not support customization.")
    decoded = [(file.name, *decode_artwork(file.data_url)) for file in payload.files]
    design_files = {(item.product_id, index): (design.file.name, *decode_artwork(design.file.data_url))
        for item in payload.items for index, design in enumerate(item.designs) if design.file}
    if sum(len(content) for _, _, content in [*decoded, *design_files.values()]) > MAX_TOTAL_FILE_BYTES:
        raise HTTPException(status_code=422, detail="Design attachments must total no more than 20 MB.")
    order = Order(
        customer_id=customer.user_id, total_amount=Decimal(total) / 100,
        contact_phone=payload.contact_phone, customer_name=customer.full_name,
        customer_email=customer.email, customer_address=customer.address or None,
        design_request_note=payload.design_request_note or None,
        request_key=str(payload.request_key), production_stage="Awaiting review",
        request_fingerprint=fingerprint,
        payment_method=payload.payment_method, payment_timing=payload.payment_timing,
        payment_status="paid" if total == 0 else "awaiting_payment",
    )
    db.add(order)
    try:
        db.flush()
        consume_materials(db, order.order_id, payload.items, customer.user_id)
        db.add(JobStatusHistory(order_id=order.order_id, changed_by=customer.user_id, stage="Awaiting review"))
        for item, product, price, subtotal in lines:
            order_item = OrderItem(
                order_id=order.order_id, product_id=product.product_id, product_name=product.name,
                quantity=item.quantity, unit_price=Decimal(price) / 100,
                subtotal=Decimal(subtotal) / 100, custom_description=item.specifications or None,
            )
            db.add(order_item)
            db.flush()
            for index, design in enumerate(item.designs):
                assignment = OrderItemDesign(order_item_id=order_item.order_item_id, quantity=design.quantity, brief=design.brief)
                db.add(assignment)
                db.flush()
                if (item.product_id, index) in design_files:
                    name, mime, content = design_files[(item.product_id, index)]
                    db.add(DesignFile(order_id=order.order_id, design_id=assignment.design_id,
                        file_path=f"orders/{order.order_id}/{uuid4().hex}", original_name=name,
                        content_type=mime, size=len(content), content=content))
        for name, mime, content in decoded:
            db.add(DesignFile(
                order_id=order.order_id, file_path=f"orders/{order.order_id}/{uuid4().hex}",
                original_name=name, content_type=mime, size=len(content), content=content,
            ))
        commit(db)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unable to save this order. Refresh your orders before retrying.")
    return order_response(order, db)


@router.post("/orders/{order_id}/payment-reference")
def submit_reference(order_id: int, payload: TransferRequest, customer: User = Depends(require_customer), db: Session = Depends(get_db)):
    owned_order(order_id, customer, db)
    raise HTTPException(409, "Online transfers are currently unavailable. Please pay locally at the press.")


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
