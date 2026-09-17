"""Temporary end-to-end auth probe; deletes only its own generated account."""
import http.cookiejar
import json
import secrets
import time
import urllib.error
import urllib.request
from uuid import uuid4

from database import SessionLocal
from models import User, UserSession
from sqlalchemy import select

email = f"auth-check-{uuid4().hex}@example.invalid"
password = secrets.token_urlsafe(24)
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def call(path, payload):
    start = time.monotonic()
    request = urllib.request.Request("http://localhost:5173" + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    try:
        with opener.open(request, timeout=90) as response:
            result = json.loads(response.read()) if response.status != 204 else None
            print(path, response.status, round(time.monotonic() - start, 1), "seconds", flush=True)
            return result
    except urllib.error.HTTPError as error:
        print(path, error.code, error.read().decode()[:350], flush=True)
        raise SystemExit(1)

try:
    call("/api/auth/signup", {"full_name": "Temporary auth verification", "email": email, "password": password})
    call("/api/auth/logout", {})
    # Copy the existing large photo inside PostgreSQL, without downloading it.
    with SessionLocal() as db:
        db.query(User).filter(User.email == email).update({User.profile_image: select(User.profile_image).where(User.user_id == 1).scalar_subquery()}, synchronize_session=False)
        db.commit()
    for role, path in [("admin", "/api/admin/products?admin_id="), ("staff", "/api/press/profile")]:
        with SessionLocal() as db:
            db.query(User).filter(User.email == email).update({User.role: role}, synchronize_session=False)
            db.commit()
        user = call("/api/auth/login", {"email": email, "password": password})
        assert user["role"] == role
        assert user["profile_image"].startswith("/api/auth/profile-image?")
        url = path + str(user["user_id"]) if role == "admin" else path
        with opener.open("http://localhost:5173" + url, timeout=90) as response:
            assert response.status == 200
            print(role, "protected API OK with existing large photo", flush=True)
        call("/api/auth/logout", {})
    with SessionLocal() as db:
        db.query(User).filter(User.email == email).update({User.role: "customer"}, synchronize_session=False)
        db.commit()
    call("/api/auth/login", {"email": email, "password": password})
    with opener.open("http://localhost:5173/api/customer/profile", timeout=90) as response:
        assert json.loads(response.read())["email"] == email
        print("Authenticated customer profile OK", flush=True)
    call("/api/auth/logout", {})
finally:
    with SessionLocal() as db:
        ids = [row[0] for row in db.query(User.user_id).filter(User.email == email).all()]
        if ids:
            db.query(UserSession).filter(UserSession.user_id.in_(ids)).delete(synchronize_session=False)
            db.query(User).filter(User.user_id.in_(ids), User.email == email).delete(synchronize_session=False)
            db.commit()
        print("Temporary auth account cleanup complete.", flush=True)
