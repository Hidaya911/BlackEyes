from sqlalchemy import Boolean, Column, Integer, String, DateTime, true
from sqlalchemy.sql import func
from database import Base


class Product(Base):
    __tablename__ = "products"
    product_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Integer, nullable=False)  # stored in cents
    wholesale_price = Column(Integer, nullable=True)  # cents; unset on legacy products
    image_url = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)
    is_customizable = Column(Boolean, default=True, server_default=true(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
