from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy.inspection import inspect as sa_inspect
from sqlalchemy.orm import Session

from app.models.base_models import DataAuditActionEnum, DataAuditLog


def _json_safe(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def model_snapshot(instance: Any) -> dict[str, Any]:
    mapper = sa_inspect(instance).mapper
    return {col.key: _json_safe(getattr(instance, col.key)) for col in mapper.column_attrs}


def log_data_change(
    db: Session,
    *,
    user_id: int | None,
    action: DataAuditActionEnum,
    table_name: str,
    record_id: str | int,
    old_value: dict[str, Any] | None,
    new_value: dict[str, Any] | None,
) -> DataAuditLog:
    entry = DataAuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=str(record_id),
        old_value=_json_safe(old_value),
        new_value=_json_safe(new_value),
    )
    db.add(entry)
    return entry

