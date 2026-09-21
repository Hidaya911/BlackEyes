"""Read-only operational reporting; money values are USD, not cents."""
from collections import defaultdict
from decimal import Decimal
from models import Order, OrderItem, OrderPayment, VendorPurchase, VendorPayment, InventoryItem, InventoryTransaction


def report(db, start=None, end=None):
    query = db.query(Order)
    if start:
        query = query.filter(Order.created_at >= start)
    if end:
        query = query.filter(Order.created_at < end)
    orders = query.order_by(Order.created_at.desc()).all()
    ids = [o.order_id for o in orders]
    paid = defaultdict(Decimal)
    for payment in db.query(OrderPayment).filter(OrderPayment.order_id.in_(ids), OrderPayment.status == "verified").all():
        paid[payment.order_id] += payment.amount
    stages = defaultdict(int)
    customers = {}
    daily = defaultdict(Decimal)
    for order in orders:
        stages[order.production_stage] += 1
        daily[str(order.created_at.date())] += order.total_amount
        key = ("account", order.customer_id) if order.customer_id else ("walk_in", order.walk_in_customer_id)
        row = customers.setdefault(key, dict(name=order.customer_name, kind=key[0], id=key[1], orders=0, sales=Decimal(0), due=Decimal(0)))
        row["orders"] += 1
        row["sales"] += order.total_amount
        row["due"] += max(Decimal(0), order.total_amount - paid[order.order_id])
    products = {}
    for line in db.query(OrderItem).filter(OrderItem.order_id.in_(ids)).all():
        key = (line.product_id, line.product_name)
        row = products.setdefault(key, dict(name=line.product_name, quantity=0, sales=Decimal(0)))
        row["quantity"] += line.quantity
        row["sales"] += line.subtotal
    usage_query = db.query(InventoryTransaction, InventoryItem).join(InventoryItem).filter(InventoryTransaction.movement_type == "use")
    if start:
        usage_query = usage_query.filter(InventoryTransaction.transaction_date >= start)
    if end:
        usage_query = usage_query.filter(InventoryTransaction.transaction_date < end)
    usage = {}
    for movement, item in usage_query.all():
        row = usage.setdefault(item.item_id, dict(name=item.name, unit=item.unit, quantity=Decimal(0)))
        row["quantity"] += movement.quantity
    purchases = sum((p.cost for p in db.query(VendorPurchase).all()), Decimal(0))
    vendor_paid = sum((p.amount for p in db.query(VendorPayment).all()), Decimal(0))
    return dict(order_count=len(orders), sales=sum((o.total_amount for o in orders), Decimal(0)),
        collected=sum(paid.values(), Decimal(0)), outstanding=sum((r["due"] for r in customers.values()), Decimal(0)),
        vendor_due=purchases-vendor_paid, stages=dict(stages),
        products=sorted(products.values(), key=lambda r: r["sales"], reverse=True),
        customers=sorted(customers.values(), key=lambda r: r["sales"], reverse=True),
        daily=[dict(date=d, sales=s) for d, s in sorted(daily.items())],
        usage=sorted(usage.values(), key=lambda r: r["name"]),
        recent=[dict(id=o.order_id, customer=o.customer_name, stage=o.production_stage, total=o.total_amount) for o in orders[:10]],
        low_stock=[dict(id=i.item_id, name=i.name, quantity=i.quantity_on_hand, unit=i.unit, threshold=i.low_stock_threshold)
            for i in db.query(InventoryItem).filter(InventoryItem.quantity_on_hand <= InventoryItem.low_stock_threshold).order_by(InventoryItem.name).all()])
