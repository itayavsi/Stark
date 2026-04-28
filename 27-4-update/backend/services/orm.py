from __future__ import annotations

from contextlib import contextmanager
from functools import lru_cache
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from services.db import get_database_url


class Base(DeclarativeBase):
    pass


def get_sqlalchemy_database_url() -> str:
    database_url = get_database_url()
    if database_url.startswith("postgresql+"):
        return database_url
    if database_url.startswith("postgresql://"):
        return f"postgresql+psycopg://{database_url[len('postgresql://') :]}"
    if database_url.startswith("postgres://"):
        return f"postgresql+psycopg://{database_url[len('postgres://') :]}"
    return database_url


@lru_cache(maxsize=1)
def get_engine():
    return create_engine(get_sqlalchemy_database_url(), pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_session_factory():
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
