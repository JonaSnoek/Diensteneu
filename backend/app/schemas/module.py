import datetime
from pydantic import BaseModel
from typing import Optional

class ModuleUpdate(BaseModel):
    is_active: Optional[bool] = None

class ModuleResponse(BaseModel):
    id: str
    name: str
    version: str
    description: Optional[str] = None
    icon: str
    entry_point: str
    category: str
    is_active: bool
    uploaded_at: datetime.datetime
    uploaded_by_id: Optional[int] = None

    class Config:
        from_attributes = True
