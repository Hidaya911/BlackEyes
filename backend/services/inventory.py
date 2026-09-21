"""Deduct linked materials atomically with order creation."""
from collections import defaultdict
from decimal import Decimal
from fastapi import HTTPException
from models import InventoryItem, InventoryTransaction, ProductMaterial


def consume_materials(db, order_id, lines, actor_id):
    needed = defaultdict(Decimal)
    quantities = defaultdict(int)
    for line in lines:
        if line.product_id:
            quantities[line.product_id] += line.quantity
    for link in db.query(ProductMaterial).filter(ProductMaterial.product_id.in_(quantities)).all():
        needed[link.item_id] += link.quantity * quantities[link.product_id]
    items = db.query(InventoryItem).filter(InventoryItem.item_id.in_(needed)).order_by(InventoryItem.item_id).with_for_update().all()
    for item in items:
        if item.quantity_on_hand < needed[item.item_id]:
            raise HTTPException(409, f"Insufficient stock for {item.name}: {item.quantity_on_hand} {item.unit} available.")
    for item in items:
        item.quantity_on_hand -= needed[item.item_id]
        db.add(InventoryTransaction(item_id=item.item_id, order_id=order_id,
            movement_type="use", quantity=needed[item.item_id], changed_by=actor_id))
