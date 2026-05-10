from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DataAuditLogOut(BaseModel):
    id: int
    user_id: int | None = None
    action: str
    table_name: str
    record_id: str
    old_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

