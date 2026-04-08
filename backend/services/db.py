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
                    model_simulations TEXT NULL,
                    model_folder TEXT NULL,
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
                    model_simulations TEXT NULL,
                    model_folder TEXT NULL,
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
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS model_simulations TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS model_simulations TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS model_folder TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS model_folder TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_type TEXT[] NULL
                    CHECK (geometry_type IS NULL OR geometry_type <@ ARRAY['point', 'polygon']);
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_type TEXT[] NULL
                    CHECK (geometry_type IS NULL OR geometry_type <@ ARRAY['point', 'polygon']);
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_status TEXT NOT NULL DEFAULT 'missing'
                    CHECK (geometry_status IN ('missing', 'pending', 'ready', 'error'));
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_status TEXT NOT NULL DEFAULT 'ready'
                    CHECK (geometry_status IN ('missing', 'pending', 'ready', 'error'));
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_geojson JSONB NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_geojson JSONB NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_source_path TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_source_path TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_source_name TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_source_name TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_upload_kind TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_upload_kind TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_feature_count INTEGER NOT NULL DEFAULT 0;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_feature_count INTEGER NOT NULL DEFAULT 0;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_utm_zone INTEGER NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_utm_zone INTEGER NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_utm_band TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_utm_band TEXT NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_utm_easting DOUBLE PRECISION NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_utm_easting DOUBLE PRECISION NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_utm_northing DOUBLE PRECISION NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_utm_northing DOUBLE PRECISION NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_point_geojson JSONB NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_point_geojson JSONB NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_polygon_geojson JSONB NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_polygon_geojson JSONB NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_point_feature_count INTEGER NOT NULL DEFAULT 0;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_point_feature_count INTEGER NOT NULL DEFAULT 0;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_polygon_feature_count INTEGER NOT NULL DEFAULT 0;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_polygon_feature_count INTEGER NOT NULL DEFAULT 0;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {OPEN_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS geometry_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS accuracy_xy DOUBLE PRECISION NULL;
                """
            )
            cur.execute(
                f"""
                ALTER TABLE {FINISHED_QUESTS_TABLE}
                ADD COLUMN IF NOT EXISTS accuracy_z DOUBLE PRECISION NULL;
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
                f"""
                CREATE INDEX IF NOT EXISTS open_quests_geometry_type_idx
                ON {OPEN_QUESTS_TABLE} USING BTREE (geometry_type);
                """
            )
            cur.execute(
                f"""
                CREATE INDEX IF NOT EXISTS open_quests_geometry_status_idx
                ON {OPEN_QUESTS_TABLE} (geometry_status);
                """
            )
            cur.execute(
                f"""
                CREATE INDEX IF NOT EXISTS finished_quests_geometry_type_idx
                ON {FINISHED_QUESTS_TABLE} USING BTREE (geometry_type);
                """
            )
            cur.execute(
                f"""
                CREATE INDEX IF NOT EXISTS finished_quests_geometry_status_idx
                ON {FINISHED_QUESTS_TABLE} (geometry_status);
                """
            )
            cur.execute(
                f"""
                INSERT INTO {FINISHED_QUESTS_TABLE} (
                    id, title, description, status, "תעדוף", date, assigned_user,
                    shapefile_path, model_simulations, model_folder, group_name, year, ft, "מצייח",
                    sync_external_id, sync_source, sync_name,
                    geometry_type, geometry_status, geometry_geojson, geometry_source_path,
                    geometry_source_name, geometry_upload_kind, geometry_feature_count,
                    geometry_utm_zone, geometry_utm_band, geometry_utm_easting, geometry_utm_northing,
                    geometry_point_geojson, geometry_polygon_geojson,
                    geometry_point_feature_count, geometry_polygon_feature_count, geometry_updated_at
                )
                SELECT
                    id, title, description, status, "תעדוף", date, assigned_user,
                    shapefile_path, model_simulations, model_folder, group_name, year, ft, "מצייח",
                    sync_external_id, sync_source, sync_name,
                    geometry_type, geometry_status, geometry_geojson, geometry_source_path,
                    geometry_source_name, geometry_upload_kind, geometry_feature_count,
                    geometry_utm_zone, geometry_utm_band, geometry_utm_easting, geometry_utm_northing,
                    geometry_point_geojson, geometry_polygon_geojson,
                    geometry_point_feature_count, geometry_polygon_feature_count, geometry_updated_at
                FROM {OPEN_QUESTS_TABLE}
                WHERE status IN ('Finished')
                ON CONFLICT (id) DO NOTHING;
                """
            )
            cur.execute(
                f"""
                DELETE FROM {OPEN_QUESTS_TABLE}
                WHERE status IN ('Finished');
                """
            )
            cur.execute(
                f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'quest_geometries'
                    ) THEN
                        UPDATE {OPEN_QUESTS_TABLE} AS q
                        SET
                            geometry_type = g.geometry_type,
                            geometry_status = COALESCE(g.geometry_status,
                                CASE WHEN q.shapefile_path IS NOT NULL THEN 'pending' ELSE 'missing' END),
                            geometry_geojson = g.geometry_geojson,
                            geometry_source_path = COALESCE(g.source_path, q.shapefile_path),
                            geometry_source_name = g.source_name,
                            geometry_upload_kind = g.upload_kind,
                            geometry_feature_count = COALESCE(g.feature_count, 0),
                            geometry_utm_zone = g.utm_zone,
                            geometry_utm_band = g.utm_band,
                            geometry_utm_easting = g.utm_easting,
                            geometry_utm_northing = g.utm_northing,
                            geometry_point_geojson = g.point_geojson,
                            geometry_polygon_geojson = g.polygon_geojson,
                            geometry_point_feature_count = COALESCE(g.point_feature_count, 0),
                            geometry_polygon_feature_count = COALESCE(g.polygon_feature_count, 0),
                            geometry_updated_at = COALESCE(g.updated_at, q.geometry_updated_at, NOW())
                        FROM quest_geometries AS g
                        WHERE g.quest_id = q.id;

                        UPDATE {FINISHED_QUESTS_TABLE} AS q
                        SET
                            geometry_type = g.geometry_type,
                            geometry_status = COALESCE(g.geometry_status,
                                CASE WHEN q.shapefile_path IS NOT NULL THEN 'pending' ELSE 'missing' END),
                            geometry_geojson = g.geometry_geojson,
                            geometry_source_path = COALESCE(g.source_path, q.shapefile_path),
                            geometry_source_name = g.source_name,
                            geometry_upload_kind = g.upload_kind,
                            geometry_feature_count = COALESCE(g.feature_count, 0),
                            geometry_utm_zone = g.utm_zone,
                            geometry_utm_band = g.utm_band,
                            geometry_utm_easting = g.utm_easting,
                            geometry_utm_northing = g.utm_northing,
                            geometry_point_geojson = g.point_geojson,
                            geometry_polygon_geojson = g.polygon_geojson,
                            geometry_point_feature_count = COALESCE(g.point_feature_count, 0),
                            geometry_polygon_feature_count = COALESCE(g.polygon_feature_count, 0),
                            geometry_updated_at = COALESCE(g.updated_at, q.geometry_updated_at, NOW())
                        FROM quest_geometries AS g
                        WHERE g.quest_id = q.id;
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'finished_quest_geometries'
                    ) THEN
                        UPDATE {FINISHED_QUESTS_TABLE} AS q
                        SET
                            geometry_type = g.geometry_type,
                            geometry_status = COALESCE(g.geometry_status, 'ready'),
                            geometry_geojson = g.geometry_geojson,
                            geometry_source_path = g.source_path,
                            geometry_source_name = g.source_name,
                            geometry_upload_kind = g.upload_kind,
                            geometry_feature_count = COALESCE(g.feature_count, 0),
                            geometry_utm_zone = g.utm_zone,
                            geometry_utm_band = g.utm_band,
                            geometry_utm_easting = g.utm_easting,
                            geometry_utm_northing = g.utm_northing,
                            geometry_point_geojson = g.point_geojson,
                            geometry_polygon_geojson = g.polygon_geojson,
                            geometry_point_feature_count = COALESCE(g.point_feature_count, 0),
                            geometry_polygon_feature_count = COALESCE(g.polygon_feature_count, 0),
                            geometry_updated_at = COALESCE(g.updated_at, q.geometry_updated_at, NOW()),
                            accuracy_xy = g.accuracy_xy,
                            accuracy_z = g.accuracy_z
                        FROM finished_quest_geometries AS g
                        WHERE g.quest_id = q.id;
                    END IF;
                END
                $$;
                """
            )
            cur.execute(
                f"""
                UPDATE {OPEN_QUESTS_TABLE}
                SET
                    geometry_status = CASE
                        WHEN geometry_status IS NULL AND shapefile_path IS NOT NULL THEN 'pending'
                        WHEN geometry_status IS NULL THEN 'missing'
                        ELSE geometry_status
                    END,
                    geometry_source_path = COALESCE(geometry_source_path, shapefile_path),
                    geometry_updated_at = COALESCE(geometry_updated_at, NOW());
                """
            )
            cur.execute(
                f"""
                UPDATE {FINISHED_QUESTS_TABLE}
                SET
                    geometry_status = CASE
                        WHEN geometry_status IS NULL AND shapefile_path IS NOT NULL THEN 'pending'
                        WHEN geometry_status IS NULL THEN 'missing'
                        ELSE geometry_status
                    END,
                    geometry_source_path = COALESCE(geometry_source_path, shapefile_path),
                    geometry_updated_at = COALESCE(geometry_updated_at, NOW());
                """
            )
            cur.execute("DROP TABLE IF EXISTS quest_geometries;")
            cur.execute("DROP TABLE IF EXISTS finished_quest_geometries;")
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
                            "status": quest.get("status", "Start"),
                            "priority": quest.get("priority", "רגיל"),
                            "date": _normalize_seed_date(quest.get("date")),
                            "assigned_user": quest.get("assigned_user"),
                            "shapefile_path": quest.get("shapefile_path"),
                            "group_name": quest.get("group", "לווינות"),
                            "year": quest.get("year", 2026),
                            "ft": quest.get("ft", "FT1"),
                        }
                        if normalized_quest["status"] in {"Finished"}:
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
                UPDATE {OPEN_QUESTS_TABLE}
                SET
                    geometry_status = CASE
                        WHEN shapefile_path IS NOT NULL THEN 'pending'
                        ELSE geometry_status
                    END,
                    geometry_source_path = COALESCE(geometry_source_path, shapefile_path),
                    geometry_updated_at = COALESCE(geometry_updated_at, NOW());
                """
            )
            cur.execute(
                f"""
                UPDATE {FINISHED_QUESTS_TABLE}
                SET
                    geometry_status = CASE
                        WHEN shapefile_path IS NOT NULL THEN 'pending'
                        ELSE geometry_status
                    END,
                    geometry_source_path = COALESCE(geometry_source_path, shapefile_path),
                    geometry_updated_at = COALESCE(geometry_updated_at, NOW());
                """
            )
