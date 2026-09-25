"""Keep per-sheet rates precise; final purchase totals remain rounded to cents."""
from sqlalchemy import inspect, text


def column_updates(dialect_name):
    return {'vendor_purchases': {'order_id': 'INTEGER REFERENCES vendor_orders(order_id)'},
            'vendor_payments': {'order_payment_key': 'VARCHAR(36)'}}


def apply_constraints(connection):
    inspector = inspect(connection)
    if not inspector.has_table('vendor_purchases'):
        return
    # Existing item records become lines of a shared vendor invoice, without changing money or stock.
    from models import VendorOrder, VendorPurchase
    orders, purchases = VendorOrder.__table__, VendorPurchase.__table__
    groups = {}
    for order in connection.execute(orders.select()).mappings():
        if order['invoice_reference']:
            groups[(order['vendor_id'], order['purchase_date'], order['invoice_reference'].strip().casefold())] = order['order_id']
    for purchase in connection.execute(purchases.select().where(purchases.c.order_id.is_(None)).order_by(purchases.c.purchase_id)).mappings():
        reference = (purchase['invoice_reference'] or '').strip()
        key = (purchase['vendor_id'], purchase['purchase_date'], reference.casefold() if reference else purchase['purchase_id'])
        if key not in groups:
            inserted = connection.execute(orders.insert().values(vendor_id=purchase['vendor_id'],
                purchase_date=purchase['purchase_date'], invoice_reference=reference or None, created_by=purchase['created_by']))
            groups[key] = inserted.inserted_primary_key[0]
        connection.execute(purchases.update().where(purchases.c.purchase_id == purchase['purchase_id']).values(order_id=groups[key]))
    if connection.dialect.name != 'postgresql':
        return
    column = next(column for column in inspector.get_columns('vendor_purchases') if column['name'] == 'unit_price')
    if getattr(column['type'], 'scale', None) != 6 or getattr(column['type'], 'precision', None) != 18:
        connection.execute(text('ALTER TABLE vendor_purchases ALTER COLUMN unit_price TYPE NUMERIC(18, 6)'))
