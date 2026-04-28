from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from psycopg import connect
from psycopg.rows import dict_row

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def get_database_url() -> str:
    db_target = (os.getenv("DB_TARGET") or "neon").strip().lower()
    if db_target == "local":
        local_database_url = os.getenv("LOCAL_DATABASE_URL")
        if local_database_url:
            return local_database_url

    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    if db_target == "local":
        raise RuntimeError(
            "DB_TARGET=local but no LOCAL_DATABASE_URL (or fallback DATABASE_URL) is configured."
        )

    raise RuntimeError(
        "DATABASE_URL is not configured. Add your Neon connection string to backend/.env or export DATABASE_URL."
    )


def get_connection():
    return connect(get_database_url(), row_factory=dict_row)
