from typing import Literal, Optional

from pydantic import BaseModel

FT_OPTIONS = ["FT1", "FT2", "FT3", "FT4", "FT5"]
PRIORITY_OPTIONS = ["א+", "א", "ב", "ג", "ד", "ה", "deadline"]
STATUS_OPTIONS = [
    "Start",
    "Search",
    "Production",
    "Solve",
    "MBT_solve",
    "Tiyuv",
    "acc_test",
    "Kilta",
    "Paused",
    "Finished",
    "Ziyuah_mipuy",
    "Klita_mipuy",
    "MQA",
    "BDB",
    "QL",
    "BDB_hold",
    "need_ziyuah",
    "hold_ziyuah",
    "Snow_ziyuah",
    "Need_Nezah",
    "Approved_Nezah",
]
MATZIAH_OPTIONS = ["N", "H", "M"]

QuestStatus = Literal[
    "Start",
    "Search",
    "Production",
    "Solve",
    "MBT_solve",
    "Tiyuv",
    "acc_test",
    "Kilta",
    "Paused",
    "Finished",
    "Ziyuah_mipuy",
    "Klita_mipuy",
    "MQA",
    "BDB",
    "QL",
    "BDB_hold",
    "need_ziyuah",
    "hold_ziyuah",
    "Snow_ziyuah",
    "Need_Nezah",
    "Approved_Nezah",
]
QuestPriority = Literal["א+", "א", "ב", "ג", "ד", "ה", "deadline"]
MatziahOption = Literal["N", "H", "M"]


class QuestCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[QuestStatus | str] = "Start"
    priority: Optional[QuestPriority | str] = "ב"
    date: Optional[str] = None
    deadline_at: Optional[str] = None
    assigned_user: Optional[str] = None
    shapefile_path: Optional[str] = None
    model_simulations: Optional[str] = None
    model_folder: Optional[str] = None
    group: Optional[str] = "לווינות"
    year: Optional[int] = 2026
    ft: Optional[str] = "FT1"
    quest_type: Optional[str] = None
    target_type: Optional[str] = None
    country: Optional[str] = None
    zarhan_notes: Optional[str] = None
    user_priority: Optional[str] = None
    duo_to_use: Optional[str] = None
    ground_point: Optional[str] = None
    solve_strategy: Optional[str] = None
    entry_date: Optional[str] = None
    finished_date: Optional[str] = None
    matziah: Optional[MatziahOption | str] = "H"
    sync_external_id: Optional[str] = None
    sync_source: Optional[str] = None
    sync_name: Optional[str] = None


class ExternalQuestCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[QuestStatus | str] = "Start"
    priority: Optional[QuestPriority | str] = None
    date: Optional[str] = None
    deadline_at: Optional[str] = None
    assigned_user: Optional[str] = None
    group: Optional[str] = "לווינות"
    year: Optional[int] = 2026
    ft: Optional[str] = "FT1"
    quest_type: Optional[str] = None
    target_type: Optional[str] = None
    country: Optional[str] = None
    zarhan_notes: Optional[str] = None
    user_priority: Optional[str] = None
    duo_to_use: Optional[str] = None
    ground_point: Optional[str] = None
    solve_strategy: Optional[str] = None
    entry_date: Optional[str] = None
    finished_date: Optional[str] = None
    matziah: Optional[MatziahOption | str] = "N"
