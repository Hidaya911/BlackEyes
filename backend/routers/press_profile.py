"""Self-service staff/admin profile, authenticated through the session cookie."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from access import require_operator
from database import get_db
from models import User, UserSession
from schemas.requests.press import OperatorPassword, OperatorProfile
from services.profiles import profile_response, set_profile_image
from sessions import pwd_context
from utilities.database import commit

router = APIRouter(prefix="/api/press/profile", tags=["Press profile"])


@router.get("")
def get_profile(operator: User = Depends(require_operator)):
    return profile_response(operator)


@router.put("")
def save_profile(payload: OperatorProfile, operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    set_profile_image(operator, payload.profile_image)
    if db.query(User).filter(User.email == payload.email, User.user_id != operator.user_id).first():
        raise HTTPException(status_code=409, detail="That email is already in use.")
    for key, value in payload.model_dump().items():
        if key == "profile_image":
            continue
        if key in {"phone", "address", "profile_image"}:
            value = value or None
        setattr(operator, key, value)
    commit(db, "That email is already in use.")
    return profile_response(operator)


@router.put("/password")
def change_password(payload: OperatorPassword, operator: User = Depends(require_operator), db: Session = Depends(get_db)):
    if not pwd_context.verify(payload.current_password, operator.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    operator.password_hash = pwd_context.hash(payload.new_password)
    db.query(UserSession).filter(UserSession.user_id == operator.user_id).delete()
    commit(db)
    return {"message": "Password updated. Please sign in again."}
