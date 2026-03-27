from fastapi import APIRouter, HTTPException
from services.user_service import create_user, delete_existing_user, get_all_users, update_existing_user
from models.user import UserCreate, UserUpdate

router = APIRouter()

@router.get("/")
def list_users():
    return get_all_users()

@router.post("/")
def add_user(user: UserCreate):
    try:
        return create_user(user.dict())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/{user_id}")
def update_user(user_id: str, user: UserUpdate):
    try:
        result = update_existing_user(user_id, user.dict(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@router.delete("/{user_id}")
def remove_user(user_id: str):
    if not delete_existing_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted", "user_id": user_id}
