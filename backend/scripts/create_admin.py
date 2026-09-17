"""Create initial admin and staff accounts: python -m scripts.create_admin."""

from database import SessionLocal
from models import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_users():
    db = SessionLocal()
    
    users_to_create = [
        {
            "full_name": "Super Administrator",
            "email": "admin@blackeyes.com",
            "password": "AdminPassword123!",
            "role": "admin",
            "phone": "1234567890",
            "address": "Bekaa",
            "status": "active"
        },
        {
            "full_name": "Press Staff Member",
            "email": "staff@blackeyes.com",
            "password": "StaffPassword123!",
            "role": "staff", # matches your schema: admin | staff | customer
            "phone": "0987654321",
            "address": "Bekaa",
            "status": "active"
        }
    ]

    for user_data in users_to_create:
        existing_user = db.query(User).filter(User.email == user_data["email"]).first()
        if existing_user:
            print(f"User {user_data['email']} already exists. Skipping.")
            continue

        hashed_password = pwd_context.hash(user_data["password"])
        
        new_user = User(
            full_name=user_data["full_name"],
            email=user_data["email"],
            password_hash=hashed_password,
            role=user_data["role"],
            phone=user_data["phone"],
            address=user_data["address"],
            status=user_data["status"]
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        print(f"Created {user_data['role'].upper()} account: {new_user.email} (ID: {new_user.user_id})")

    db.close()

if __name__ == "__main__":
    seed_users()
