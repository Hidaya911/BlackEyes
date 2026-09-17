from sqlalchemy import Column, Integer, String, DateTime, Date, Numeric, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from database import Base


class VendorPurchase(Base):
    __tablename__ = "vendor_purchases"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_purchase_quantity"),
        CheckConstraint("unit_price >= 0 AND cost >= 0", name="ck_purchase_cost"),
    )

    purchase_id = Column(Integer, primary_key=True, autoincrement=True)
    vendor_id = Column(Integer, ForeignKey("vendors.vendor_id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.item_id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Numeric(14, 3), nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    cost = Column(Numeric(14, 2), nullable=False)  # Total quantity × unit price, rounded to cents.
    invoice_reference = Column(String(100), nullable=True)
    purchase_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    request_key = Column(String(36), unique=True, nullable=False)
