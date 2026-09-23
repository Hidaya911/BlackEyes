"""Atomic creation of counter orders, customer records, and payment balances."""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import (
    CustomerSpecialPrice,
    DesignFile,
    JobStatusHistory,
    Order,
    OrderItem,
    OrderPayment,
    CustomerPayment,
    Product,
    User,
    WalkInCustomer,
)
from schemas.requests.press import LocalOrderRequest
from services.order_details import order_response
from services.inventory import consume_materials
from services.counter_pricing import counter_price
from utilities.files import decode_artwork, MAX_TOTAL_FILE_BYTES


def press_order_response(order, db):
    return {
        **order_response(order, db),
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
    }


def customer_options(db: Session, query: str):
    results = []
    sources = ((User, "account", "user_id"), (WalkInCustomer, "walk_in", "customer_id"))
    for model, kind, id_name in sources:
        records = db.query(model)
        if model is User:
            records = records.filter(User.role.in_(["customer", "wholesaler"]), User.status == "active")
        if query:
            records = records.filter(or_(
                model.full_name.icontains(query, autoescape=True),
                model.phone.icontains(query, autoescape=True),
                model.email.icontains(query, autoescape=True),
                *( [User.business_name.icontains(query, autoescape=True)] if model is User else [] ),
            ))
        for person in records.order_by(model.full_name).limit(20).all():
            results.append({
                "id": getattr(person, id_name), "kind": kind,
                "role": person.role if kind == "account" else "customer",
                "business_name": person.business_name if kind == "account" else None,
                "full_name": person.full_name, "phone": person.phone or "",
                "email": person.email or "", "address": person.address or "",
            })
    return results


def catalog(db: Session, customer_id: int | None):
    prices = {}
    customer = None
    if customer_id:
        customer = db.query(User).filter(
            User.user_id == customer_id, User.role.in_(["customer", "wholesaler"]), User.status == "active"
        ).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer account not found.")
        prices = {
            row.product_id: int(row.special_price * 100)
            for row in db.query(CustomerSpecialPrice).filter(
                CustomerSpecialPrice.customer_id == customer_id
            ).all()
        }
    return [{
        "product_id": product.product_id, "name": product.name,
        "price": counter_price(product, customer, prices)[0],
        "price_kind": counter_price(product, customer, prices)[1],
        "special_price": counter_price(product, customer, prices)[1] == "special",
        "description": product.description, "image_url": product.image_url,
        "is_customizable": product.is_customizable,
    } for product in db.query(Product).filter(
        Product.status == "active"
    ).order_by(Product.name).all()]


def create_local_order(payload: LocalOrderRequest, operator: User, db: Session):
    # Serialize one operator's retries. A unique request key also guards concurrent users.
    db.query(User).filter(User.user_id == operator.user_id).with_for_update().one()
    fingerprint = hashlib.sha256(payload.model_dump_json(exclude={"request_key"}).encode()).hexdigest()
    previous = db.query(Order).filter(Order.request_key == str(payload.request_key)).first()
    if previous:
        if previous.created_by != operator.user_id or previous.request_fingerprint != fingerprint:
            raise HTTPException(status_code=409, detail="This submission was already used. Start a new order.")
        return press_order_response(previous, db)

    if payload.customer_id:
        customer = db.query(User).filter(
            User.user_id == payload.customer_id,
            User.role.in_(["customer", "wholesaler"]), User.status == "active",
        ).with_for_update().first()
    elif payload.walk_in_customer_id:
        customer = db.get(WalkInCustomer, payload.walk_in_customer_id)
    else:
        customer = WalkInCustomer(**payload.customer.model_dump(), created_by=operator.user_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found.")
    phone = payload.contact_phone or customer.phone or ""
    if len(phone) < 3:
        raise HTTPException(status_code=422, detail="Enter a contact phone for this order.")

    ids = sorted({line.product_id for line in payload.items if line.product_id})
    products = {
        product.product_id: product for product in db.query(Product).filter(
            Product.product_id.in_(ids), Product.status == "active"
        ).order_by(Product.product_id).with_for_update().all()
    }
    prices = {
        price.product_id: int(price.special_price * 100)
        for price in db.query(CustomerSpecialPrice).filter(
            CustomerSpecialPrice.customer_id == payload.customer_id
        ).with_for_update().all()
    } if payload.customer_id else {}
    lines = []
    for item in payload.items:
        product = products.get(item.product_id)
        if item.product_id and not product:
            raise HTTPException(status_code=409, detail="A product is no longer available. Refresh the catalog.")
        if product and not product.is_customizable and item.specifications:
            raise HTTPException(422, f"{product.name} does not support customization. Refresh the catalog.")
        price = item.unit_price if item.unit_price is not None else counter_price(product, customer, prices)[0]
        if price is None:
            raise HTTPException(422, f"Wholesale price is not set for {product.name}. Enter an agreed unit price or ask an admin to set its wholesale price.")
        lines.append((item, product.name if product else item.name, price, price * item.quantity))
    customizable = any(not item.product_id or products[item.product_id].is_customizable for item in payload.items)
    if customizable and not payload.files and not payload.design_request_note:
        raise HTTPException(422, "Provide artwork or a job brief for the customizable items.")
    if not customizable and (payload.files or payload.design_request_note):
        raise HTTPException(422, "These products do not support customization.")
    total = sum(line[3] for line in lines)
    if total > 99_999_999_999_999:
        raise HTTPException(status_code=422, detail="Order total exceeds the supported limit.")
    if total != payload.expected_total:
        raise HTTPException(status_code=409, detail="A price changed. Refresh the catalog and review the total.")
    decoded = [(file.name, *decode_artwork(file.data_url)) for file in payload.files]
    if sum(len(content) for _, _, content in decoded) > MAX_TOTAL_FILE_BYTES:
        raise HTTPException(status_code=422, detail="Design attachments must total no more than 20 MB.")

    try:
        if payload.customer is not None:
            db.add(customer)
            db.flush()
        order = Order(
            customer_id=payload.customer_id,
            walk_in_customer_id=customer.customer_id if isinstance(customer, WalkInCustomer) else None,
            created_by=operator.user_id, staff_id=operator.user_id, order_type="walk_in",
            customer_name=customer.full_name, customer_email=customer.email or "",
            customer_address=customer.address or None, contact_phone=phone,
            design_request_note=payload.design_request_note or None,
            total_amount=Decimal(total) / 100, request_key=str(payload.request_key),
            request_fingerprint=fingerprint, production_stage="Awaiting review",
            payment_method=payload.payment_method,
            payment_timing="on_order" if payload.amount_paid == total else "after_pickup",
            payment_status="paid" if payload.amount_paid == total else "partially_paid" if payload.amount_paid else "awaiting_payment",
        )
        db.add(order)
        db.flush()
        for item, name, price, subtotal in lines:
            db.add(OrderItem(
                order_id=order.order_id, product_id=item.product_id,
                product_name=name, quantity=item.quantity,
                unit_price=Decimal(price) / 100, subtotal=Decimal(subtotal) / 100,
                custom_description=item.specifications or None,
            ))
        consume_materials(db, order.order_id, payload.items, operator.user_id)
        for name, mime, content in decoded:
            db.add(DesignFile(
                order_id=order.order_id,
                file_path=f"orders/{order.order_id}/{uuid4().hex}",
                original_name=name, content_type=mime,
                size=len(content), content=content,
            ))
        db.add(OrderPayment(
            order_id=order.order_id, amount=Decimal(payload.amount_paid) / 100,
            remaining=Decimal(total - payload.amount_paid) / 100,
            method=payload.payment_method, reference=payload.payment_reference.upper() or None,
            status="verified" if payload.amount_paid or total == 0 else "unpaid",
            confirmed_by=operator.user_id if payload.amount_paid or total == 0 else None,
            confirmed_at=datetime.now(timezone.utc) if payload.amount_paid or total == 0 else None,
        ))
        if payload.amount_paid:
            db.add(CustomerPayment(order_id=order.order_id, amount=Decimal(payload.amount_paid) / 100,
                method=payload.payment_method, reference=payload.payment_reference.upper() or None,
                recorded_by=operator.user_id, recorded_at=datetime.now(timezone.utc),
                source="initial", request_key=f"initial-order-{order.order_id}"))
        db.add(JobStatusHistory(
            order_id=order.order_id, changed_by=operator.user_id, stage="Awaiting review"
        ))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="The order could not be saved. Check for an existing order or a duplicate payment reference before retrying.")
    return press_order_response(order, db)
