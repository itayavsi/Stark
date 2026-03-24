import uuid
from datetime import datetime
from services.storage import (
    get_quest_by_id,
    get_quest_sort_order,
    get_quests,
    save_quest,
    save_quest_sort_order,
    update_quest,
)

def get_all_quests():
    return get_quests()


def get_quest(quest_id: str):
    return get_quest_by_id(quest_id)

def create_quest(data: dict):
    today = datetime.now().strftime("%Y-%m-%d")
    quest = {
        "id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "status": "Open",
        "date": data.get("date") or today,
        "assigned_user": data.get("assigned_user"),
        "shapefile_path": data.get("shapefile_path"),
        "group": data.get("group", "לווינות"),
        "year": data.get("year", datetime.now().year),
        "ft": data.get("ft", "FT1"),
    }
    save_quest(quest)
    return quest

def take_quest(quest_id: str, username: str):
    return update_quest(quest_id, {"status": "Taken", "assigned_user": username})

def complete_quest(quest_id: str):
    return update_quest(quest_id, {"status": "Done"})

def update_quest_status(quest_id: str, status: str):
    return update_quest(quest_id, {"status": status})


def get_saved_quest_sort(group: str, view: str):
    return get_quest_sort_order(group, view)


def save_saved_quest_sort(group: str, view: str, quest_ids: list[str]):
    return save_quest_sort_order(group, view, quest_ids)
