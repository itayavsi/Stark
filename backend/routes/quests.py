import httpx
from fastapi import APIRouter, Body, HTTPException

from models.quest import (
    ExternalQuestCreate,
    MATZIAH_OPTIONS,
    PRIORITY_OPTIONS,
    QuestCreate,
    STATUS_OPTIONS,
)
from services.quest_service import (
    complete_quest,
    create_external_quest_entry,
    create_quest,
    get_all_quests,
    get_saved_quest_sort,
    save_saved_quest_sort,
    take_quest,
    transfer_external_quest_to_local,
    update_quest_priority,
    update_quest_status,
)

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


@router.post("/external")
def add_external_quest(quest: ExternalQuestCreate):
    try:
        return create_external_quest_entry(quest.dict())
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"External quest service error: {exc}") from exc


@router.post("/{quest_id}/transfer-to-open")
def transfer_to_open(quest_id: str):
    if not quest_id.startswith("external:"):
        raise HTTPException(status_code=400, detail="Only external quests can be transferred")

    try:
        result = transfer_external_quest_to_local(quest_id)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"External quest service error: {exc}") from exc

    if not result:
        raise HTTPException(status_code=404, detail="Quest not found")
    return result


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
    valid = set(STATUS_OPTIONS)
    if status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")

    try:
        result = update_quest_status(quest_id, status)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"External quest service error: {exc}") from exc

    if not result:
        raise HTTPException(status_code=404, detail="Quest not found")
    return result


@router.patch("/{quest_id}/priority")
def set_priority(quest_id: str, priority: str = Body(..., embed=True)):
    valid = set(PRIORITY_OPTIONS)
    if priority not in valid:
        raise HTTPException(status_code=400, detail="Invalid priority")
    result = update_quest_priority(quest_id, priority)
    if not result:
        raise HTTPException(status_code=404, detail="Quest not found")
    return result


@router.get("/matziah-options")
def get_matziah_options():
    return {"options": MATZIAH_OPTIONS}


@router.get("/sort-order")
def get_sort_order(group: str, view: str):
    return {"group": group, "view": view, "quest_ids": get_saved_quest_sort(group, view)}


@router.post("/sort-order")
def save_sort_order(
    group: str = Body(..., embed=True),
    view: str = Body(..., embed=True),
    quest_ids: list[str] = Body(..., embed=True),
):
    return {"group": group, "view": view, "quest_ids": save_saved_quest_sort(group, view, quest_ids)}
