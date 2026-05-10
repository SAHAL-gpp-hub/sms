from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import DataAuditLog
from app.routers.auth import CurrentUser, require_role
from app.schemas.audit import DataAuditLogOut

router = APIRouter(prefix="/api/v1/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=list[DataAuditLogOut])
def list_data_audit_logs(
    table_name: str | None = Query(None),
    action: str | None = Query(None),
    user_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    query = db.query(DataAuditLog)
    if table_name:
        query = query.filter(DataAuditLog.table_name == table_name)
    if action:
        query = query.filter(DataAuditLog.action == action)
    if user_id is not None:
        query = query.filter(DataAuditLog.user_id == user_id)
    return query.order_by(DataAuditLog.created_at.desc(), DataAuditLog.id.desc()).offset(offset).limit(limit).all()

