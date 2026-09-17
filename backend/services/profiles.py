from models import User
from utilities.files import decode_artwork


def profile_image_url(user: User):
    return f"/api/auth/profile-image?user_id={user.user_id}"


def set_profile_image(user: User, value: str | None):
    # The existing URL means keep the stored image; new uploads remain data URLs.
    if value == profile_image_url(user):
        return
    if value:
        decode_artwork(value, image_only=True)
    user.profile_image = value or None


def profile_response(user: User):
    return {
        "user_id": user.user_id, "full_name": user.full_name, "email": user.email,
        "phone": user.phone, "address": user.address,
        "profile_image": profile_image_url(user) if user.has_profile_image else None,
        "role": user.role, "status": user.status,
    }
