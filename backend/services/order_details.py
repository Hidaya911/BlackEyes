from sqlalchemy.orm import Session, defer
from models import Order, OrderItem, OrderPayment, DesignFile, OrderItemDesign, User, WalkInCustomer


def order_response(order: Order, db: Session):
    # Older orders did not always snapshot contact details. Fill only missing
    # display values from the linked customer, without rewriting order history.
    person = None
    if not order.customer_address or not order.contact_phone:
        person = db.get(User, order.customer_id) if order.customer_id is not None else db.get(WalkInCustomer, order.walk_in_customer_id) if order.walk_in_customer_id is not None else None
    items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).order_by(OrderItem.order_item_id).all()
    files = db.query(DesignFile).options(defer(DesignFile.content)).filter(DesignFile.order_id == order.order_id).all()
    payment = db.query(OrderPayment).filter(OrderPayment.order_id == order.order_id).first()
    designs = db.query(OrderItemDesign).filter(OrderItemDesign.order_item_id.in_([item.order_item_id for item in items])).order_by(OrderItemDesign.design_id).all()
    return {
        "order_id": order.order_id,
        "order_type": order.order_type,
        "customer_address": order.customer_address or (person.address if person else None),
        "amount_paid": int(payment.amount * 100) if payment and payment.status == "verified" else 0,
        "amount_due": max(0, int(order.total_amount * 100) - (int(payment.amount * 100) if payment and payment.status == "verified" else 0)),
        "created_at": order.created_at,
        "production_stage": order.production_stage,
        "payment_status": order.payment_status,
        "total": int(order.total_amount * 100),
        "contact_phone": order.contact_phone or (person.phone if person else None),
        "design_request_note": order.design_request_note,
        "payment_reference": payment.reference if payment else None,
        "payment_method": order.payment_method,
        "payment_timing": order.payment_timing,
        "items": [{
            "order_item_id": item.order_item_id, "product_id": item.product_id,
            "name": item.product_name, "quantity": item.quantity,
            "unit_price": int(item.unit_price * 100), "subtotal": int(item.subtotal * 100),
            "specifications": item.custom_description,
            "designs": [{"design_id": design.design_id, "quantity": design.quantity, "brief": design.brief}
                for design in designs if design.order_item_id == item.order_item_id],
        } for item in items],
        "files": [{
            "file_id": file.file_id, "name": file.original_name,
            "size": file.size, "verification_status": file.verification_status,
            "design_id": file.design_id,
        } for file in files],
    }
