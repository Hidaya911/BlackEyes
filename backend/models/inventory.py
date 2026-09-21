from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, CheckConstraint, Index
from sqlalchemy.sql import func
from database import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    __table_args__ = (
        CheckConstraint("quantity_on_hand >= 0", name="ck_inventory_quantity"),
        CheckConstraint("low_stock_threshold >= 0", name="ck_inventory_threshold"),
    )

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False)
    unit = Column(String(30), nullable=False)
    quantity_on_hand = Column(Numeric(14, 3), nullable=False, default=0)
    low_stock_threshold = Column(Numeric(14, 3), nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


Index(
    "uq_inventory_identity",
    func.lower(InventoryItem.name),
    InventoryItem.type,
    func.lower(InventoryItem.unit),
    unique=True,
)


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_stock_movement_quantity"),)

    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("inventory_items.item_id", ondelete="RESTRICT"), nullable=False, index=True)
    purchase_id = Column(Integer, ForeignKey("vendor_purchases.purchase_id", ondelete="RESTRICT"), unique=True, nullable=True)
    # Set for material usage recorded atomically with an order.
    order_id = Column(Integer, nullable=True)
    movement_type = Column(String(20), nullable=False)
    quantity = Column(Numeric(14, 3), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    transaction_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
