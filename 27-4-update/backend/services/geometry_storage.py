from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, select

from services.orm import session_scope
from services.orm_models import FinishedQuestORM, OpenQuestORM

OPEN_QUESTS_TABLE = "open_quests"
FINISHED_QUESTS_TABLE = "finished_quests"


def _normalize_timestamp(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def _normalize_geometry_row(row: OpenQuestORM | FinishedQuestORM) -> Dict[str, Any]:
    geometry_type = row.geometry_type
    if geometry_type and not isinstance(geometry_type, list):
        geometry_type = [geometry_type]

    result = {
        "quest_id": str(row.id),
        "title": row.title,
        "description": row.description,
        "status": row.status,
        "priority": row.priority,
        "date": row.date,
        "assigned_user": row.assigned_user,
        "group": row.group_name,
        "year": row.year,
        "ft": row.ft,
        "quest_type": row.ft,
        "matziah": row.matziah,
        "geometry_type": list(geometry_type) if geometry_type else None,
        "geometry_status": row.geometry_status or ("pending" if row.shapefile_path else "missing"),
        "source_path": row.geometry_source_path or row.shapefile_path,
        "source_name": row.geometry_source_name,
        "upload_kind": row.geometry_upload_kind,
        "feature_count": row.geometry_feature_count or 0,
        "feature_collection": row.geometry_geojson,
        "point_geojson": row.geometry_point_geojson,
        "polygon_geojson": row.geometry_polygon_geojson,
        "point_feature_count": row.geometry_point_feature_count or 0,
        "polygon_feature_count": row.geometry_polygon_feature_count or 0,
        "utm_zone": row.geometry_utm_zone,
        "utm_band": row.geometry_utm_band,
        "utm_easting": row.geometry_utm_easting,
        "utm_northing": row.geometry_utm_northing,
        "updated_at": _normalize_timestamp(row.geometry_updated_at),
        "accuracy_xy": getattr(row, "accuracy_xy", None),
        "accuracy_z": getattr(row, "accuracy_z", None),
    }

    return result


def _find_quest(session, quest_id: str) -> OpenQuestORM | FinishedQuestORM | None:
    row = session.get(OpenQuestORM, quest_id)
    if row is not None:
        return row
    return session.get(FinishedQuestORM, quest_id)


def get_geometry_by_quest_id(quest_id: str) -> Optional[Dict]:
    with session_scope() as session:
        row = _find_quest(session, quest_id)
        if row is None:
            return None
        return _normalize_geometry_row(row)


def get_ready_geometry_records(group: str | None = None, status: str | None = None) -> List[Dict]:
    def fetch_ready(model):
        conditions = [
            model.geometry_type.is_not(None),
            model.geometry_status == "ready",
            or_(
                model.geometry_geojson.is_not(None),
                model.geometry_point_geojson.is_not(None),
                model.geometry_polygon_geojson.is_not(None),
            ),
        ]
        if group:
            conditions.append(model.group_name == group)
        if status:
            conditions.append(model.status == status)
        return select(model).where(*conditions)

    with session_scope() as session:
        open_rows = session.scalars(fetch_ready(OpenQuestORM)).all()
        finished_rows = session.scalars(fetch_ready(FinishedQuestORM)).all()

        records = [_normalize_geometry_row(row) for row in [*open_rows, *finished_rows]]
        records.sort(key=lambda item: (str(item.get("ft") or ""), str(item.get("title") or "")))
        return records


def upsert_quest_geometry(quest_id: str, geometry: Dict) -> Optional[Dict]:
    geometry_type = geometry.get("geometry_type")
    is_point = geometry_type == "point"
    is_polygon = geometry_type == "polygon"

    with session_scope() as session:
        row = _find_quest(session, quest_id)
        if row is None:
            return None

        current_types = list(row.geometry_type or [])
        current_point_geojson = row.geometry_point_geojson
        current_polygon_geojson = row.geometry_polygon_geojson

        if is_point:
            new_point_geojson = geometry.get("geometry_geojson")
            if new_point_geojson:
                if current_point_geojson:
                    existing_features = (
                        current_point_geojson.get("features", []) if isinstance(current_point_geojson, dict) else []
                    )
                    new_features = new_point_geojson.get("features", []) if isinstance(new_point_geojson, dict) else []
                    current_point_geojson = {
                        "type": "FeatureCollection",
                        "features": [*existing_features, *new_features],
                    }
                else:
                    current_point_geojson = new_point_geojson

            if "point" not in current_types:
                current_types.append("point")

        elif is_polygon:
            new_polygon_geojson = geometry.get("geometry_geojson")
            if new_polygon_geojson:
                if current_polygon_geojson:
                    existing_features = (
                        current_polygon_geojson.get("features", [])
                        if isinstance(current_polygon_geojson, dict)
                        else []
                    )
                    new_features = new_polygon_geojson.get("features", []) if isinstance(new_polygon_geojson, dict) else []
                    current_polygon_geojson = {
                        "type": "FeatureCollection",
                        "features": [*existing_features, *new_features],
                    }
                else:
                    current_polygon_geojson = new_polygon_geojson

            if "polygon" not in current_types:
                current_types.append("polygon")

        point_features = current_point_geojson.get("features", []) if isinstance(current_point_geojson, dict) else []
        polygon_features = current_polygon_geojson.get("features", []) if isinstance(current_polygon_geojson, dict) else []

        merged_features = [*point_features, *polygon_features]
        merged_geojson = {"type": "FeatureCollection", "features": merged_features} if merged_features else None

        row.geometry_type = current_types or None
        row.geometry_status = geometry.get("geometry_status", "ready")
        row.geometry_geojson = merged_geojson
        row.geometry_point_geojson = current_point_geojson
        row.geometry_polygon_geojson = current_polygon_geojson
        row.geometry_point_feature_count = len(point_features)
        row.geometry_polygon_feature_count = len(polygon_features)
        row.geometry_feature_count = len(merged_features)

        if is_polygon:
            if geometry.get("source_path") is not None:
                row.geometry_source_path = geometry.get("source_path")
            if geometry.get("source_name") is not None:
                row.geometry_source_name = geometry.get("source_name")
            if geometry.get("upload_kind") is not None:
                row.geometry_upload_kind = geometry.get("upload_kind")

        if is_point:
            if geometry.get("utm_zone") is not None:
                row.geometry_utm_zone = geometry.get("utm_zone")
            if geometry.get("utm_band") is not None:
                row.geometry_utm_band = geometry.get("utm_band")
            if geometry.get("utm_easting") is not None:
                row.geometry_utm_easting = geometry.get("utm_easting")
            if geometry.get("utm_northing") is not None:
                row.geometry_utm_northing = geometry.get("utm_northing")

        row.geometry_updated_at = datetime.utcnow()
        session.flush()
        return _normalize_geometry_row(row)


def remove_quest_point_geometry(quest_id: str) -> Optional[Dict]:
    with session_scope() as session:
        row = _find_quest(session, quest_id)
        if row is None:
            return None

        current_types = list(row.geometry_type or [])
        if "point" not in current_types:
            return _normalize_geometry_row(row)

        current_types = [geometry_type for geometry_type in current_types if geometry_type != "point"]
        polygon_features = (
            row.geometry_polygon_geojson.get("features", [])
            if isinstance(row.geometry_polygon_geojson, dict)
            else []
        )

        row.geometry_type = current_types or None
        row.geometry_geojson = {"type": "FeatureCollection", "features": polygon_features}
        row.geometry_point_geojson = None
        row.geometry_point_feature_count = 0
        row.geometry_feature_count = len(polygon_features)
        row.geometry_utm_zone = None
        row.geometry_utm_band = None
        row.geometry_utm_easting = None
        row.geometry_utm_northing = None
        row.geometry_updated_at = datetime.utcnow()

        session.flush()
        return _normalize_geometry_row(row)


def remove_quest_polygon_geometry(quest_id: str) -> Optional[Dict]:
    with session_scope() as session:
        row = _find_quest(session, quest_id)
        if row is None:
            return None

        current_types = list(row.geometry_type or [])
        if "polygon" not in current_types:
            return _normalize_geometry_row(row)

        current_types = [geometry_type for geometry_type in current_types if geometry_type != "polygon"]
        point_features = (
            row.geometry_point_geojson.get("features", []) if isinstance(row.geometry_point_geojson, dict) else []
        )

        row.geometry_type = current_types or None
        row.geometry_geojson = {"type": "FeatureCollection", "features": point_features}
        row.geometry_polygon_geojson = None
        row.geometry_polygon_feature_count = 0
        row.geometry_feature_count = len(point_features)
        row.geometry_source_path = None
        row.geometry_source_name = None
        row.geometry_upload_kind = None
        row.geometry_updated_at = datetime.utcnow()

        session.flush()
        return _normalize_geometry_row(row)


def move_geometry_to_finished(quest_id: str, accuracy_xy: float, accuracy_z: float) -> Optional[Dict]:
    with session_scope() as session:
        finished_row = session.get(FinishedQuestORM, quest_id)
        if finished_row is not None:
            finished_row.accuracy_xy = accuracy_xy
            finished_row.accuracy_z = accuracy_z
            finished_row.geometry_updated_at = datetime.utcnow()
            session.flush()
            return _normalize_geometry_row(finished_row)

        open_row = session.get(OpenQuestORM, quest_id)
        if open_row is None:
            return None

        has_geometry = bool(
            open_row.geometry_type
            or open_row.geometry_geojson
            or open_row.geometry_point_geojson
            or open_row.geometry_polygon_geojson
        )

    if not has_geometry:
        return None

    from services.storage import move_quest

    moved = move_quest(quest_id, FINISHED_QUESTS_TABLE, {"status": "Finished"})
    if moved is None:
        return None

    with session_scope() as session:
        finished_row = session.get(FinishedQuestORM, quest_id)
        if finished_row is None:
            return None
        finished_row.accuracy_xy = accuracy_xy
        finished_row.accuracy_z = accuracy_z
        finished_row.geometry_updated_at = datetime.utcnow()
        session.flush()
        return _normalize_geometry_row(finished_row)


def get_finished_geometry_by_quest_id(quest_id: str) -> Optional[Dict]:
    with session_scope() as session:
        row = session.get(FinishedQuestORM, quest_id)
        if row is None:
            return None
        return _normalize_geometry_row(row)


def get_finished_geometry_records(group: str | None = None) -> List[Dict]:
    with session_scope() as session:
        stmt = select(FinishedQuestORM)
        if group:
            stmt = stmt.where(FinishedQuestORM.group_name == group)
        rows = session.scalars(stmt.order_by(FinishedQuestORM.ft.asc(), FinishedQuestORM.title.asc())).all()
        return [_normalize_geometry_row(row) for row in rows]
