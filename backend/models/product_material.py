"""Explicit material usage per unit of a catalog product."""
from sqlalchemy import Column, Integer, Numeric, ForeignKey, CheckConstraint
from database import Base


class ProductMaterial(Base):
    __tablename__ = "product_materials"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_product_material_quantity"),)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="CASCADE"), primary_key=True)
    item_id = Column(Integer, ForeignKey("inventory_items.item_id", ondelete="RESTRICT"), primary_key=True)
    quantity = Column(Numeric(14, 3), nullable=False)
