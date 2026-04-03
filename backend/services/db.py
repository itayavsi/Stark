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
OPEN_QUESTS_TABLE = "open_quests"
FINISHED_QUESTS_TABLE = "finished_quests"

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
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'quests'
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'open_quests'
                    ) THEN
                        ALTER TABLE quests RENAME TO open_quests;
                    END IF;
                END
                $$;
                """
            )
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
                f"""
                CREATE TABLE IF NOT EXISTS {OPEN_QUESTS_TABLE} (
                    id UUID PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    notes TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL,
                    "תעדוף" TEXT NOT NULL DEFAULT 'רגיל',
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
                f"""
                CREATE TABLE IF NOT EXISTS {FINISHED_QUESTS_TABLE} (
                    id UUID PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    notes TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL,
                    "תעדוף" TEXT NOT NULL DEFAULT 'רגיל',
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
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS "תעדוף" TEXT NOT NULL DEFAULT 'רגיל';
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS "תעדוף" TEXT NOT NULL DEFAULT 'רגיל';
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS "מצייח" TEXT NOT NULL DEFAULT 'H';
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS "מצייח" TEXT NOT NULL DEFAULT 'H';
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS sync_external_id TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS sync_external_id TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS sync_source TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS sync_source TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS sync_name TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS sync_name TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
                """
            )
            cur.execute(
                f"""
                CREATE UNIQUE INDEX IF NOT EXISTS open_quests_sync_external_id_unique
                ON {OPEN_QUESTS_TABLE} (sync_external_id)
                WHERE sync_external_id IS NOT NULL;
                """
            )
            cur.execute(
                f"""
                CREATE UNIQUE INDEX IF NOT EXISTS finished_quests_sync_external_id_unique
                ON {FINISHED_QUESTS_TABLE} (sync_external_id)
                WHERE sync_external_id IS NOT NULL;
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS quest_geometries (
                    quest_id UUID PRIMARY KEY,
                    geometry_type TEXT NULL CHECK (geometry_type IN ('point', 'polygon')),
                    geometry_status TEXT NOT NULL DEFAULT 'missing'
                        CHECK (geometry_status IN ('missing', 'pending', 'ready', 'error')),
                    geometry_geojson JSONB NULL,
                    source_path TEXT NULL,
                    source_name TEXT NULL,
                    upload_kind TEXT NULL,
                    feature_count INTEGER NOT NULL DEFAULT 0,
                    utm_zone INTEGER NULL,
                    utm_band TEXT NULL,
                    utm_easting DOUBLE PRECISION NULL,
                    utm_northing DOUBLE PRECISION NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS quest_geometries_geometry_type_idx
                ON quest_geometries (geometry_type);
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS quest_geometries_geometry_status_idx
                ON quest_geometries (geometry_status);
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS finished_quest_geometries (
                    quest_id UUID PRIMARY KEY,
                    geometry_type TEXT NULL CHECK (geometry_type IN ('point', 'polygon')),
                    geometry_status TEXT NOT NULL DEFAULT 'ready'
                        CHECK (geometry_status IN ('ready')),
                    geometry_geojson JSONB NULL,
                    source_path TEXT NULL,
                    source_name TEXT NULL,
                    upload_kind TEXT NULL,
                    feature_count INTEGER NOT NULL DEFAULT 0,
                    utm_zone INTEGER NULL,
                    utm_band TEXT NULL,
                    utm_easting DOUBLE PRECISION NULL,
                    utm_northing DOUBLE PRECISION NULL,
                    accuracy_xy DOUBLE PRECISION NOT NULL,
                    accuracy_z DOUBLE PRECISION NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS finished_quest_geometries_geometry_type_idx
                ON finished_quest_geometries (geometry_type);
                """
            )
            cur.execute(
                f"""
                INSERT INTO {FINISHED_QUESTS_TABLE} (
                    id, title, description, status, "תעדוף", date, assigned_user,
                    shapefile_path, group_name, year, ft, "מצייח",
                    sync_external_id, sync_source, sync_name
                )
                SELECT
                    id, title, description, status, "תעדוף", date, assigned_user,
                    shapefile_path, group_name, year, ft, "מצייח",
                    sync_external_id, sync_source, sync_name
                FROM {OPEN_QUESTS_TABLE}
                WHERE status IN ('Done', 'Approved')
                ON CONFLICT (id) DO NOTHING;
                """
            )
            cur.execute(
                f"""
                DELETE FROM {OPEN_QUESTS_TABLE}
                WHERE status IN ('Done', 'Approved');
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS external_quests (
                    external_id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    matziah TEXT NOT NULL DEFAULT 'N',
                    local_status TEXT NULL,
                    transferred_quest_id UUID NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'external_quest_entries'
                    ) THEN
                        INSERT INTO external_quests (
                            external_id, payload, matziah, local_status, transferred_quest_id, created_at, updated_at
                        )
                        SELECT
                            entries.external_id,
                            entries.payload,
                            COALESCE(metadata.matziah, 'N') AS matziah,
                            overrides.local_status,
                            metadata.transferred_quest_id,
                            COALESCE(entries.created_at, NOW()),
                            NOW()
                        FROM external_quest_entries AS entries
                        LEFT JOIN external_quest_metadata AS metadata ON metadata.external_id = entries.external_id
                        LEFT JOIN external_quest_overrides AS overrides ON overrides.external_id = entries.external_id
                        ON CONFLICT (external_id)
                        DO UPDATE SET
                            payload = EXCLUDED.payload,
                            matziah = EXCLUDED.matziah,
                            local_status = COALESCE(EXCLUDED.local_status, external_quests.local_status),
                            transferred_quest_id = COALESCE(EXCLUDED.transferred_quest_id, external_quests.transferred_quest_id),
                            updated_at = NOW();
                    END IF;
                END
                $$;
                """
            )
            cur.execute("DROP TABLE IF EXISTS quest_sort_orders;")
            cur.execute("DROP TABLE IF EXISTS external_quest_overrides;")
            cur.execute("DROP TABLE IF EXISTS external_quest_metadata;")
            cur.execute("DROP TABLE IF EXISTS external_quest_entries;")

            cur.execute("SELECT COUNT(*) AS count FROM users;")
            users_count = cur.fetchone()["count"]
            cur.execute(f"SELECT COUNT(*) AS count FROM {OPEN_QUESTS_TABLE};")
            quests_count = cur.fetchone()["count"]
            cur.execute(f"SELECT COUNT(*) AS count FROM {FINISHED_QUESTS_TABLE};")
            finished_quests_count = cur.fetchone()["count"]

            if users_count == 0 and quests_count == 0 and finished_quests_count == 0:
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
                    open_seed_quests = []
                    finished_seed_quests = []
                    for quest in seed_data["quests"]:
                        normalized_quest = {
                            "id": _coerce_uuid(quest["id"]),
                            "title": quest.get("title", ""),
                            "description": quest.get("description", ""),
                            "status": quest.get("status", "Open"),
                            "priority": quest.get("priority", "רגיל"),
                            "date": _normalize_seed_date(quest.get("date")),
                            "assigned_user": quest.get("assigned_user"),
                            "shapefile_path": quest.get("shapefile_path"),
                            "group_name": quest.get("group", "לווינות"),
                            "year": quest.get("year", 2026),
                            "ft": quest.get("ft", "FT1"),
                        }
                        if normalized_quest["status"] in {"Done", "Approved"}:
                            finished_seed_quests.append(normalized_quest)
                        else:
                            open_seed_quests.append(normalized_quest)

                    if open_seed_quests:
                        cur.executemany(
                            f"""
                            INSERT INTO {OPEN_QUESTS_TABLE} (
                                id, title, description, status, "תעדוף", date, assigned_user,
                                shapefile_path, group_name, year, ft
                            )
                            VALUES (
                                %(id)s, %(title)s, %(description)s, %(status)s, %(priority)s, %(date)s, %(assigned_user)s,
                                %(shapefile_path)s, %(group_name)s, %(year)s, %(ft)s
                            )
                            ON CONFLICT (id) DO NOTHING;
                            """,
                            open_seed_quests,
                        )

                    if finished_seed_quests:
                        cur.executemany(
                            f"""
                            INSERT INTO {FINISHED_QUESTS_TABLE} (
                                id, title, description, status, "תעדוף", date, assigned_user,
                                shapefile_path, group_name, year, ft
                            )
                            VALUES (
                                %(id)s, %(title)s, %(description)s, %(status)s, %(priority)s, %(date)s, %(assigned_user)s,
                                %(shapefile_path)s, %(group_name)s, %(year)s, %(ft)s
                            )
                            ON CONFLICT (id) DO NOTHING;
                            """,
                            finished_seed_quests,
                        )

            cur.execute(
                f"""
                INSERT INTO quest_geometries (
                    quest_id,
                    geometry_status,
                    source_path,
                    feature_count,
                    created_at,
                    updated_at
                )
                SELECT
                    all_quests.id,
                    CASE
                        WHEN all_quests.shapefile_path IS NOT NULL THEN 'pending'
                        ELSE 'missing'
                    END AS geometry_status,
                    all_quests.shapefile_path,
                    0,
                    NOW(),
                    NOW()
                FROM (
                    SELECT id, shapefile_path FROM {OPEN_QUESTS_TABLE}
                    UNION
                    SELECT id, shapefile_path FROM {FINISHED_QUESTS_TABLE}
                ) AS all_quests
                ON CONFLICT (quest_id)
                DO UPDATE SET
                    source_path = COALESCE(quest_geometries.source_path, EXCLUDED.source_path),
                    geometry_status = CASE
                        WHEN quest_geometries.geometry_status = 'missing'
                             AND quest_geometries.geometry_type IS NULL
                             AND quest_geometries.geometry_geojson IS NULL
                             AND EXCLUDED.source_path IS NOT NULL
                        THEN 'pending'
                        ELSE quest_geometries.geometry_status
                    END;
                """
            )
