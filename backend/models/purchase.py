from sqlalchemy import Column, Integer, String, DateTime, Date, Numeric, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from database import Base


class VendorOrder(Base):
    __tablename__ = 'vendor_orders'
    order_id = Column(Integer, primary_key=True, autoincrement=True)
    vendor_id = Column(Integer, ForeignKey('vendors.vendor_id', ondelete='RESTRICT'), nullable=False, index=True)
    purchase_date = Column(Date, nullable=False)
    invoice_reference = Column(String(100), nullable=True)
    created_by = Column(Integer, ForeignKey('users.user_id', ondelete='RESTRICT'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class VendorPurchase(Base):
    __tablename__ = "vendor_purchases"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_purchase_quantity"),
        CheckConstraint("unit_price >= 0 AND cost >= 0", name="ck_purchase_cost"),
    )

    purchase_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('vendor_orders.order_id', ondelete='RESTRICT'), nullable=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.vendor_id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.item_id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Numeric(14, 3), nullable=False)
    unit_price = Column(Numeric(18, 6), nullable=False)
    cost = Column(Numeric(14, 2), nullable=False)  # Total quantity × unit price, rounded to cents.
    invoice_reference = Column(String(100), nullable=True)
    purchase_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    request_key = Column(String(36), unique=True, nullable=False)
