"""Opaque, database-backed sessions for private customer resources."""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import os

from fastapi import Depends, HTTPException, Request, Response
from passlib.context import CryptContext
from sqlalchemy.orm import Session, defer

from database import get_db
from models import User, UserSession

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
COOKIE_NAME = "blackeyes_session"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user: User, response: Response, db: Session):
    token = secrets.token_urlsafe(32)
    db.add(UserSession(
        token_hash=token_hash(token),
        user_id=user.user_id,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
    ))
    db.commit()
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, samesite="lax", max_age=7 * 86400,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true", path="/",
    )


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME, "")
    session = db.get(UserSession, token_hash(token)) if token else None
    if not session or session.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=401, detail="Please sign in again to continue.")
    # Fetch large photos only for endpoints that actually return the profile.
    user = db.get(User, session.user_id, options=[defer(User.profile_image)])
    if not user or user.status != "active":
        raise HTTPException(status_code=403, detail="This account is inactive.")
    return user


def require_customer(user: User = Depends(current_user)) -> User:
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="A customer account is required.")
    return user
