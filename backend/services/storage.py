import json
from datetime import datetime
from typing import Dict, List, Optional

from services.db import get_connection

OPEN_QUESTS_TABLE = "open_quests"
FINISHED_QUESTS_TABLE = "finished_quests"


def _normalize_user(row: Dict) -> Dict:
    return {
        "id": str(row["id"]),
        "username": row["username"],
        "password": row["password"],
        "role": row["role"],
        "group": row["group_name"],
        "display_name": row["display_name"],
    }


def _normalize_quest(row: Dict) -> Dict:
    return {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row["description"],
        "status": row["status"],
        "priority": row["priority"],
        "date": row["date"],
        "assigned_user": row["assigned_user"],
        "shapefile_path": row["shapefile_path"],
        "group": row["group_name"],
        "year": row["year"],
        "ft": row["ft"],
        "quest_type": row["ft"],
        "matziah": row["matziah"],
        "sync_external_id": row["sync_external_id"],
        "sync_source": row["sync_source"],
        "sync_name": row["sync_name"],
        "geometry_type": row["geometry_type"],
        "geometry_status": row["geometry_status"],
        "geometry_source_path": row["geometry_source_path"],
        "geometry_source_name": row["geometry_source_name"],
        "geometry_feature_count": row["geometry_feature_count"] or 0,
        "geometry_updated_at": _normalize_timestamp(row["geometry_updated_at"]),
    }


def _normalize_timestamp(value) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def _quest_columns(table_alias: str = "q") -> str:
    prefix = f"{table_alias}." if table_alias else ""
    return f"""
        {prefix}id,
        {prefix}title,
        {prefix}description,
        {prefix}status,
        {prefix}"תעדוף" AS priority,
        {prefix}date,
        {prefix}assigned_user,
        {prefix}shapefile_path,
        {prefix}group_name,
        {prefix}year,
        {prefix}ft,
        {prefix}"מצייח" AS matziah,
        {prefix}sync_external_id,
        {prefix}sync_source,
        {prefix}sync_name,
        g.geometry_type,
        COALESCE(
            g.geometry_status,
            CASE WHEN {prefix}shapefile_path IS NOT NULL THEN 'pending' ELSE 'missing' END
        ) AS geometry_status,
        COALESCE(g.source_path, {prefix}shapefile_path) AS geometry_source_path,
        g.source_name AS geometry_source_name,
        COALESCE(g.feature_count, 0) AS geometry_feature_count,
        g.updated_at AS geometry_updated_at
    """


def _quest_table_query(table_name: str, table_alias: str = "q") -> str:
    return f"""
        SELECT
            {_quest_columns(table_alias)}
        FROM {table_name} AS {table_alias}
        LEFT JOIN quest_geometries AS g ON g.quest_id = {table_alias}.id
    """


def _normalize_external_quest(row: Dict) -> Dict:
    payload = dict(row["payload"] or {})
    payload["external_id"] = str(row["external_id"])
    payload["matziah"] = str(row["matziah"])
    payload["local_status"] = str(row["local_status"]) if row["local_status"] else None
    payload["transferred_quest_id"] = str(row["transferred_quest_id"]) if row["transferred_quest_id"] else None
    return payload


def get_users() -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, password, role, group_name, display_name
                FROM users
                ORDER BY username;
                """
            )
            return [_normalize_user(row) for row in cur.fetchall()]


def save_user(user: Dict):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (id, username, password, role, group_name, display_name)
                VALUES (%(id)s, %(username)s, %(password)s, %(role)s, %(group_name)s, %(display_name)s);
                """,
                {
                    "id": user["id"],
                    "username": user["username"],
                    "password": user["password"],
                    "role": user["role"],
                    "group_name": user["group"],
                    "display_name": user["display_name"],
                },
            )


def update_user(user_id: str, updates: Dict) -> Optional[Dict]:
    if not updates:
        return None

    allowed_fields = {
        "password": "password",
        "role": "role",
        "group": "group_name",
        "display_name": "display_name",
    }
    assignments = []
    params = {"user_id": user_id}

    for key, value in updates.items():
        column = allowed_fields.get(key)
        if not column:
            continue
        assignments.append(f"{column} = %({key})s")
        params[key] = value

    if not assignments:
        return None

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE users
                SET {", ".join(assignments)}
                WHERE id = %(user_id)s
                RETURNING id, username, password, role, group_name, display_name;
                """,
                params,
            )
            row = cur.fetchone()
            if row is None:
                return None
            return _normalize_user(row)


def delete_user(user_id: str) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM users
                WHERE id = %(user_id)s
                RETURNING id;
                """,
                {"user_id": user_id},
            )
            return cur.fetchone() is not None


def get_quests() -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                {_quest_table_query(OPEN_QUESTS_TABLE)}
                ORDER BY q.date DESC, q.title ASC;
                """
            )
            return [_normalize_quest(row) for row in cur.fetchall()]


def get_finished_quests() -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                {_quest_table_query(FINISHED_QUESTS_TABLE)}
                ORDER BY q.date DESC, q.title ASC;
                """
            )
            return [_normalize_quest(row) for row in cur.fetchall()]


def get_quest_by_id(quest_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                {_quest_table_query(OPEN_QUESTS_TABLE)}
                WHERE q.id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    f"""
                    {_quest_table_query(FINISHED_QUESTS_TABLE)}
                    WHERE q.id = %(quest_id)s;
                    """,
                    {"quest_id": quest_id},
                )
                row = cur.fetchone()
                if row is None:
                    return None
            return _normalize_quest(row)


def get_quest_by_sync_external_id(external_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                {_quest_table_query(OPEN_QUESTS_TABLE)}
                WHERE q.sync_external_id = %(external_id)s;
                """,
                {"external_id": external_id},
            )
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    f"""
                    {_quest_table_query(FINISHED_QUESTS_TABLE)}
                    WHERE q.sync_external_id = %(external_id)s;
                    """,
                    {"external_id": external_id},
                )
                row = cur.fetchone()
                if row is None:
                    return None
            return _normalize_quest(row)


def save_quest(quest: Dict):
    target_table = FINISHED_QUESTS_TABLE if quest.get("status") in {"Done", "Approved"} else OPEN_QUESTS_TABLE
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO {target_table} (
                    id, title, description, status, "תעדוף", date, assigned_user,
                    shapefile_path, group_name, year, ft, "מצייח",
                    sync_external_id, sync_source, sync_name
                )
                VALUES (
                    %(id)s, %(title)s, %(description)s, %(status)s, %(priority)s, %(date)s, %(assigned_user)s,
                    %(shapefile_path)s, %(group_name)s, %(year)s, %(ft)s, %(matziah)s,
                    %(sync_external_id)s, %(sync_source)s, %(sync_name)s
                );
                """,
                {
                    "id": quest["id"],
                    "title": quest["title"],
                    "description": quest["description"],
                    "status": quest["status"],
                    "priority": quest.get("priority", "רגיל"),
                    "date": quest["date"],
                    "assigned_user": quest["assigned_user"],
                    "shapefile_path": quest["shapefile_path"],
                    "group_name": quest["group"],
                    "year": quest["year"],
                    "ft": quest["ft"],
                    "matziah": quest.get("matziah", "H"),
                    "sync_external_id": quest.get("sync_external_id"),
                    "sync_source": quest.get("sync_source"),
                    "sync_name": quest.get("sync_name"),
                },
            )
            cur.execute(
                """
                INSERT INTO quest_geometries (
                    quest_id,
                    geometry_status,
                    source_path,
                    feature_count,
                    created_at,
                    updated_at
                )
                VALUES (
                    %(quest_id)s,
                    %(geometry_status)s,
                    %(source_path)s,
                    0,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (quest_id) DO NOTHING;
                """,
                {
                    "quest_id": quest["id"],
                    "geometry_status": "pending" if quest.get("shapefile_path") else "missing",
                    "source_path": quest.get("shapefile_path"),
                },
            )


def update_quest(quest_id: str, updates: Dict) -> Optional[Dict]:
    if not updates:
        return None

    allowed_fields = {
        "title": "title",
        "description": "description",
        "status": "status",
        "priority": '"תעדוף"',
        "date": "date",
        "assigned_user": "assigned_user",
        "shapefile_path": "shapefile_path",
        "group": "group_name",
        "year": "year",
        "ft": "ft",
        "matziah": '"מצייח"',
        "sync_external_id": "sync_external_id",
        "sync_source": "sync_source",
        "sync_name": "sync_name",
    }
    assignments = []
    params = {"quest_id": quest_id}

    for key, value in updates.items():
        column = allowed_fields.get(key)
        if not column:
            continue
        assignments.append(f"{column} = %({key})s")
        params[key] = value

    if not assignments:
        return None

    with get_connection() as conn:
        with conn.cursor() as cur:
            for table_name in (OPEN_QUESTS_TABLE, FINISHED_QUESTS_TABLE):
                cur.execute(
                    f"""
                    UPDATE {table_name}
                    SET {", ".join(assignments)}
                    WHERE id = %(quest_id)s
                    RETURNING id;
                    """,
                    params,
                )
                row = cur.fetchone()
                if row is not None:
                    if "shapefile_path" in updates:
                        cur.execute(
                            """
                            INSERT INTO quest_geometries (
                                quest_id,
                                geometry_status,
                                source_path,
                                feature_count,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                %(quest_id)s,
                                %(geometry_status)s,
                                %(source_path)s,
                                0,
                                NOW(),
                                NOW()
                            )
                            ON CONFLICT (quest_id)
                            DO UPDATE SET
                                source_path = COALESCE(quest_geometries.source_path, EXCLUDED.source_path),
                                geometry_status = CASE
                                    WHEN quest_geometries.geometry_type IS NULL
                                         AND quest_geometries.geometry_geojson IS NULL
                                         AND EXCLUDED.source_path IS NOT NULL
                                    THEN 'pending'
                                    ELSE quest_geometries.geometry_status
                                END,
                                updated_at = NOW();
                            """,
                            {
                                "quest_id": quest_id,
                                "geometry_status": "pending" if updates.get("shapefile_path") else "missing",
                                "source_path": updates.get("shapefile_path"),
                            },
                        )
                    return get_quest_by_id(quest_id)
            return None


def move_quest(quest_id: str, destination_table: str, updates: Optional[Dict] = None) -> Optional[Dict]:
    updates = updates or {}
    source_table = FINISHED_QUESTS_TABLE if destination_table == OPEN_QUESTS_TABLE else OPEN_QUESTS_TABLE

    allowed_fields = {
        "title": "title",
        "description": "description",
        "status": "status",
        "priority": "priority",
        "date": "date",
        "assigned_user": "assigned_user",
        "shapefile_path": "shapefile_path",
        "group": "group_name",
        "year": "year",
        "ft": "ft",
        "matziah": "matziah",
        "sync_external_id": "sync_external_id",
        "sync_source": "sync_source",
        "sync_name": "sync_name",
    }

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                DELETE FROM {source_table}
                WHERE id = %(quest_id)s
                RETURNING
                    id,
                    title,
                    description,
                    status,
                    "תעדוף" AS priority,
                    date,
                    assigned_user,
                    shapefile_path,
                    group_name,
                    year,
                    ft,
                    "מצייח" AS matziah,
                    sync_external_id,
                    sync_source,
                    sync_name;
                """,
                {"quest_id": quest_id},
            )
            row = cur.fetchone()
            if row is None:
                return None

            quest = {
                "id": str(row["id"]),
                "title": row["title"],
                "description": row["description"],
                "status": row["status"],
                "priority": row["priority"],
                "date": row["date"],
                "assigned_user": row["assigned_user"],
                "shapefile_path": row["shapefile_path"],
                "group": row["group_name"],
                "year": row["year"],
                "ft": row["ft"],
                "matziah": row["matziah"],
                "sync_external_id": row["sync_external_id"],
                "sync_source": row["sync_source"],
                "sync_name": row["sync_name"],
            }
            for key, value in updates.items():
                if key in allowed_fields:
                    quest[key] = value

            cur.execute(
                f"""
                INSERT INTO {destination_table} (
                    id, title, description, status, "תעדוף", date, assigned_user,
                    shapefile_path, group_name, year, ft, "מצייח",
                    sync_external_id, sync_source, sync_name
                )
                VALUES (
                    %(id)s, %(title)s, %(description)s, %(status)s, %(priority)s, %(date)s, %(assigned_user)s,
                    %(shapefile_path)s, %(group)s, %(year)s, %(ft)s, %(matziah)s,
                    %(sync_external_id)s, %(sync_source)s, %(sync_name)s
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    status = EXCLUDED.status,
                    "תעדוף" = EXCLUDED."תעדוף",
                    date = EXCLUDED.date,
                    assigned_user = EXCLUDED.assigned_user,
                    shapefile_path = EXCLUDED.shapefile_path,
                    group_name = EXCLUDED.group_name,
                    year = EXCLUDED.year,
                    ft = EXCLUDED.ft,
                    "מצייח" = EXCLUDED."מצייח",
                    sync_external_id = EXCLUDED.sync_external_id,
                    sync_source = EXCLUDED.sync_source,
                    sync_name = EXCLUDED.sync_name;
                """,
                quest,
            )
            return get_quest_by_id(quest_id)


def get_external_quests() -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT external_id, payload, matziah, local_status, transferred_quest_id
                FROM external_quests
                ORDER BY updated_at DESC, created_at DESC;
                """
            )
            return [_normalize_external_quest(row) for row in cur.fetchall()]


def get_external_quest(external_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT external_id, payload, matziah, local_status, transferred_quest_id
                FROM external_quests
                WHERE external_id = %(external_id)s;
                """,
                {"external_id": external_id},
            )
            row = cur.fetchone()
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
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO external_quests (
                    external_id, payload, matziah, local_status, transferred_quest_id, created_at, updated_at
                )
                VALUES (
                    %(external_id)s, %(payload)s::jsonb, %(matziah)s, %(local_status)s, %(transferred_quest_id)s, NOW(), NOW()
                )
                ON CONFLICT (external_id)
                DO UPDATE SET
                    payload = EXCLUDED.payload,
                    matziah = EXCLUDED.matziah,
                    local_status = COALESCE(EXCLUDED.local_status, external_quests.local_status),
                    transferred_quest_id = COALESCE(EXCLUDED.transferred_quest_id, external_quests.transferred_quest_id),
                    updated_at = NOW()
                RETURNING external_id, payload, matziah, local_status, transferred_quest_id;
                """,
                {
                    "external_id": external_id,
                    "payload": json.dumps(payload, ensure_ascii=False),
                    "matziah": matziah,
                    "local_status": local_status,
                    "transferred_quest_id": transferred_quest_id,
                },
            )
            row = cur.fetchone()
            return _normalize_external_quest(row)


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
