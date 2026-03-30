from typing import Literal, Optional

from pydantic import BaseModel, Field

GeometryType = Literal["point", "polygon"]
GeometryStatus = Literal["missing", "pending", "ready", "error"]


class QuestPointGeometryCreate(BaseModel):
    utm: str = Field(min_length=3)


class QuestGeometryResponse(BaseModel):
    quest_id: str
    geometry_type: Optional[GeometryType] = None
    geometry_status: GeometryStatus | str = "missing"
    source_path: Optional[str] = None
    source_name: Optional[str] = None
    feature_count: int = 0
    feature_collection: Optional[dict] = None
