from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "Viewer"
    group: Optional[str] = "לווינות"
    display_name: Optional[str] = None
