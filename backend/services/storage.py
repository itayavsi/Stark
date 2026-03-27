import json
from typing import Dict, List, Optional

from services.db import get_connection


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
    }


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
                """
                SELECT
                    id, title, description, status, "תעדוף" AS priority, date, assigned_user,
                    shapefile_path, group_name, year, ft
                FROM quests
                ORDER BY date DESC, title ASC;
                """
            )
            return [_normalize_quest(row) for row in cur.fetchall()]


def get_quest_by_id(quest_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id, title, description, status, "תעדוף" AS priority, date, assigned_user,
                    shapefile_path, group_name, year, ft
                FROM quests
                WHERE id = %(quest_id)s;
                """,
                {"quest_id": quest_id},
            )
            row = cur.fetchone()
            if row is None:
                return None
            return _normalize_quest(row)


def save_quest(quest: Dict):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quests (
                    id, title, description, status, "תעדוף", date, assigned_user,
                    shapefile_path, group_name, year, ft
                )
                VALUES (
                    %(id)s, %(title)s, %(description)s, %(status)s, %(priority)s, %(date)s, %(assigned_user)s,
                    %(shapefile_path)s, %(group_name)s, %(year)s, %(ft)s
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
            cur.execute(
                f"""
                UPDATE quests
                SET {", ".join(assignments)}
                WHERE id = %(quest_id)s
                RETURNING
                    id, title, description, status, "תעדוף" AS priority, date, assigned_user,
                    shapefile_path, group_name, year, ft;
                """,
                params,
            )
            row = cur.fetchone()
            if row is None:
                return None
            return _normalize_quest(row)


def get_quest_sort_order(group: str, view: str) -> List[str]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT order_data
                FROM quest_sort_orders
                WHERE group_name = %(group_name)s AND view_name = %(view_name)s;
                """,
                {"group_name": group, "view_name": view},
            )
            row = cur.fetchone()
            if row is None:
                return []
            return [str(quest_id) for quest_id in row["order_data"]]


def save_quest_sort_order(group: str, view: str, quest_ids: List[str]) -> List[str]:
    normalized_ids = [str(quest_id) for quest_id in quest_ids]
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quest_sort_orders (group_name, view_name, order_data, updated_at)
                VALUES (%(group_name)s, %(view_name)s, %(order_data)s::jsonb, NOW())
                ON CONFLICT (group_name, view_name)
                DO UPDATE SET order_data = EXCLUDED.order_data, updated_at = NOW()
                RETURNING order_data;
                """,
                {
                    "group_name": group,
                    "view_name": view,
                    "order_data": json.dumps(normalized_ids),
                },
            )
            row = cur.fetchone()
            return [str(quest_id) for quest_id in row["order_data"]]


def get_external_status_overrides(external_ids: List[str]) -> Dict[str, str]:
    if not external_ids:
        return {}

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT external_id, local_status
                FROM external_quest_overrides
                WHERE external_id = ANY(%(external_ids)s);
                """,
                {"external_ids": external_ids},
            )
            return {str(row["external_id"]): str(row["local_status"]) for row in cur.fetchall()}


def save_external_status_override(external_id: str, local_status: str) -> str:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO external_quest_overrides (external_id, local_status, updated_at)
                VALUES (%(external_id)s, %(local_status)s, NOW())
                ON CONFLICT (external_id)
                DO UPDATE SET local_status = EXCLUDED.local_status, updated_at = NOW()
                RETURNING local_status;
                """,
                {"external_id": external_id, "local_status": local_status},
            )
            row = cur.fetchone()
            return str(row["local_status"])
