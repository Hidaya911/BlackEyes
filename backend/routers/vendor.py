"""Vendor API endpoints and request/response definitions."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from access import require_admin
from database import get_db
from models import Vendor, VendorPurchase

router = APIRouter()


class VendorRequest(BaseModel):
    admin_id: int
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)

    @field_validator('name', 'phone', 'email', mode='before')
    @classmethod
    def trim_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator('email')
    @classmethod
    def validate_email(cls, value):
        if not value:
            return None
        import re
        if not re.fullmatch('[^\\s@]+@[^\\s@]+\\.[^\\s@]+', value):
            raise ValueError('Enter a valid email address.')
        return value.lower()


class VendorResponse(BaseModel):
    vendor_id: int
    name: str
    phone: str | None
    email: str | None


@router.get('/api/admin/vendors', response_model=list[VendorResponse])
def list_vendors(admin_id: int, db: Session=Depends(get_db)):
    require_admin(admin_id, db)
    return db.query(Vendor).order_by(Vendor.vendor_id.desc()).all()


@router.post('/api/admin/vendors', response_model=VendorResponse, status_code=201)
def create_vendor(payload: VendorRequest, db: Session=Depends(get_db)):
    require_admin(payload.admin_id, db)
    vendor = Vendor(name=payload.name, phone=payload.phone or None, email=payload.email)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


@router.put('/api/admin/vendors/{vendor_id}', response_model=VendorResponse)
def update_vendor(vendor_id: int, payload: VendorRequest, db: Session=Depends(get_db)):
    require_admin(payload.admin_id, db)
    vendor = db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail='Vendor not found.')
    vendor.name = payload.name
    vendor.phone = payload.phone or None
    vendor.email = payload.email
    db.commit()
    db.refresh(vendor)
    return vendor


@router.delete('/api/admin/vendors/{vendor_id}', status_code=204)
def delete_vendor(vendor_id: int, admin_id: int, db: Session=Depends(get_db)):
    require_admin(admin_id, db)
    vendor = db.query(Vendor).filter(Vendor.vendor_id == vendor_id).with_for_update().first()
    if not vendor:
        raise HTTPException(status_code=404, detail='Vendor not found.')
    if db.query(VendorPurchase).filter(VendorPurchase.vendor_id == vendor_id).first():
        raise HTTPException(status_code=409, detail='This vendor has purchase history and cannot be deleted. Their financial records must be retained.')
    db.delete(vendor)
    db.commit()
