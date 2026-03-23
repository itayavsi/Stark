import time, json, base64
from services.storage import get_users

def authenticate_user(username: str, password: str):
    for user in get_users():
        if user["username"] == username and user["password"] == password:
            return {k: v for k, v in user.items() if k != "password"}
    return None

def create_token(user: dict) -> str:
    payload = json.dumps({"username": user["username"], "role": user["role"], "ts": time.time()})
    return base64.b64encode(payload.encode()).decode()

def decode_token(token: str) -> dict:
    try:
        return json.loads(base64.b64decode(token.encode()).decode())
    except Exception:
        return {}
