from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session, load_only

from models import User
from sessions import current_user


def require_operator(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "staff"}:
        raise HTTPException(status_code=403, detail="Press staff access is required.")
    return user


def require_admin(admin_id: int, db: Session) -> User:
    # Authorization should not download the user's base64 profile photo.
    admin = db.query(User).options(
        load_only(User.user_id, User.role, User.status)
    ).filter(User.user_id == admin_id).first()
    if not admin or admin.role != "admin" or admin.status != "active":
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    return admin
