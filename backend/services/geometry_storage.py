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
            shapefile_path
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
            shapefile_path
        FROM {FINISHED_QUESTS_TABLE}
    """


def _normalize_timestamp(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def _normalize_geometry_row(row: Dict) -> Dict:
    feature_collection = row["geometry_geojson"]
    if isinstance(feature_collection, str):
        feature_collection = json.loads(feature_collection)

    return {
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
        "geometry_type": row["geometry_type"],
        "geometry_status": row["geometry_status"],
        "source_path": row["source_path"],
        "source_name": row["source_name"],
        "upload_kind": row["upload_kind"],
        "feature_count": row["feature_count"] or 0,
        "feature_collection": feature_collection,
        "utm_zone": row["utm_zone"],
        "utm_band": row["utm_band"],
        "utm_easting": row["utm_easting"],
        "utm_northing": row["utm_northing"],
        "updated_at": _normalize_timestamp(row["updated_at"]),
    }


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
                    g.geometry_type,
                    COALESCE(
                        g.geometry_status,
                        CASE WHEN q.shapefile_path IS NOT NULL THEN 'pending' ELSE 'missing' END
                    ) AS geometry_status,
                    COALESCE(g.source_path, q.shapefile_path) AS source_path,
                    g.source_name,
                    g.upload_kind,
                    COALESCE(g.feature_count, 0) AS feature_count,
                    g.geometry_geojson,
                    g.utm_zone,
                    g.utm_band,
                    g.utm_easting,
                    g.utm_northing,
                    g.updated_at
                FROM ({_all_quests_union()}) AS q
                LEFT JOIN quest_geometries AS g ON g.quest_id = q.id
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
        "g.geometry_type IS NOT NULL",
        "g.geometry_geojson IS NOT NULL",
        "g.geometry_status = 'ready'",
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
                    g.geometry_type,
                    g.geometry_status,
                    COALESCE(g.source_path, q.shapefile_path) AS source_path,
                    g.source_name,
                    g.upload_kind,
                    COALESCE(g.feature_count, 0) AS feature_count,
                    g.geometry_geojson,
                    g.utm_zone,
                    g.utm_band,
                    g.utm_easting,
                    g.utm_northing,
                    g.updated_at
                FROM ({_all_quests_union()}) AS q
                JOIN quest_geometries AS g ON g.quest_id = q.id
                {where_sql}
                ORDER BY q.ft ASC, q.title ASC;
                """,
                params,
            )
            return [_normalize_geometry_row(row) for row in cur.fetchall()]


def upsert_quest_geometry(quest_id: str, geometry: Dict) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quest_geometries (
                    quest_id,
                    geometry_type,
                    geometry_status,
                    geometry_geojson,
                    source_path,
                    source_name,
                    upload_kind,
                    feature_count,
                    utm_zone,
                    utm_band,
                    utm_easting,
                    utm_northing,
                    created_at,
                    updated_at
                )
                VALUES (
                    %(quest_id)s,
                    %(geometry_type)s,
                    %(geometry_status)s,
                    %(geometry_geojson)s::jsonb,
                    %(source_path)s,
                    %(source_name)s,
                    %(upload_kind)s,
                    %(feature_count)s,
                    %(utm_zone)s,
                    %(utm_band)s,
                    %(utm_easting)s,
                    %(utm_northing)s,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (quest_id)
                DO UPDATE SET
                    geometry_type = EXCLUDED.geometry_type,
                    geometry_status = EXCLUDED.geometry_status,
                    geometry_geojson = EXCLUDED.geometry_geojson,
                    source_path = EXCLUDED.source_path,
                    source_name = EXCLUDED.source_name,
                    upload_kind = EXCLUDED.upload_kind,
                    feature_count = EXCLUDED.feature_count,
                    utm_zone = EXCLUDED.utm_zone,
                    utm_band = EXCLUDED.utm_band,
                    utm_easting = EXCLUDED.utm_easting,
                    utm_northing = EXCLUDED.utm_northing,
                    updated_at = NOW();
                """,
                {
                    "quest_id": quest_id,
                    "geometry_type": geometry.get("geometry_type"),
                    "geometry_status": geometry.get("geometry_status", "missing"),
                    "geometry_geojson": json.dumps(geometry.get("geometry_geojson"))
                    if geometry.get("geometry_geojson") is not None
                    else None,
                    "source_path": geometry.get("source_path"),
                    "source_name": geometry.get("source_name"),
                    "upload_kind": geometry.get("upload_kind"),
                    "feature_count": geometry.get("feature_count", 0),
                    "utm_zone": geometry.get("utm_zone"),
                    "utm_band": geometry.get("utm_band"),
                    "utm_easting": geometry.get("utm_easting"),
                    "utm_northing": geometry.get("utm_northing"),
                },
            )

    return get_geometry_by_quest_id(quest_id)
