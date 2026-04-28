from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

from services.orm import Base, get_engine, session_scope
from services.orm_models import FinishedQuestORM, OpenQuestORM, UserORM

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "storage" / "data.json"
SEED_NAMESPACE = uuid.UUID("11111111-2222-3333-4444-555555555555")

_FINISHED_STATUSES = {"Finished", "Done", "Created"}


def _load_seed_data() -> dict[str, Any]:
    if not DATA_FILE.exists():
        return {"users": [], "quests": []}

    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def _coerce_uuid(raw_id: str) -> str:
    try:
        return str(uuid.UUID(str(raw_id)))
    except (ValueError, TypeError):
        return str(uuid.uuid5(SEED_NAMESPACE, str(raw_id)))


def _normalize_seed_date(raw_date: Any) -> str:
    if raw_date:
        return str(raw_date)
    return datetime.now().strftime("%Y-%m-%d")


def _seed_users(seed_data: dict[str, Any]) -> None:
    users = seed_data.get("users") or []
    if not users:
        return

    with session_scope() as session:
        for user in users:
            username = str(user.get("username") or "").strip()
            if not username:
                continue

            existing = session.scalar(select(UserORM).where(UserORM.username == username))
            if existing is not None:
                continue

            session.add(
                UserORM(
                    id=_coerce_uuid(user.get("id", username)),
                    username=username,
                    password=str(user.get("password") or ""),
                    role=str(user.get("role") or "Viewer"),
                    group_name=str(user.get("group") or "לווינות"),
                    display_name=str(user.get("display_name") or username),
                )
            )


def _seed_quests(seed_data: dict[str, Any]) -> None:
    quests = seed_data.get("quests") or []
    if not quests:
        return

    with session_scope() as session:
        for quest in quests:
            quest_id = _coerce_uuid(quest.get("id"))
            if session.get(OpenQuestORM, quest_id) or session.get(FinishedQuestORM, quest_id):
                continue

            status = str(quest.get("status") or "Start")
            target_model = FinishedQuestORM if status in _FINISHED_STATUSES else OpenQuestORM

            quest_payload = {
                "id": quest_id,
                "title": str(quest.get("title") or ""),
                "description": str(quest.get("description") or ""),
                "notes": "",
                "status": status,
                "priority": "ב" if quest.get("priority") is None else quest.get("priority"),
                "date": _normalize_seed_date(quest.get("date")),
                "deadline_at": quest.get("deadline_at"),
                "assigned_user": quest.get("assigned_user"),
                "shapefile_path": quest.get("shapefile_path"),
                "model_simulations": quest.get("model_simulations"),
                "model_folder": quest.get("model_folder"),
                "target_type": quest.get("target_type"),
                "country": quest.get("country"),
                "zarhan_notes": quest.get("zarhan_notes"),
                "user_priority": quest.get("user_priority"),
                "duo_to_use": quest.get("duo_to_use"),
                "ground_point": quest.get("ground_point"),
                "solve_strategy": quest.get("solve_strategy"),
                "entry_date": str(quest.get("entry_date") or _normalize_seed_date(quest.get("date"))),
                "finished_date": quest.get("finished_date"),
                "group_name": str(quest.get("group") or "לווינות"),
                "year": int(quest.get("year") or datetime.now().year),
                "ft": quest.get("ft"),
                "matziah": str(quest.get("matziah") or "H"),
                "sync_external_id": quest.get("sync_external_id"),
                "sync_source": quest.get("sync_source"),
                "sync_name": quest.get("sync_name"),
                "geometry_type": quest.get("geometry_type"),
                "geometry_status": "pending" if quest.get("shapefile_path") else "missing",
                "geometry_geojson": quest.get("geometry_geojson"),
                "geometry_source_path": quest.get("geometry_source_path") or quest.get("shapefile_path"),
                "geometry_source_name": quest.get("geometry_source_name"),
                "geometry_upload_kind": quest.get("geometry_upload_kind"),
                "geometry_feature_count": int(quest.get("geometry_feature_count") or 0),
                "geometry_utm_zone": quest.get("geometry_utm_zone"),
                "geometry_utm_band": quest.get("geometry_utm_band"),
                "geometry_utm_easting": quest.get("geometry_utm_easting"),
                "geometry_utm_northing": quest.get("geometry_utm_northing"),
                "geometry_point_geojson": quest.get("geometry_point_geojson"),
                "geometry_polygon_geojson": quest.get("geometry_polygon_geojson"),
                "geometry_point_feature_count": int(quest.get("geometry_point_feature_count") or 0),
                "geometry_polygon_feature_count": int(quest.get("geometry_polygon_feature_count") or 0),
            }

            if target_model is FinishedQuestORM:
                quest_payload["accuracy_xy"] = quest.get("accuracy_xy")
                quest_payload["accuracy_z"] = quest.get("accuracy_z")
                if not quest_payload.get("finished_date"):
                    quest_payload["finished_date"] = quest_payload["date"]

            session.add(target_model(**quest_payload))


def bootstrap_schema_and_seed() -> None:
    Base.metadata.create_all(bind=get_engine())

    with session_scope() as session:
        users_count = session.scalar(select(func.count(UserORM.id))) or 0
        open_count = session.scalar(select(func.count(OpenQuestORM.id))) or 0
        finished_count = session.scalar(select(func.count(FinishedQuestORM.id))) or 0

    if users_count == 0 and open_count == 0 and finished_count == 0:
        seed_data = _load_seed_data()
        _seed_users(seed_data)
        _seed_quests(seed_data)
