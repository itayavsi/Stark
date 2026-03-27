import uuid
from services.storage import delete_user, get_users, save_user, update_user

VALID_ROLES = {"Team Leader", "User", "Viewer"}

def get_all_users():
    return [{k: v for k, v in u.items() if k != "password"} for u in get_users()]

def create_user(data: dict):
    username = str(data["username"]).strip()
    password = str(data["password"]).strip()

    if not username:
        raise ValueError("Username is required")
    if not password:
        raise ValueError("Password is required")
    if any(user["username"] == username for user in get_users()):
        raise ValueError("Username already exists")

    role = data.get("role", "Viewer")
    if role not in VALID_ROLES:
        raise ValueError("Invalid role")

    user = {
        "id": str(uuid.uuid4()),
        "username": username,
        "password": password,
        "role": role,
        "group": data.get("group", "לווינות"),
        "display_name": data.get("display_name", username) or username,
    }
    save_user(user)
    return {k: v for k, v in user.items() if k != "password"}


def update_existing_user(user_id: str, data: dict):
    updates = {}

    if "display_name" in data and data["display_name"] is not None:
        display_name = str(data["display_name"]).strip()
        if display_name:
            updates["display_name"] = display_name

    if "group" in data and data["group"] is not None:
        group = str(data["group"]).strip()
        if group:
            updates["group"] = group

    if "role" in data and data["role"] is not None:
        role = str(data["role"]).strip()
        if role not in VALID_ROLES:
            raise ValueError("Invalid role")
        updates["role"] = role

    if "password" in data and data["password"] is not None:
        password = str(data["password"]).strip()
        if password:
            updates["password"] = password

    updated = update_user(user_id, updates)
    if updated is None:
        return None
    return {k: v for k, v in updated.items() if k != "password"}


def delete_existing_user(user_id: str) -> bool:
    return delete_user(user_id)
