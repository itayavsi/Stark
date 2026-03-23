from fastapi import APIRouter
from services.user_service import get_all_users, create_user
from models.user import UserCreate

router = APIRouter()

@router.get("/")
def list_users():
    return get_all_users()

@router.post("/")
def add_user(user: UserCreate):
    return create_user(user.dict())
