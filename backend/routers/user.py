"""User API endpoints and request/response definitions."""

from typing import Literal
import base64
import hashlib
import hmac
import json
import os
import smtplib
import time
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserSession
from sessions import COOKIE_NAME, create_session, current_user, pwd_context, token_hash
from services.profiles import profile_response
from utilities.files import decode_artwork

router = APIRouter()


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class PasswordResetConfirm(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: Literal['admin', 'staff', 'customer']
    phone: str | None = None
    address: str | None = None
    status: str
    profile_image: str | None = None


@router.post('/api/auth/signup', response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, response: Response, db: Session=Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(User.user_id).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='An account with this email already exists.')
    user = User(full_name=payload.full_name.strip(), email=email, password_hash=pwd_context.hash(payload.password), role='customer')
    db.add(user)
    db.flush()
    result = profile_response(user)
    create_session(user, response, db)
    return result


@router.post('/api/auth/login', response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session=Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Incorrect email or password.')
    if user.status != 'active':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='This account is inactive.')
    result = profile_response(user)
    create_session(user, response, db)
    return result


@router.post('/api/auth/logout', status_code=204)
def logout(request: Request, response: Response, db: Session=Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.query(UserSession).filter(UserSession.token_hash == token_hash(token)).delete()
        db.commit()
    response.delete_cookie(COOKIE_NAME, path='/')


@router.get('/api/auth/profile-image')
def get_profile_image(user_id: int, user: User = Depends(current_user)):
    if user_id != user.user_id or not user.has_profile_image:
        raise HTTPException(status_code=404, detail='Profile image not found.')
    mime_type, content = decode_artwork(user.profile_image, image_only=True)
    return Response(content=content, media_type=mime_type, headers={'Cache-Control': 'no-store'})


def make_reset_token(email: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({'email': email, 'expires': int(time.time()) + 3600}).encode()).decode().rstrip('=')
    signature = hmac.new(os.getenv('RESET_TOKEN_SECRET', 'change-this-reset-secret').encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f'{payload}.{signature}'


def read_reset_token(token: str) -> str:
    try:
        payload, signature = token.rsplit('.', 1)
        expected = hmac.new(os.getenv('RESET_TOKEN_SECRET', 'change-this-reset-secret').encode(), payload.encode(), hashlib.sha256).hexdigest()
        data = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        if not hmac.compare_digest(signature, expected) or data['expires'] < time.time():
            raise ValueError
        return data['email']
    except Exception:
        raise HTTPException(status_code=400, detail='This password reset link is invalid or has expired.')


@router.post('/api/auth/forgot-password')
def forgot_password(payload: PasswordResetRequest, db: Session=Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user:
        message = EmailMessage()
        message['Subject'] = 'Reset your Blackeyes password'
        message['From'] = os.getenv('SMTP_FROM', os.getenv('SMTP_USER', 'no-reply@blackeyes.local'))
        message['To'] = user.email
        message.set_content(f"Use this one-hour reset link:\n\n{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/?reset_token={make_reset_token(user.email)}")
        try:
            with smtplib.SMTP_SSL(os.getenv('SMTP_HOST', ''), int(os.getenv('SMTP_PORT', '465'))) as smtp:
                smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
                smtp.send_message(message)
        except Exception:
            pass
    return {'message': 'If an account exists for that email, a reset link has been sent.'}


@router.post('/api/auth/reset-password')
def reset_password(payload: PasswordResetConfirm, db: Session=Depends(get_db)):
    user = db.query(User).filter(User.email == read_reset_token(payload.token)).first()
    if not user:
        raise HTTPException(status_code=400, detail='This password reset link is invalid or has expired.')
    user.password_hash = pwd_context.hash(payload.password)
    db.query(UserSession).filter(UserSession.user_id == user.user_id).delete()
    db.commit()
    return {'message': 'Your password has been reset. You can now sign in.'}
