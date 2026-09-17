"""Staff API endpoints and request/response definitions."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from access import require_admin
from database import get_db
from models import User
from sessions import pwd_context
from .user import AuthResponse, SignupRequest

router = APIRouter()


class StaffRequest(SignupRequest):
    admin_id: int
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    status: Literal['active', 'inactive'] = 'active'


class StaffUpdateRequest(BaseModel):
    admin_id: int
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    status: Literal['active', 'inactive'] = 'active'


@router.post('/api/admin/staff', response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffRequest, db: Session=Depends(get_db)):
    require_admin(payload.admin_id, db)
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='An account with this email already exists.')
    user = User(full_name=payload.full_name.strip(), email=email, password_hash=pwd_context.hash(payload.password), role='staff', phone=payload.phone, address=payload.address, status=payload.status)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get('/api/admin/staff', response_model=list[AuthResponse])
def list_staff(admin_id: int, db: Session=Depends(get_db)):
    require_admin(admin_id, db)
    return [{'user_id': user.user_id, 'full_name': user.full_name, 'email': user.email, 'role': user.role, 'phone': user.phone, 'address': None, 'status': user.status, 'profile_image': None} for user in db.query(User).filter(User.role == 'staff').order_by(User.created_at.desc()).all()]


@router.put('/api/admin/staff/{staff_id}', response_model=AuthResponse)
def update_staff(staff_id: int, payload: StaffUpdateRequest, db: Session=Depends(get_db)):
    require_admin(payload.admin_id, db)
    staff = db.query(User).filter(User.user_id == staff_id, User.role == 'staff').first()
    if not staff:
        raise HTTPException(status_code=404, detail='Staff account not found.')
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email, User.user_id != staff_id).first():
        raise HTTPException(status_code=409, detail='That email is already in use.')
    staff.full_name = payload.full_name.strip()
    staff.email = email
    staff.phone = payload.phone
    staff.address = payload.address
    staff.status = payload.status
    db.commit()
    db.refresh(staff)
    return staff


@router.delete('/api/admin/staff/{staff_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(staff_id: int, admin_id: int, db: Session=Depends(get_db)):
    require_admin(admin_id, db)
    staff = db.query(User).filter(User.user_id == staff_id, User.role == 'staff').first()
    if not staff:
        raise HTTPException(status_code=404, detail='Staff account not found.')
    db.delete(staff)
    db.commit()
