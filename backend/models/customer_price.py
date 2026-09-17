from sqlalchemy import Column, Integer, DateTime, Numeric, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class CustomerSpecialPrice(Base):
    __tablename__ = "customer_special_prices"
    __table_args__ = (
        UniqueConstraint("customer_id", "product_id", name="uq_customer_product_price"),
        CheckConstraint("special_price >= 0", name="ck_special_price"),
    )

    special_price_id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False)
    special_price = Column(Numeric(14, 2), nullable=False)
    set_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
