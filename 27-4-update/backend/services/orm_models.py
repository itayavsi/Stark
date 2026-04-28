from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Double, Integer, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from services.orm import Base


class UserORM(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    username: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    group_name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)


class QuestColumnsMixin:
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    model_simulations: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column("תעדוף", Text, nullable=False, default="ב")
    date: Mapped[str] = mapped_column(Text, nullable=False)
    deadline_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_user: Mapped[str | None] = mapped_column(Text, nullable=True)
    shapefile_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_folder: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    country: Mapped[str | None] = mapped_column(Text, nullable=True)
    zarhan_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_priority: Mapped[str | None] = mapped_column(Text, nullable=True)
    duo_to_use: Mapped[str | None] = mapped_column(Text, nullable=True)
    ground_point: Mapped[str | None] = mapped_column(Text, nullable=True)
    solve_strategy: Mapped[str | None] = mapped_column(Text, nullable=True)
    entry_date: Mapped[str] = mapped_column(Text, nullable=False)
    finished_date: Mapped[str | None] = mapped_column(Text, nullable=True)
    group_name: Mapped[str] = mapped_column(Text, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    ft: Mapped[str | None] = mapped_column(Text, nullable=True)
    matziah: Mapped[str] = mapped_column("מצייח", Text, nullable=False, default="H")
    sync_external_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    sync_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    sync_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    geometry_type: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    geometry_status: Mapped[str] = mapped_column(Text, nullable=False, default="missing")
    geometry_geojson: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    geometry_source_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    geometry_source_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    geometry_upload_kind: Mapped[str | None] = mapped_column(Text, nullable=True)
    geometry_feature_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    geometry_utm_zone: Mapped[int | None] = mapped_column(Integer, nullable=True)
    geometry_utm_band: Mapped[str | None] = mapped_column(Text, nullable=True)
    geometry_utm_easting: Mapped[float | None] = mapped_column(Double, nullable=True)
    geometry_utm_northing: Mapped[float | None] = mapped_column(Double, nullable=True)
    geometry_point_geojson: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    geometry_polygon_geojson: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    geometry_point_feature_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    geometry_polygon_feature_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    geometry_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())


class OpenQuestORM(QuestColumnsMixin, Base):
    __tablename__ = "open_quests"


class FinishedQuestORM(QuestColumnsMixin, Base):
    __tablename__ = "finished_quests"

    accuracy_xy: Mapped[float | None] = mapped_column(Double, nullable=True)
    accuracy_z: Mapped[float | None] = mapped_column(Double, nullable=True)


class ExternalQuestORM(Base):
    __tablename__ = "external_quests"

    external_id: Mapped[str] = mapped_column(Text, primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    matziah: Mapped[str] = mapped_column(Text, nullable=False, default="N")
    local_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    transferred_quest_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
