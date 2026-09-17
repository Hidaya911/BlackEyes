from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import deferred, column_property
from database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="customer", nullable=False)  # enforces: admin | staff | customer
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    profile_image = deferred(Column(String, nullable=True))
    has_profile_image = column_property(profile_image.expression.isnot(None))
    status = Column(String, default="active", nullable=False)  # enforces: active | inactive
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
