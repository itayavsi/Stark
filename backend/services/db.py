import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from psycopg import connect
from psycopg.rows import dict_row

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "storage" / "data.json"

load_dotenv(BASE_DIR / ".env")
SEED_NAMESPACE = uuid.UUID("11111111-2222-3333-4444-555555555555")


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not configured. Add your Neon connection string to backend/.env or export DATABASE_URL."
        )
    return database_url


def get_connection():
    return connect(get_database_url(), row_factory=dict_row)


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


def init_db() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    role TEXT NOT NULL,
                    group_name TEXT NOT NULL,
                    display_name TEXT NOT NULL
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS quests (
                    id UUID PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL,
                    date TEXT NOT NULL,
                    assigned_user TEXT NULL,
                    shapefile_path TEXT NULL,
                    group_name TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    ft TEXT NOT NULL
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS quest_sort_orders (
                    group_name TEXT NOT NULL,
                    view_name TEXT NOT NULL,
                    order_data JSONB NOT NULL DEFAULT '[]'::jsonb,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (group_name, view_name)
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS external_quest_overrides (
                    external_id TEXT PRIMARY KEY,
                    local_status TEXT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            cur.execute("SELECT COUNT(*) AS count FROM users;")
            users_count = cur.fetchone()["count"]
            cur.execute("SELECT COUNT(*) AS count FROM quests;")
            quests_count = cur.fetchone()["count"]

            if users_count == 0 and quests_count == 0:
                seed_data = _load_seed_data()
                if seed_data.get("users"):
                    cur.executemany(
                        """
                        INSERT INTO users (id, username, password, role, group_name, display_name)
                        VALUES (%(id)s, %(username)s, %(password)s, %(role)s, %(group_name)s, %(display_name)s)
                        ON CONFLICT (username) DO NOTHING;
                        """,
                        [
                            {
                                "id": _coerce_uuid(user["id"]),
                                "username": user["username"],
                                "password": user["password"],
                                "role": user.get("role", "Viewer"),
                                "group_name": user.get("group", "לווינות"),
                                "display_name": user.get("display_name", user["username"]),
                            }
                            for user in seed_data["users"]
                        ],
                    )

                if seed_data.get("quests"):
                    cur.executemany(
                        """
                        INSERT INTO quests (
                            id, title, description, status, date, assigned_user,
                            shapefile_path, group_name, year, ft
                        )
                        VALUES (
                            %(id)s, %(title)s, %(description)s, %(status)s, %(date)s, %(assigned_user)s,
                            %(shapefile_path)s, %(group_name)s, %(year)s, %(ft)s
                        )
                        ON CONFLICT (id) DO NOTHING;
                        """,
                        [
                            {
                                "id": _coerce_uuid(quest["id"]),
                                "title": quest.get("title", ""),
                                "description": quest.get("description", ""),
                                "status": quest.get("status", "Open"),
                                "date": _normalize_seed_date(quest.get("date")),
                                "assigned_user": quest.get("assigned_user"),
                                "shapefile_path": quest.get("shapefile_path"),
                                "group_name": quest.get("group", "לווינות"),
                                "year": quest.get("year", 2026),
                                "ft": quest.get("ft", "FT1"),
                            }
                            for quest in seed_data["quests"]
                        ],
                    )
