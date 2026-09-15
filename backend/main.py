from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Base, User

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: Literal["admin", "staff", "customer"]
    phone: str | None = None
    address: str | None = None
    status: str
    profile_image: str | None = None


class StaffRequest(SignupRequest):
    admin_id: int
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    status: Literal["active", "inactive"] = "active"


class SettingsRequest(BaseModel):
    admin_id: int
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    profile_image: str | None = Field(default=None, max_length=2_000_000)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


@app.post("/api/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    # Public registration creates customer accounts only.
    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=pwd_context.hash(payload.password),
        role="customer", # Default role for public signups
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is inactive.")
    return user


def require_admin(admin_id: int, db: Session) -> User:
    admin = db.query(User).filter(User.user_id == admin_id).first()
    if not admin or admin.role != "admin" or admin.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access is required.")
    return admin


@app.post("/api/admin/staff", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffRequest, db: Session = Depends(get_db)):
    require_admin(payload.admin_id, db)
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    user = User(full_name=payload.full_name.strip(), email=email, password_hash=pwd_context.hash(payload.password), role="staff", phone=payload.phone, address=payload.address, status=payload.status)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.put("/api/admin/settings", response_model=AuthResponse)
def update_admin_settings(payload: SettingsRequest, db: Session = Depends(get_db)):
    admin = require_admin(payload.admin_id, db)
    email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == email, User.user_id != admin.user_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That email is already in use.")
    if payload.new_password:
        if not payload.current_password or not pwd_context.verify(payload.current_password, admin.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your current password is incorrect.")
        admin.password_hash = pwd_context.hash(payload.new_password)
    admin.full_name = payload.full_name.strip()
    admin.email = email
    admin.phone = payload.phone
    admin.address = payload.address
    admin.profile_image = payload.profile_image
    db.commit()
    db.refresh(admin)
    return admin

# Automatically creates tables in your cloud database if they don't exist yet
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    # Lightweight migration for existing databases created before profile images.
    if "profile_image" not in {column["name"] for column in inspect(engine).get_columns("users")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN profile_image VARCHAR"))

@app.get("/")
def read_root():
    return {"message": "Connected to Cloud PostgreSQL successfully!"}
