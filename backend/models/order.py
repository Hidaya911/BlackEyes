from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, CheckConstraint, Boolean
from sqlalchemy.sql import func
from database import Base


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="ck_order_total"),
        CheckConstraint(
            "(customer_id IS NOT NULL AND walk_in_customer_id IS NULL) OR "
            "(customer_id IS NULL AND walk_in_customer_id IS NOT NULL)",
            name="ck_order_customer_identity",
        ),
    )

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True, index=True)
    walk_in_customer_id = Column(Integer, ForeignKey("walk_in_customers.customer_id", ondelete="RESTRICT"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True)
    customer_address = Column(String(500), nullable=True)
    request_fingerprint = Column(String(64), nullable=True)
    staff_id = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True)
    order_type = Column(String(20), default="online", nullable=False)
    design_request_note = Column(String(4000), nullable=True)
    production_stage = Column(String(40), default="Awaiting review", nullable=False)
    is_rush = Column(Boolean, default=False, nullable=False)
    rush_fee = Column(Numeric(14, 2), default=0, nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)
    payment_status = Column(String(30), default="awaiting_payment", nullable=False)
    payment_method = Column(String(30), default="whish_money", nullable=False)
    payment_timing = Column(String(20), default="on_order", nullable=False)
    contact_phone = Column(String(50), nullable=False)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    request_key = Column(String(36), unique=True, nullable=False)


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_item_quantity"),
        CheckConstraint("unit_price >= 0 AND subtotal >= 0", name="ck_order_item_price"),
    )

    order_item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="RESTRICT"), nullable=True)
    product_name = Column(String(255), nullable=False)
    custom_description = Column(String(2000), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    subtotal = Column(Numeric(14, 2), nullable=False)
