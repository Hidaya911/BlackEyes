"""A design or brief assigned to a specific quantity of an order item."""
from sqlalchemy import Column, Integer, String, ForeignKey, CheckConstraint
from database import Base


class OrderItemDesign(Base):
    __tablename__ = "order_item_designs"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_order_design_quantity"),)
    design_id = Column(Integer, primary_key=True, autoincrement=True)
    order_item_id = Column(Integer, ForeignKey("order_items.order_item_id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    brief = Column(String(4000), nullable=False, default="")
