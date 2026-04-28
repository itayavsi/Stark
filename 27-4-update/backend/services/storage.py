from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, List, Optional, Type

from sqlalchemy import inspect as sa_inspect, select

from services.orm import session_scope
from services.orm_models import ExternalQuestORM, FinishedQuestORM, OpenQuestORM, UserORM

OPEN_QUESTS_TABLE = "open_quests"
FINISHED_QUESTS_TABLE = "finished_quests"
_FINISHED_STATUSES = {"Finished", "Done", "Created"}


QuestModel = OpenQuestORM | FinishedQuestORM


@lru_cache(maxsize=8)
def _column_keys(model_cls: Type[Any]) -> set[str]:
    return {col.key for col in sa_inspect(model_cls).columns}


def _normalize_timestamp(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def _quest_to_dict(row: QuestModel) -> Dict[str, Any]:
    raw_date = row.date
    raw_priority = row.priority
    raw_deadline_at = row.deadline_at
    normalized_deadline_at = raw_deadline_at
    if not normalized_deadline_at and raw_priority == "deadline" and isinstance(raw_date, str) and "T" in raw_date:
        normalized_deadline_at = raw_date

    return {
        "id": str(row.id),
        "title": row.title,
        "description": row.description,
        "notes": row.notes or "",
        "model_simulations": row.model_simulations,
        "status": row.status,
        "priority": row.priority,
        "date": raw_date,
        "deadline_at": normalized_deadline_at,
        "assigned_user": row.assigned_user,
        "shapefile_path": row.shapefile_path,
        "model_folder": row.model_folder,
        "target_type": row.target_type,
        "country": row.country,
        "zarhan_notes": row.zarhan_notes,
        "user_priority": row.user_priority,
        "duo_to_use": row.duo_to_use,
        "ground_point": row.ground_point,
        "solve_strategy": row.solve_strategy,
        "entry_date": row.entry_date,
        "finished_date": row.finished_date,
        "group": row.group_name,
        "year": row.year,
        "ft": row.ft,
        "quest_type": row.ft,
        "matziah": row.matziah,
        "sync_external_id": row.sync_external_id,
        "sync_source": row.sync_source,
        "sync_name": row.sync_name,
        "geometry_type": list(row.geometry_type) if row.geometry_type else None,
        "geometry_status": row.geometry_status or ("pending" if row.shapefile_path else "missing"),
        "geometry_source_path": row.geometry_source_path or row.shapefile_path,
        "geometry_source_name": row.geometry_source_name,
        "geometry_feature_count": row.geometry_feature_count or 0,
        "geometry_updated_at": _normalize_timestamp(row.geometry_updated_at),
    }


def _normalize_user(row: UserORM) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "username": row.username,
        "password": row.password,
        "role": row.role,
        "group": row.group_name,
        "display_name": row.display_name,
    }


def _normalize_external_quest(row: ExternalQuestORM) -> Dict[str, Any]:
    payload = dict(row.payload or {})
    payload["external_id"] = str(row.external_id)
    payload["matziah"] = str(row.matziah)
    payload["local_status"] = str(row.local_status) if row.local_status else None
    payload["transferred_quest_id"] = str(row.transferred_quest_id) if row.transferred_quest_id else None
    return payload


def _quest_model_payload(row: QuestModel) -> Dict[str, Any]:
    payload = {
        "id": row.id,
        "title": row.title,
        "description": row.description,
        "notes": row.notes,
        "model_simulations": row.model_simulations,
        "status": row.status,
        "priority": row.priority,
        "date": row.date,
        "deadline_at": row.deadline_at,
        "assigned_user": row.assigned_user,
        "shapefile_path": row.shapefile_path,
        "model_folder": row.model_folder,
        "target_type": row.target_type,
        "country": row.country,
        "zarhan_notes": row.zarhan_notes,
        "user_priority": row.user_priority,
        "duo_to_use": row.duo_to_use,
        "ground_point": row.ground_point,
        "solve_strategy": row.solve_strategy,
        "entry_date": row.entry_date,
        "finished_date": row.finished_date,
        "group_name": row.group_name,
        "year": row.year,
        "ft": row.ft,
        "matziah": row.matziah,
        "sync_external_id": row.sync_external_id,
        "sync_source": row.sync_source,
        "sync_name": row.sync_name,
        "geometry_type": list(row.geometry_type) if row.geometry_type else None,
        "geometry_status": row.geometry_status,
        "geometry_geojson": row.geometry_geojson,
        "geometry_source_path": row.geometry_source_path,
        "geometry_source_name": row.geometry_source_name,
        "geometry_upload_kind": row.geometry_upload_kind,
        "geometry_feature_count": row.geometry_feature_count,
        "geometry_utm_zone": row.geometry_utm_zone,
        "geometry_utm_band": row.geometry_utm_band,
        "geometry_utm_easting": row.geometry_utm_easting,
        "geometry_utm_northing": row.geometry_utm_northing,
        "geometry_point_geojson": row.geometry_point_geojson,
        "geometry_polygon_geojson": row.geometry_polygon_geojson,
        "geometry_point_feature_count": row.geometry_point_feature_count,
        "geometry_polygon_feature_count": row.geometry_polygon_feature_count,
        "geometry_updated_at": row.geometry_updated_at,
    }
    if isinstance(row, FinishedQuestORM):
        payload["accuracy_xy"] = row.accuracy_xy
        payload["accuracy_z"] = row.accuracy_z
    return payload


def _find_quest(session, quest_id: str) -> QuestModel | None:
    quest = session.get(OpenQuestORM, quest_id)
    if quest is not None:
        return quest
    return session.get(FinishedQuestORM, quest_id)


def get_users() -> List[Dict]:
    with session_scope() as session:
        rows = session.scalars(select(UserORM).order_by(UserORM.username.asc())).all()
        return [_normalize_user(row) for row in rows]


def save_user(user: Dict):
    payload = {
        "id": user["id"],
        "username": user["username"],
        "password": user["password"],
        "role": user["role"],
        "group_name": user["group"],
        "display_name": user["display_name"],
    }
    with session_scope() as session:
        session.add(UserORM(**payload))


def update_user(user_id: str, updates: Dict) -> Optional[Dict]:
    if not updates:
        return None

    allowed_fields = {
        "password": "password",
        "role": "role",
        "group": "group_name",
        "display_name": "display_name",
    }

    with session_scope() as session:
        row = session.get(UserORM, user_id)
        if row is None:
            return None

        changed = False
        for key, value in updates.items():
            column = allowed_fields.get(key)
            if not column:
                continue
            setattr(row, column, value)
            changed = True

        if not changed:
            return None

        session.flush()
        return _normalize_user(row)


def delete_user(user_id: str) -> bool:
    with session_scope() as session:
        row = session.get(UserORM, user_id)
        if row is None:
            return False
        session.delete(row)
        return True


def get_quests() -> List[Dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(OpenQuestORM).order_by(OpenQuestORM.date.desc(), OpenQuestORM.title.asc())
        ).all()
        return [_quest_to_dict(row) for row in rows]


def get_finished_quests() -> List[Dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(FinishedQuestORM).order_by(FinishedQuestORM.date.desc(), FinishedQuestORM.title.asc())
        ).all()
        return [_quest_to_dict(row) for row in rows]


def get_quest_by_id(quest_id: str) -> Optional[Dict]:
    with session_scope() as session:
        row = _find_quest(session, quest_id)
        if row is None:
            return None
        return _quest_to_dict(row)


def get_quest_by_sync_external_id(external_id: str) -> Optional[Dict]:
    with session_scope() as session:
        open_row = session.scalar(select(OpenQuestORM).where(OpenQuestORM.sync_external_id == external_id))
        if open_row is not None:
            return _quest_to_dict(open_row)
        finished_row = session.scalar(select(FinishedQuestORM).where(FinishedQuestORM.sync_external_id == external_id))
        if finished_row is None:
            return None
        return _quest_to_dict(finished_row)


def save_quest(quest: Dict):
    target_model = FinishedQuestORM if quest.get("status") in _FINISHED_STATUSES else OpenQuestORM
    payload = {
        "id": quest["id"],
        "title": quest["title"],
        "description": quest.get("description", ""),
        "status": quest["status"],
        "priority": "ב" if quest.get("priority") is None else quest.get("priority"),
        "date": quest["date"],
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
        "entry_date": quest.get("entry_date") or quest.get("date"),
        "finished_date": quest.get("finished_date"),
        "group_name": quest["group"],
        "year": quest["year"],
        "ft": quest["ft"],
        "matziah": quest.get("matziah", "H"),
        "sync_external_id": quest.get("sync_external_id"),
        "sync_source": quest.get("sync_source"),
        "sync_name": quest.get("sync_name"),
        "geometry_status": "pending" if quest.get("shapefile_path") else "missing",
        "geometry_source_path": quest.get("shapefile_path"),
        "geometry_feature_count": 0,
        "geometry_point_feature_count": 0,
        "geometry_polygon_feature_count": 0,
    }

    model_payload = {key: value for key, value in payload.items() if key in _column_keys(target_model)}
    with session_scope() as session:
        session.add(target_model(**model_payload))


def update_quest(quest_id: str, updates: Dict) -> Optional[Dict]:
    if not updates:
        return None

    allowed_fields = {
        "title": "title",
        "description": "description",
        "notes": "notes",
        "model_simulations": "model_simulations",
        "status": "status",
        "priority": "priority",
        "date": "date",
        "deadline_at": "deadline_at",
        "assigned_user": "assigned_user",
        "shapefile_path": "shapefile_path",
        "model_folder": "model_folder",
        "target_type": "target_type",
        "country": "country",
        "zarhan_notes": "zarhan_notes",
        "user_priority": "user_priority",
        "duo_to_use": "duo_to_use",
        "ground_point": "ground_point",
        "solve_strategy": "solve_strategy",
        "entry_date": "entry_date",
        "finished_date": "finished_date",
        "group": "group_name",
        "year": "year",
        "ft": "ft",
        "matziah": "matziah",
        "sync_external_id": "sync_external_id",
        "sync_source": "sync_source",
        "sync_name": "sync_name",
    }

    with session_scope() as session:
        quest = _find_quest(session, quest_id)
        if quest is None:
            return None

        changed = False
        for key, value in updates.items():
            column = allowed_fields.get(key)
            if not column:
                continue
            setattr(quest, column, value)
            changed = True

        if not changed:
            return None

        if "shapefile_path" in updates:
            source_path = updates.get("shapefile_path")
            if quest.geometry_source_path is None:
                quest.geometry_source_path = source_path

            has_geometry = bool(
                quest.geometry_type
                or quest.geometry_geojson
                or quest.geometry_point_geojson
                or quest.geometry_polygon_geojson
            )
            if not has_geometry:
                quest.geometry_status = "pending" if source_path is not None else "missing"
            quest.geometry_updated_at = datetime.utcnow()

        session.flush()
        return _quest_to_dict(quest)


def move_quest(quest_id: str, destination_table: str, updates: Optional[Dict] = None) -> Optional[Dict]:
    updates = updates or {}
    source_model = FinishedQuestORM if destination_table == OPEN_QUESTS_TABLE else OpenQuestORM
    destination_model = OpenQuestORM if destination_table == OPEN_QUESTS_TABLE else FinishedQuestORM

    allowed_fields = {
        "title": "title",
        "description": "description",
        "notes": "notes",
        "model_simulations": "model_simulations",
        "status": "status",
        "priority": "priority",
        "date": "date",
        "deadline_at": "deadline_at",
        "assigned_user": "assigned_user",
        "shapefile_path": "shapefile_path",
        "model_folder": "model_folder",
        "target_type": "target_type",
        "country": "country",
        "zarhan_notes": "zarhan_notes",
        "user_priority": "user_priority",
        "duo_to_use": "duo_to_use",
        "ground_point": "ground_point",
        "solve_strategy": "solve_strategy",
        "entry_date": "entry_date",
        "finished_date": "finished_date",
        "group": "group_name",
        "year": "year",
        "ft": "ft",
        "matziah": "matziah",
        "sync_external_id": "sync_external_id",
        "sync_source": "sync_source",
        "sync_name": "sync_name",
        "geometry_type": "geometry_type",
        "geometry_status": "geometry_status",
        "geometry_geojson": "geometry_geojson",
        "geometry_source_path": "geometry_source_path",
        "geometry_source_name": "geometry_source_name",
        "geometry_upload_kind": "geometry_upload_kind",
        "geometry_feature_count": "geometry_feature_count",
        "geometry_utm_zone": "geometry_utm_zone",
        "geometry_utm_band": "geometry_utm_band",
        "geometry_utm_easting": "geometry_utm_easting",
        "geometry_utm_northing": "geometry_utm_northing",
        "geometry_point_geojson": "geometry_point_geojson",
        "geometry_polygon_geojson": "geometry_polygon_geojson",
        "geometry_point_feature_count": "geometry_point_feature_count",
        "geometry_polygon_feature_count": "geometry_polygon_feature_count",
        "geometry_updated_at": "geometry_updated_at",
        "accuracy_xy": "accuracy_xy",
        "accuracy_z": "accuracy_z",
    }

    with session_scope() as session:
        source_row = session.get(source_model, quest_id)
        if source_row is None:
            return None

        quest_payload = _quest_model_payload(source_row)

        for key, value in updates.items():
            column = allowed_fields.get(key)
            if not column:
                continue
            quest_payload[column] = value

        if destination_table == FINISHED_QUESTS_TABLE and not quest_payload.get("finished_date"):
            quest_payload["finished_date"] = datetime.now().strftime("%Y-%m-%d")

        if destination_table == OPEN_QUESTS_TABLE and "finished_date" not in updates:
            quest_payload["finished_date"] = None

        destination_keys = _column_keys(destination_model)
        destination_payload = {k: v for k, v in quest_payload.items() if k in destination_keys}

        destination_row = session.get(destination_model, quest_id)
        if destination_row is None:
            destination_row = destination_model(**destination_payload)
            session.add(destination_row)
        else:
            for key, value in destination_payload.items():
                setattr(destination_row, key, value)

        session.delete(source_row)
        session.flush()
        return _quest_to_dict(destination_row)


def get_external_quests() -> List[Dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(ExternalQuestORM).order_by(ExternalQuestORM.updated_at.desc(), ExternalQuestORM.created_at.desc())
        ).all()
        return [_normalize_external_quest(row) for row in rows]


def get_external_quest(external_id: str) -> Optional[Dict]:
    with session_scope() as session:
        row = session.get(ExternalQuestORM, external_id)
        if row is None:
            return None
        return _normalize_external_quest(row)


def save_external_quest(
    external_id: str,
    payload: Dict,
    matziah: str,
    local_status: Optional[str] = None,
    transferred_quest_id: Optional[str] = None,
) -> Dict:
    with session_scope() as session:
        row = session.get(ExternalQuestORM, external_id)
        if row is None:
            row = ExternalQuestORM(
                external_id=external_id,
                payload=dict(payload),
                matziah=matziah,
                local_status=local_status,
                transferred_quest_id=transferred_quest_id,
            )
            session.add(row)
        else:
            row.payload = dict(payload)
            row.matziah = matziah
            if local_status is not None:
                row.local_status = local_status
            if transferred_quest_id is not None:
                row.transferred_quest_id = transferred_quest_id
            row.updated_at = datetime.utcnow()

        session.flush()
        return _normalize_external_quest(row)


def delete_external_quest(external_id: str) -> bool:
    with session_scope() as session:
        row = session.get(ExternalQuestORM, external_id)
        if row is None:
            return False
        session.delete(row)
        return True


def update_external_quest_status(external_id: str, external_status: str, local_status: str) -> Optional[Dict]:
    existing_payload = get_external_quest(external_id)
    if existing_payload is None:
        return None

    next_payload = dict(existing_payload)
    next_payload["status"] = external_status
    return save_external_quest(
        external_id,
        next_payload,
        matziah=str(existing_payload.get("matziah") or "N"),
        local_status=local_status,
        transferred_quest_id=existing_payload.get("transferred_quest_id"),
    )
