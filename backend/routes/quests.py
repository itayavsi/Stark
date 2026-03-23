from fastapi import APIRouter, HTTPException, Body
from services.quest_service import (
    get_all_quests, create_quest, take_quest,
    complete_quest, update_quest_status
)
from models.quest import QuestCreate

router = APIRouter()

@router.get("/")
def list_quests(group: str = None, status: str = None):
    quests = get_all_quests()
    if group:
        quests = [q for q in quests if q.get("group") == group]
    if status:
        quests = [q for q in quests if q.get("status") == status]
    return quests

@router.post("/")
def add_quest(quest: QuestCreate):
    return create_quest(quest.dict())

@router.post("/take")
def take(quest_id: str = Body(..., embed=True), username: str = Body(..., embed=True)):
    result = take_quest(quest_id, username)
    if not result:
        raise HTTPException(status_code=404, detail="Quest not found")
    return result

@router.post("/complete")
def complete(quest_id: str = Body(..., embed=True)):
    result = complete_quest(quest_id)
    if not result:
        raise HTTPException(status_code=404, detail="Quest not found")
    return result

@router.patch("/{quest_id}/status")
def set_status(quest_id: str, status: str = Body(..., embed=True)):
    valid = {"Open", "Taken", "In Progress", "Done", "Approved", "Stopped", "Cancelled"}
    if status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    result = update_quest_status(quest_id, status)
    if not result:
        raise HTTPException(status_code=404, detail="Quest not found")
    return result