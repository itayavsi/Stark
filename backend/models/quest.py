from typing import Literal, Optional

from pydantic import BaseModel

FT_OPTIONS = ["FT1", "FT2", "FT3", "FT4", "FT5"]
PRIORITY_OPTIONS = ["גבוה", "רגיל", "נמוך"]
STATUS_OPTIONS = ["Open", "Taken", "In Progress", "Done", "Approved", "Stopped", "Cancelled", "ממתין"]
MATZIAH_OPTIONS = ["N", "H", "M"]

QuestStatus = Literal["Open", "Taken", "In Progress", "Done", "Approved", "Stopped", "Cancelled", "ממתין"]
QuestPriority = Literal["גבוה", "רגיל", "נמוך"]
MatziahOption = Literal["N", "H", "M"]


class QuestCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[QuestStatus | str] = "Open"
    priority: Optional[QuestPriority | str] = "רגיל"
    date: Optional[str] = None
    assigned_user: Optional[str] = None
    shapefile_path: Optional[str] = None
    model_folder: Optional[str] = None
    group: Optional[str] = "לווינות"
    year: Optional[int] = 2026
    ft: Optional[str] = "FT1"
    quest_type: Optional[str] = None
    matziah: Optional[MatziahOption | str] = "H"
    sync_external_id: Optional[str] = None
    sync_source: Optional[str] = None
    sync_name: Optional[str] = None


class ExternalQuestCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[QuestStatus | str] = "Open"
    priority: Optional[QuestPriority | str] = "רגיל"
    date: Optional[str] = None
    assigned_user: Optional[str] = None
    group: Optional[str] = "לווינות"
    year: Optional[int] = 2026
    ft: Optional[str] = "FT1"
    quest_type: Optional[str] = None
    matziah: Optional[MatziahOption | str] = "N"
