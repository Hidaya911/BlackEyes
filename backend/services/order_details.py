from collections import defaultdict
from sqlalchemy.orm import Session, defer, load_only
from models import Order, OrderItem, OrderPayment, DesignFile, OrderItemDesign, User, WalkInCustomer


def order_responses(orders, db: Session):
    """Load a customer's history with a fixed number of queries."""
    if not orders:
        return []
    ids = [order.order_id for order in orders]
    items_by_order, files_by_order, designs_by_order = defaultdict(list), defaultdict(list), defaultdict(list)
    items = db.query(OrderItem).filter(OrderItem.order_id.in_(ids)).order_by(OrderItem.order_item_id).all()
    item_orders = {item.order_item_id: item.order_id for item in items}
    for item in items:
        items_by_order[item.order_id].append(item)
    for file in db.query(DesignFile).options(defer(DesignFile.content)).filter(DesignFile.order_id.in_(ids)).all():
        files_by_order[file.order_id].append(file)
    payments = {}
    for payment in db.query(OrderPayment).filter(OrderPayment.order_id.in_(ids)).order_by(OrderPayment.payment_id).all():
        payments.setdefault(payment.order_id, payment)
    for design in db.query(OrderItemDesign).filter(OrderItemDesign.order_item_id.in_(item_orders)).order_by(OrderItemDesign.design_id).all():
        designs_by_order[item_orders[design.order_item_id]].append(design)
    customer_ids = {o.customer_id for o in orders if o.customer_id and (not o.customer_address or not o.contact_phone)}
    people = {p.user_id: p for p in db.query(User).options(load_only(User.user_id, User.address, User.phone)).filter(User.user_id.in_(customer_ids)).all()} if customer_ids else {}
    walk_in_ids = {o.walk_in_customer_id for o in orders if not o.customer_id and o.walk_in_customer_id and (not o.customer_address or not o.contact_phone)}
    walk_ins = {p.customer_id: p for p in db.query(WalkInCustomer).filter(WalkInCustomer.customer_id.in_(walk_in_ids)).all()} if walk_in_ids else {}
    return [order_response(o, db, (items_by_order[o.order_id], files_by_order[o.order_id], payments.get(o.order_id), designs_by_order[o.order_id], people.get(o.customer_id) if o.customer_id else walk_ins.get(o.walk_in_customer_id))) for o in orders]


def order_response(order: Order, db: Session, loaded=None):
    # Older orders did not always snapshot contact details. Fill only missing
    # display values from the linked customer, without rewriting order history.
    person = None
    if loaded is None and (not order.customer_address or not order.contact_phone):
        person = db.get(User, order.customer_id) if order.customer_id is not None else db.get(WalkInCustomer, order.walk_in_customer_id) if order.walk_in_customer_id is not None else None
    if loaded is None:
        items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).order_by(OrderItem.order_item_id).all()
        files = db.query(DesignFile).options(defer(DesignFile.content)).filter(DesignFile.order_id == order.order_id).all()
        payment = db.query(OrderPayment).filter(OrderPayment.order_id == order.order_id).first()
        designs = db.query(OrderItemDesign).filter(OrderItemDesign.order_item_id.in_([item.order_item_id for item in items])).order_by(OrderItemDesign.design_id).all()
    else:
        items, files, payment, designs, person = loaded
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
