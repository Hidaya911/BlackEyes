from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, LargeBinary
from sqlalchemy.sql import func
from database import Base


class DesignFile(Base):
    __tablename__ = "design_files"

    file_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False, index=True)
    design_id = Column(Integer, ForeignKey("order_item_designs.design_id", ondelete="CASCADE"), nullable=True)
    file_path = Column(String(100), unique=True, nullable=False)
    original_name = Column(String(255), nullable=False)
    content_type = Column(String(50), nullable=False)
    size = Column(Integer, nullable=False)
    content = Column(LargeBinary, nullable=False)
    verification_status = Column(String(20), default="pending", nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
