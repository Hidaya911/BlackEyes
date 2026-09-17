"""Settings API endpoints and request/response definitions."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from access import require_admin
from database import get_db
from models import User
from sessions import pwd_context
from services.profiles import profile_response, set_profile_image
from .user import AuthResponse

router = APIRouter()


class SettingsRequest(BaseModel):
    admin_id: int
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    profile_image: str | None = Field(default=None, max_length=2000000)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


@router.put('/api/admin/settings', response_model=AuthResponse)
def update_admin_settings(payload: SettingsRequest, db: Session=Depends(get_db)):
    admin = require_admin(payload.admin_id, db)
    email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == email, User.user_id != admin.user_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='That email is already in use.')
    if payload.new_password:
        if not payload.current_password or not pwd_context.verify(payload.current_password, admin.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Your current password is incorrect.')
        admin.password_hash = pwd_context.hash(payload.new_password)
    admin.full_name = payload.full_name.strip()
    admin.email = email
    admin.phone = payload.phone
    admin.address = payload.address
    set_profile_image(admin, payload.profile_image)
    db.commit()
    db.refresh(admin)
    return profile_response(admin)
