from sqlalchemy.orm import Session, defer
from models import Order, OrderItem, OrderPayment, DesignFile


def order_response(order: Order, db: Session):
    items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).order_by(OrderItem.order_item_id).all()
    files = db.query(DesignFile).options(defer(DesignFile.content)).filter(DesignFile.order_id == order.order_id).all()
    payment = db.query(OrderPayment).filter(OrderPayment.order_id == order.order_id).first()
    return {
        "order_id": order.order_id,
        "order_type": order.order_type,
        "customer_address": order.customer_address,
        "amount_paid": int(payment.amount * 100) if payment and payment.status == "verified" else 0,
        "amount_due": max(0, int(order.total_amount * 100) - (int(payment.amount * 100) if payment and payment.status == "verified" else 0)),
        "created_at": order.created_at,
        "production_stage": order.production_stage,
        "payment_status": order.payment_status,
        "total": int(order.total_amount * 100),
        "contact_phone": order.contact_phone,
        "design_request_note": order.design_request_note,
        "payment_reference": payment.reference if payment else None,
        "payment_method": order.payment_method,
        "payment_timing": order.payment_timing,
        "items": [{
            "order_item_id": item.order_item_id, "product_id": item.product_id,
            "name": item.product_name, "quantity": item.quantity,
            "unit_price": int(item.unit_price * 100), "subtotal": int(item.subtotal * 100),
            "specifications": item.custom_description,
        } for item in items],
        "files": [{
            "file_id": file.file_id, "name": file.original_name,
            "size": file.size, "verification_status": file.verification_status,
        } for file in files],
    }
