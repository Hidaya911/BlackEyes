"""Append-only verified receipts; payments remains the per-order balance summary."""
from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from database import Base


class CustomerPayment(Base):
    __tablename__ = "customer_payment_transactions"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_customer_receipt_positive"),)
    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="RESTRICT"), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    method = Column(String(30), nullable=False)
    reference = Column(String(100), nullable=True)
    note = Column(String(1000), nullable=True)
    source = Column(String(20), nullable=False, default="settlement")
    recorded_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    request_key = Column(String(100), nullable=False, unique=True)
    request_fingerprint = Column(String(64), nullable=True)
