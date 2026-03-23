import uuid
from services.storage import get_users, save_user

def get_all_users():
    return [{k: v for k, v in u.items() if k != "password"} for u in get_users()]

def create_user(data: dict):
    user = {
        "id": str(uuid.uuid4()),
        "username": data["username"],
        "password": data["password"],
        "role": data.get("role", "Viewer"),
        "group": data.get("group", "לווינות"),
        "display_name": data.get("display_name", data["username"]),
    }
    save_user(user)
    return {k: v for k, v in user.items() if k != "password"}
