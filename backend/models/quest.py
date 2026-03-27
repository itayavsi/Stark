from pydantic import BaseModel
from typing import Optional

FT_OPTIONS = ["FT1", "FT2", "FT3", "FT4", "FT5"]
PRIORITY_OPTIONS = ["גבוה", "רגיל", "נמוך"]

class QuestCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[str] = "Open"
    priority: Optional[str] = "רגיל"
    date: Optional[str] = None
    assigned_user: Optional[str] = None
    shapefile_path: Optional[str] = None
    group: Optional[str] = "לווינות"
    year: Optional[int] = 2026
    ft: Optional[str] = "FT1"
