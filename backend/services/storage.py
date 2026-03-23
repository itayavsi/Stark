"""
Storage abstraction layer.
Uses JSON for dev. Swap these functions for SQLAlchemy/PostGIS calls to go production.
"""
import json
import os
from typing import List, Dict, Optional

DATA_FILE = os.path.join(os.path.dirname(__file__), "../storage/data.json")

def _load() -> Dict:
    if not os.path.exists(DATA_FILE):
        return {"users": [], "quests": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save(data: Dict):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_users() -> List[Dict]:
    return _load().get("users", [])

def save_user(user: Dict):
    data = _load()
    data["users"].append(user)
    _save(data)

def get_quests() -> List[Dict]:
    return _load().get("quests", [])

def save_quest(quest: Dict):
    data = _load()
    data["quests"].append(quest)
    _save(data)

def update_quest(quest_id: str, updates: Dict) -> Optional[Dict]:
    data = _load()
    for q in data["quests"]:
        if q["id"] == quest_id:
            q.update(updates)
            _save(data)
            return q
    return None
