"""Public wholesale buyer registration; ordering is introduced separately."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas.requests.wholesale import WholesaleRegistration
from sessions import pwd_context
from utilities.database import commit

router = APIRouter(prefix="/api/wholesale", tags=["Wholesale buyers"])


@router.post('/register', status_code=201)
def register(payload: WholesaleRegistration, db: Session = Depends(get_db)):
    if db.query(User.user_id).filter(func.lower(User.email) == payload.email).first():
        raise HTTPException(409, 'An account with this email already exists. Please sign in with that account or contact the press.')
    buyer = User(full_name=payload.full_name, business_name=payload.business_name,
        email=payload.email, phone=payload.phone, address=payload.address,
        password_hash=pwd_context.hash(payload.password), role='wholesaler', status='active')
    db.add(buyer)
    commit(db, 'An account with this email already exists.')
    return {'message': 'Your wholesale buyer account has been created. The press team can now see your business details.'}
