from sqlalchemy import Column, Integer, String, DateTime, Date, Numeric, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from database import Base


class VendorPayment(Base):
    __tablename__ = "vendor_payments"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_vendor_payment_amount"),)

    vendor_payment_id = Column(Integer, primary_key=True, autoincrement=True)
    order_payment_key = Column(String(36), nullable=True, index=True)
    purchase_id = Column(Integer, ForeignKey("vendor_purchases.purchase_id", ondelete="RESTRICT"), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    method = Column(String(20), nullable=False)
    payment_date = Column(Date, nullable=False)
    reference = Column(String(100), nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    request_key = Column(String(36), unique=True, nullable=False)


class OrderPayment(Base):
    __tablename__ = "payments"
    __table_args__ = (CheckConstraint("amount >= 0 AND remaining >= 0", name="ck_order_payment_amount"),)

    payment_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="RESTRICT"), nullable=False, unique=True)
    amount = Column(Numeric(14, 2), nullable=False)
    remaining = Column(Numeric(14, 2), nullable=False)
    method = Column(String(30), nullable=False, default="whish_money")
    reference = Column(String(100), nullable=True, unique=True)
    status = Column(String(30), nullable=False, default="pending_verification")
    payment_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    confirmed_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
