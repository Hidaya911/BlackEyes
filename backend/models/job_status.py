from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class JobStatusHistory(Base):
    __tablename__ = "job_status_history"

    history_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by = Column(Integer, ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    stage = Column(String(40), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
