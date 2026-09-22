"""Customer balances and chronological statements. API amounts are integer cents."""
from datetime import datetime, timezone
from fastapi import HTTPException
from models import Order, OrderPayment, CustomerPayment, User, WalkInCustomer
from services.customer_payments import received


def cents(value):
    return int(value * 100)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def customer_record(db, kind, customer_id):
    person = db.query(User).filter(User.user_id == customer_id, User.role == "customer").first() if kind == "account" else db.get(WalkInCustomer, customer_id)
    if not person:
        raise HTTPException(404, "Customer not found.")
    return dict(id=customer_id, kind=kind, name=person.full_name, email=person.email or "", phone=person.phone or "", address=person.address or "")


def order_rows(db, kind=None, customer_id=None):
    query = db.query(Order, OrderPayment).outerjoin(OrderPayment, OrderPayment.order_id == Order.order_id)
    if kind:
        column = Order.customer_id if kind == "account" else Order.walk_in_customer_id
        query = query.filter(column == customer_id)
    return query.order_by(Order.created_at, Order.order_id).all()


def balances(db):
    customers = {}
    # Keep identity based on IDs: a portal and walk-in contact can share a name.
    names = {("account", p.user_id): (p.full_name, p.phone, p.email) for p in db.query(User).filter(User.role == "customer").all()}
    names.update({("walk_in", p.customer_id): (p.full_name, p.phone, p.email) for p in db.query(WalkInCustomer).all()})
    for order, payment in order_rows(db):
        key = ("account", order.customer_id) if order.customer_id is not None else ("walk_in", order.walk_in_customer_id)
        name, phone, email = names.get(key, (order.customer_name, order.contact_phone, order.customer_email))
        row = customers.setdefault(key, dict(id=key[1], kind=key[0], name=name, phone=phone or "", email=email or "", total=0, paid=0, due=0, order_count=0, unpaid_orders=0))
        total, paid = cents(order.total_amount), cents(received(payment))
        due = max(0, total - paid)
        row["total"] += total
        row["paid"] += paid
        row["due"] += due
        row["order_count"] += 1
        row["unpaid_orders"] += int(due > 0)
    rows = sorted(customers.values(), key=lambda r: (-r["due"], r["name"].lower(), r["kind"], r["id"]))
    return dict(customers=rows, total=sum(r["total"] for r in rows), paid=sum(r["paid"] for r in rows),
        due=sum(r["due"] for r in rows), owing_customers=sum(r["due"] > 0 for r in rows))


def statement(db, kind, customer_id):
    customer = customer_record(db, kind, customer_id)
    rows = order_rows(db, kind, customer_id)
    ids = [order.order_id for order, _ in rows]
    history = db.query(CustomerPayment, User.full_name).outerjoin(User, User.user_id == CustomerPayment.recorded_by).filter(CustomerPayment.order_id.in_(ids)).all()
    by_order = {}
    for payment, operator_name in history:
        by_order.setdefault(payment.order_id, []).append((payment, operator_name))
    events, orders = [], []
    for order, payment in rows:
        total, paid = cents(order.total_amount), cents(received(payment))
        orders.append(dict(order_id=order.order_id, created_at=utc(order.created_at), total=total, paid=paid,
            due=max(0, total-paid), stage=order.production_stage, payment_status=order.payment_status))
        events.append(dict(key=f"order-{order.order_id}", order_id=order.order_id, date=utc(order.created_at), type="charge",
            description=f"Order #{order.order_id}", charge=total, payment=0, method=None, reference=None, recorded_by=None, note=None))
        for receipt, operator_name in by_order.get(order.order_id, []):
            events.append(dict(key=f"payment-{receipt.transaction_id}", order_id=order.order_id,
                date=max(utc(receipt.recorded_at), utc(order.created_at)), type="payment",
                description="Previous verified payment" if receipt.source == "legacy" else "Payment at order entry" if receipt.source == "initial" else "Payment received",
                charge=0, payment=cents(receipt.amount), method=receipt.method, reference=receipt.reference,
                recorded_by=operator_name, note=receipt.note))
        if not by_order.get(order.order_id) and paid > 0:
            # Read-only compatibility for old records; materialized on their next settlement.
            events.append(dict(key=f"legacy-{payment.payment_id}", order_id=order.order_id,
                date=max(utc(payment.confirmed_at or payment.payment_date or order.created_at), utc(order.created_at)),
                type="payment", description="Previous verified payment", charge=0, payment=paid,
                method=payment.method, reference=payment.reference, recorded_by=None,
                note="Earlier verified total; individual installments were not recorded."))
    events.sort(key=lambda event: (event["date"], event["type"] != "charge", event["order_id"], event["key"]))
    balance = 0
    for event in events:
        balance += event["charge"] - event["payment"]
        event["balance"] = balance
    return dict(customer=customer, orders=list(reversed(orders)), entries=events,
        total=sum(o["total"] for o in orders), paid=sum(o["paid"] for o in orders), due=sum(o["due"] for o in orders),
        generated_at=datetime.now(timezone.utc))
