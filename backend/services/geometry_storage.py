import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from services.db import FINISHED_QUESTS_TABLE, OPEN_QUESTS_TABLE, get_connection


def _all_quests_union() -> str:
    return f"""
        SELECT
            id,
            title,
            description,
            status,
            "תעדוף" AS priority,
            date,
            assigned_user,
            group_name,
            year,
            ft,
            "מצייח" AS matziah,
            shapefile_path,
            geometry_type,
            geometry_status,
            geometry_geojson,
            geometry_source_path AS source_path,
            geometry_source_name AS source_name,
            geometry_upload_kind AS upload_kind,
            geometry_feature_count AS feature_count,
            geometry_utm_zone AS utm_zone,
            geometry_utm_band AS utm_band,
            geometry_utm_easting AS utm_easting,
            geometry_utm_northing AS utm_northing,
            geometry_point_geojson AS point_geojson,
            geometry_polygon_geojson AS polygon_geojson,
            geometry_point_feature_count AS point_feature_count,
            geometry_polygon_feature_count AS polygon_feature_count,
            geometry_updated_at AS updated_at,
            NULL::double precision AS accuracy_xy,
            NULL::double precision AS accuracy_z
        FROM {OPEN_QUESTS_TABLE}
        UNION ALL
        SELECT
            id,
            title,
            description,
            status,
            "תעדוף" AS priority,
            date,
            assigned_user,
            group_name,
            year,
            ft,
            "מצייח" AS matziah,
            shapefile_path,
            geometry_type,
            geometry_status,
            geometry_geojson,
            geometry_source_path AS source_path,
            geometry_source_name AS source_name,
            geometry_upload_kind AS upload_kind,
            geometry_feature_count AS feature_count,
            geometry_utm_zone AS utm_zone,
            geometry_utm_band AS utm_band,
            geometry_utm_easting AS utm_easting,
            geometry_utm_northing AS utm_northing,
            geometry_point_geojson AS point_geojson,
            geometry_polygon_geojson AS polygon_geojson,
            geometry_point_feature_count AS point_feature_count,
            geometry_polygon_feature_count AS polygon_feature_count,
            geometry_updated_at AS updated_at,
            accuracy_xy,
            accuracy_z
        FROM {FINISHED_QUESTS_TABLE}
    """


def _normalize_timestamp(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def _normalize_geometry_row(row: Dict) -> Dict:
    geometry_geojson = row.get("geometry_geojson")
    point_geojson = row.get("point_geojson")
    polygon_geojson = row.get("polygon_geojson")
    
    if isinstance(geometry_geojson, str):
        geometry_geojson = json.loads(geometry_geojson)
    if isinstance(point_geojson, str):
        point_geojson = json.loads(point_geojson)
    if isinstance(polygon_geojson, str):
        polygon_geojson = json.loads(polygon_geojson)
    
    geometry_type = row.get("geometry_type")
    if geometry_type and not isinstance(geometry_type, list):
        geometry_type = [geometry_type]
    
    result = {
        "quest_id": str(row["quest_id"]),
        "title": row["title"],
        "description": row["description"],
        "status": row["status"],
        "priority": row["priority"],
        "date": row["date"],
        "assigned_user": row["assigned_user"],
        "group": row["group_name"],
        "year": row["year"],
        "ft": row["ft"],
        "quest_type": row["ft"],
        "matziah": row["matziah"],
        "geometry_type": geometry_type,
        "geometry_status": row["geometry_status"],
        "source_path": row["source_path"],
        "source_name": row["source_name"],
        "upload_kind": row["upload_kind"],
        "feature_count": row["feature_count"] or 0,
        "feature_collection": geometry_geojson,
        "point_geojson": point_geojson,
        "polygon_geojson": polygon_geojson,
        "point_feature_count": row.get("point_feature_count") or 0,
        "polygon_feature_count": row.get("polygon_feature_count") or 0,
        "utm_zone": row["utm_zone"],
        "utm_band": row["utm_band"],
        "utm_easting": row["utm_easting"],
        "utm_northing": row["utm_northing"],
        "updated_at": _normalize_timestamp(row["updated_at"]),
    }
    
    if "accuracy_xy" in row:
        result["accuracy_xy"] = row["accuracy_xy"]
    if "accuracy_z" in row:
        result["accuracy_z"] = row["accuracy_z"]
    
    return result


def _find_quest_table(cur, quest_id: str) -> Optional[str]:
    cur.execute(
        f"""
        SELECT id
        FROM {OPEN_QUESTS_TABLE}
        WHERE id = %(quest_id)s;
        """,
        {"quest_id": quest_id},
    )
    if cur.fetchone() is not None:
        return OPEN_QUESTS_TABLE

    cur.execute(
        f"""
        SELECT id
        FROM {FINISHED_QUESTS_TABLE}
        WHERE id = %(quest_id)s;
        """,
        {"quest_id": quest_id},
    )
    if cur.fetchone() is not None:
        return FINISHED_QUESTS_TABLE
    return None


def get_geometry_by_quest_id(quest_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    q.id AS quest_id,
                    q.title,
                    q.description,
                    q.status,
                    q.priority,
                    q.date,
                    q.assigned_user,
                    q.group_name,
                    q.year,
                    q.ft,
                    q.matziah,
                    q.geometry_type,
                    COALESCE(
                        q.geometry_status,
                        CASE WHEN q.shapefile_path IS NOT NULL THEN 'pending' ELSE 'missing' END
                    ) AS geometry_status,
                    COALESCE(q.source_path, q.shapefile_path) AS source_path,
                    q.source_name,
                    q.upload_kind,
                    COALESCE(q.feature_count, 0) AS feature_count,
                    q.geometry_geojson,
                    q.point_geojson,
                    q.polygon_geojson,
                    COALESCE(q.point_feature_count, 0) AS point_feature_count,
                    COALESCE(q.polygon_feature_count, 0) AS polygon_feature_count,
                    q.utm_zone,
                    q.utm_band,
                    q.utm_easting,
                    q.utm_northing,
                    q.updated_at,
                    q.accuracy_xy,
                    q.accuracy_z
                FROM ({_all_quests_union()}) AS q
                WHERE q.id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            row = cur.fetchone()
            if row is None:
                return None
            return _normalize_geometry_row(row)


def get_ready_geometry_records(group: str | None = None, status: str | None = None) -> List[Dict]:
    where_clauses = [
        "q.geometry_type IS NOT NULL",
        "q.geometry_status = 'ready'",
        "(q.geometry_geojson IS NOT NULL OR q.point_geojson IS NOT NULL OR q.polygon_geojson IS NOT NULL)",
    ]
    params: Dict[str, Any] = {}

    if group:
        where_clauses.append("q.group_name = %(group)s")
        params["group"] = group
    if status:
        where_clauses.append("q.status = %(status)s")
        params["status"] = status

    where_sql = f"WHERE {' AND '.join(where_clauses)}"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    q.id AS quest_id,
                    q.title,
                    q.description,
                    q.status,
                    q.priority,
                    q.date,
                    q.assigned_user,
                    q.group_name,
                    q.year,
                    q.ft,
                    q.matziah,
                    q.geometry_type,
                    q.geometry_status,
                    COALESCE(q.source_path, q.shapefile_path) AS source_path,
                    q.source_name,
                    q.upload_kind,
                    COALESCE(q.feature_count, 0) AS feature_count,
                    q.geometry_geojson,
                    q.point_geojson,
                    q.polygon_geojson,
                    COALESCE(q.point_feature_count, 0) AS point_feature_count,
                    COALESCE(q.polygon_feature_count, 0) AS polygon_feature_count,
                    q.utm_zone,
                    q.utm_band,
                    q.utm_easting,
                    q.utm_northing,
                    q.updated_at,
                    q.accuracy_xy,
                    q.accuracy_z
                FROM ({_all_quests_union()}) AS q
                {where_sql}
                ORDER BY q.ft ASC, q.title ASC;
                """,
                params,
            )
            return [_normalize_geometry_row(row) for row in cur.fetchall()]


def upsert_quest_geometry(quest_id: str, geometry: Dict) -> Optional[Dict]:
    geometry_type = geometry.get("geometry_type")
    is_point = geometry_type == "point"
    is_polygon = geometry_type == "polygon"
    
    with get_connection() as conn:
        with conn.cursor() as cur:
            target_table = _find_quest_table(cur, quest_id)
            if target_table is None:
                return None

            cur.execute(
                f"""
                SELECT 
                    geometry_type, 
                    geometry_point_geojson AS point_geojson,
                    geometry_polygon_geojson AS polygon_geojson,
                    geometry_point_feature_count AS point_feature_count,
                    geometry_polygon_feature_count AS polygon_feature_count,
                    geometry_geojson
                FROM {target_table}
                WHERE id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            existing = cur.fetchone()
            
            current_types = existing["geometry_type"] if existing else None
            if current_types and not isinstance(current_types, list):
                current_types = [current_types]
            
            current_point_geojson = existing["point_geojson"] if existing else None
            current_polygon_geojson = existing["polygon_geojson"] if existing else None
            
            if is_point:
                new_point_geojson = geometry.get("geometry_geojson")
                if new_point_geojson:
                    if current_point_geojson:
                        existing_features = current_point_geojson.get("features", []) if isinstance(current_point_geojson, dict) else []
                        new_features = new_point_geojson.get("features", []) if isinstance(new_point_geojson, dict) else []
                        current_point_geojson = {"type": "FeatureCollection", "features": existing_features + new_features}
                    else:
                        current_point_geojson = new_point_geojson
                
                if current_types is None:
                    current_types = ["point"]
                elif "point" not in current_types:
                    current_types = current_types + ["point"]
                    
            elif is_polygon:
                new_polygon_geojson = geometry.get("geometry_geojson")
                if new_polygon_geojson:
                    if current_polygon_geojson:
                        existing_features = current_polygon_geojson.get("features", []) if isinstance(current_polygon_geojson, dict) else []
                        new_features = new_polygon_geojson.get("features", []) if isinstance(new_polygon_geojson, dict) else []
                        current_polygon_geojson = {"type": "FeatureCollection", "features": existing_features + new_features}
                    else:
                        current_polygon_geojson = new_polygon_geojson
                
                if current_types is None:
                    current_types = ["polygon"]
                elif "polygon" not in current_types:
                    current_types = current_types + ["polygon"]
            
            total_feature_count = 0
            if current_point_geojson and isinstance(current_point_geojson, dict):
                total_feature_count += len(current_point_geojson.get("features", []))
            if current_polygon_geojson and isinstance(current_polygon_geojson, dict):
                total_feature_count += len(current_polygon_geojson.get("features", []))
            
            point_feature_count = 0
            if current_point_geojson and isinstance(current_point_geojson, dict):
                point_feature_count = len(current_point_geojson.get("features", []))
            
            polygon_feature_count = 0
            if current_polygon_geojson and isinstance(current_polygon_geojson, dict):
                polygon_feature_count = len(current_polygon_geojson.get("features", []))
            
            merged_geojson = None
            if current_point_geojson or current_polygon_geojson:
                merged_features = []
                if current_point_geojson and isinstance(current_point_geojson, dict):
                    merged_features.extend(current_point_geojson.get("features", []))
                if current_polygon_geojson and isinstance(current_polygon_geojson, dict):
                    merged_features.extend(current_polygon_geojson.get("features", []))
                merged_geojson = {"type": "FeatureCollection", "features": merged_features} if merged_features else None
            
            cur.execute(
                f"""
                UPDATE {target_table}
                SET
                    geometry_type = %(geometry_type)s,
                    geometry_status = %(geometry_status)s,
                    geometry_geojson = %(geometry_geojson)s::jsonb,
                    geometry_source_path = COALESCE(%(source_path)s, geometry_source_path),
                    geometry_source_name = COALESCE(%(source_name)s, geometry_source_name),
                    geometry_upload_kind = COALESCE(%(upload_kind)s, geometry_upload_kind),
                    geometry_feature_count = %(feature_count)s,
                    geometry_utm_zone = COALESCE(%(utm_zone)s, geometry_utm_zone),
                    geometry_utm_band = COALESCE(%(utm_band)s, geometry_utm_band),
                    geometry_utm_easting = COALESCE(%(utm_easting)s, geometry_utm_easting),
                    geometry_utm_northing = COALESCE(%(utm_northing)s, geometry_utm_northing),
                    geometry_point_geojson = %(point_geojson)s::jsonb,
                    geometry_polygon_geojson = %(polygon_geojson)s::jsonb,
                    geometry_point_feature_count = %(point_feature_count)s,
                    geometry_polygon_feature_count = %(polygon_feature_count)s,
                    geometry_updated_at = NOW()
                WHERE id = %(quest_id)s;
                """,
                {
                    "quest_id": quest_id,
                    "geometry_type": current_types,
                    "geometry_status": geometry.get("geometry_status", "ready"),
                    "geometry_geojson": json.dumps(merged_geojson) if merged_geojson else None,
                    "source_path": geometry.get("source_path") if is_polygon else None,
                    "source_name": geometry.get("source_name") if is_polygon else None,
                    "upload_kind": geometry.get("upload_kind") if is_polygon else None,
                    "feature_count": total_feature_count,
                    "utm_zone": geometry.get("utm_zone") if is_point else None,
                    "utm_band": geometry.get("utm_band") if is_point else None,
                    "utm_easting": geometry.get("utm_easting") if is_point else None,
                    "utm_northing": geometry.get("utm_northing") if is_point else None,
                    "point_geojson": json.dumps(current_point_geojson) if current_point_geojson else None,
                    "polygon_geojson": json.dumps(current_polygon_geojson) if current_polygon_geojson else None,
                    "point_feature_count": point_feature_count,
                    "polygon_feature_count": polygon_feature_count,
                },
            )

    return get_geometry_by_quest_id(quest_id)


def remove_quest_point_geometry(quest_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            target_table = _find_quest_table(cur, quest_id)
            if target_table is None:
                return None
            cur.execute(
                f"""
                SELECT geometry_type, geometry_point_geojson AS point_geojson, geometry_polygon_geojson AS polygon_geojson
                FROM {target_table}
                WHERE id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            existing = cur.fetchone()
            if existing is None:
                return None
            
            current_types = existing["geometry_type"] or []
            if "point" not in current_types:
                return get_geometry_by_quest_id(quest_id)
            
            current_types = [t for t in current_types if t != "point"]
            
            cur.execute(
                f"""
                UPDATE {target_table}
                SET
                    geometry_type = %(geometry_type)s,
                    geometry_geojson = jsonb_build_object(
                        'type', 'FeatureCollection',
                        'features', COALESCE(geometry_polygon_geojson->'features', '[]'::jsonb)
                    ),
                    geometry_point_geojson = NULL,
                    geometry_point_feature_count = 0,
                    geometry_feature_count = COALESCE(
                        jsonb_array_length(geometry_polygon_geojson->'features'), 0
                    ),
                    geometry_utm_zone = NULL,
                    geometry_utm_band = NULL,
                    geometry_utm_easting = NULL,
                    geometry_utm_northing = NULL,
                    geometry_updated_at = NOW()
                WHERE id = %(quest_id)s;
                """,
                {
                    "quest_id": quest_id,
                    "geometry_type": current_types if current_types else None,
                },
            )

    return get_geometry_by_quest_id(quest_id)


def remove_quest_polygon_geometry(quest_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            target_table = _find_quest_table(cur, quest_id)
            if target_table is None:
                return None
            cur.execute(
                f"""
                SELECT geometry_type, geometry_point_geojson AS point_geojson, geometry_polygon_geojson AS polygon_geojson
                FROM {target_table}
                WHERE id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            existing = cur.fetchone()
            if existing is None:
                return None
            
            current_types = existing["geometry_type"] or []
            if "polygon" not in current_types:
                return get_geometry_by_quest_id(quest_id)
            
            current_types = [t for t in current_types if t != "polygon"]
            
            cur.execute(
                f"""
                UPDATE {target_table}
                SET
                    geometry_type = %(geometry_type)s,
                    geometry_geojson = jsonb_build_object(
                        'type', 'FeatureCollection',
                        'features', COALESCE(geometry_point_geojson->'features', '[]'::jsonb)
                    ),
                    geometry_polygon_geojson = NULL,
                    geometry_polygon_feature_count = 0,
                    geometry_feature_count = COALESCE(
                        jsonb_array_length(geometry_point_geojson->'features'), 0
                    ),
                    geometry_source_path = NULL,
                    geometry_source_name = NULL,
                    geometry_upload_kind = NULL,
                    geometry_updated_at = NOW()
                WHERE id = %(quest_id)s;
                """,
                {
                    "quest_id": quest_id,
                    "geometry_type": current_types if current_types else None,
                },
            )

    return get_geometry_by_quest_id(quest_id)


def move_geometry_to_finished(quest_id: str, accuracy_xy: float, accuracy_z: float) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id
                FROM {FINISHED_QUESTS_TABLE}
                WHERE id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            in_finished = cur.fetchone() is not None

            if in_finished:
                cur.execute(
                    f"""
                    UPDATE {FINISHED_QUESTS_TABLE}
                    SET
                        accuracy_xy = %(accuracy_xy)s,
                        accuracy_z = %(accuracy_z)s,
                        geometry_updated_at = NOW()
                    WHERE id = %(quest_id)s;
                    """,
                    {"quest_id": quest_id, "accuracy_xy": accuracy_xy, "accuracy_z": accuracy_z},
                )
                return get_finished_geometry_by_quest_id(quest_id)

            cur.execute(
                f"""
                SELECT
                    geometry_type,
                    geometry_geojson,
                    geometry_point_geojson,
                    geometry_polygon_geojson
                FROM {OPEN_QUESTS_TABLE}
                WHERE id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            source_row = cur.fetchone()
            if source_row is None:
                return None

            has_geometry = bool(
                source_row.get("geometry_type")
                or source_row.get("geometry_geojson")
                or source_row.get("geometry_point_geojson")
                or source_row.get("geometry_polygon_geojson")
            )
            if not has_geometry:
                return None

            # Move quest row to finished table and store accuracy values there.
            from services.storage import move_quest

            moved = move_quest(
                quest_id,
                FINISHED_QUESTS_TABLE,
                {"status": "Finished"},
            )
            if moved is None:
                return None

            cur.execute(
                f"""
                UPDATE {FINISHED_QUESTS_TABLE}
                SET
                    accuracy_xy = %(accuracy_xy)s,
                    accuracy_z = %(accuracy_z)s,
                    geometry_updated_at = NOW()
                WHERE id = %(quest_id)s;
                """,
                {"quest_id": quest_id, "accuracy_xy": accuracy_xy, "accuracy_z": accuracy_z},
            )

    return get_finished_geometry_by_quest_id(quest_id)


def get_finished_geometry_by_quest_id(quest_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    q.id AS quest_id,
                    q.title,
                    q.description,
                    q.status,
                    q."תעדוף" AS priority,
                    q.date,
                    q.assigned_user,
                    q.group_name,
                    q.year,
                    q.ft,
                    q."מצייח" AS matziah,
                    q.geometry_type,
                    q.geometry_status,
                    q.geometry_source_path AS source_path,
                    q.geometry_source_name AS source_name,
                    q.geometry_upload_kind AS upload_kind,
                    COALESCE(q.geometry_feature_count, 0) AS feature_count,
                    q.geometry_geojson,
                    q.geometry_point_geojson AS point_geojson,
                    q.geometry_polygon_geojson AS polygon_geojson,
                    COALESCE(q.geometry_point_feature_count, 0) AS point_feature_count,
                    COALESCE(q.geometry_polygon_feature_count, 0) AS polygon_feature_count,
                    q.geometry_utm_zone AS utm_zone,
                    q.geometry_utm_band AS utm_band,
                    q.geometry_utm_easting AS utm_easting,
                    q.geometry_utm_northing AS utm_northing,
                    q.accuracy_xy,
                    q.accuracy_z,
                    q.geometry_updated_at AS updated_at
                FROM {FINISHED_QUESTS_TABLE} AS q
                WHERE q.id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            row = cur.fetchone()
            if row is None:
                return None
            return _normalize_geometry_row(row)


def get_finished_geometry_records(group: str | None = None) -> List[Dict]:
    where_clauses: List[str] = []
    params: Dict[str, Any] = {}

    if group:
        where_clauses.append("q.group_name = %(group)s")
        params["group"] = group

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    q.id AS quest_id,
                    q.title,
                    q.description,
                    q.status,
                    q."תעדוף" AS priority,
                    q.date,
                    q.assigned_user,
                    q.group_name,
                    q.year,
                    q.ft,
                    q."מצייח" AS matziah,
                    q.geometry_type,
                    q.geometry_status,
                    q.geometry_source_path AS source_path,
                    q.geometry_source_name AS source_name,
                    q.geometry_upload_kind AS upload_kind,
                    COALESCE(q.geometry_feature_count, 0) AS feature_count,
                    q.geometry_geojson,
                    q.geometry_point_geojson AS point_geojson,
                    q.geometry_polygon_geojson AS polygon_geojson,
                    COALESCE(q.geometry_point_feature_count, 0) AS point_feature_count,
                    COALESCE(q.geometry_polygon_feature_count, 0) AS polygon_feature_count,
                    q.geometry_utm_zone AS utm_zone,
                    q.geometry_utm_band AS utm_band,
                    q.geometry_utm_easting AS utm_easting,
                    q.geometry_utm_northing AS utm_northing,
                    q.accuracy_xy,
                    q.accuracy_z,
                    q.geometry_updated_at AS updated_at
                FROM {FINISHED_QUESTS_TABLE} AS q
                {where_sql}
                ORDER BY q.ft ASC, q.title ASC;
                """,
                params,
            )
            return [_normalize_geometry_row(row) for row in cur.fetchall()]
