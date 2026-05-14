from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.models.base_models import Class, OperationJob, OperationJobStatusEnum
from app.routers.auth import CurrentUser, require_role
from app.services import yearend_service

router = APIRouter(prefix="/api/v1/jobs", tags=["Operation Jobs"])


class YearEndPromotionJobRequest(BaseModel):
    new_academic_year_id: int
    class_ids: Optional[list[int]] = None
    source_academic_year_id: Optional[int] = None
    student_actions: Optional[dict[int, str]] = None
    roll_strategy: str = "sequential"
    force: bool = False


def _run_yearend_promotion_job(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.query(OperationJob).filter_by(id=job_id).first()
        if not job:
            return
        job.status = OperationJobStatusEnum.running
        job.progress = 0
        db.commit()

        payload = job.payload or {}
        class_ids = payload.get("resolved_class_ids") or payload.get("class_ids") or []
        results = []
        total = len(class_ids)
        for index, class_id in enumerate(class_ids, start=1):
            try:
                result = yearend_service.bulk_promote_students(
                    db,
                    class_id=class_id,
                    new_academic_year_id=payload["new_academic_year_id"],
                    performed_by=job.actor_user_id,
                    student_actions=payload.get("student_actions") if total == 1 else None,
                    roll_strategy=payload.get("roll_strategy", "sequential"),
                    force=payload.get("force", False),
                )
                results.append({"class_id": class_id, "status": "completed", "result": result})
            except Exception as exc:
                results.append({"class_id": class_id, "status": "failed", "error": str(exc)})
                if total == 1:
                    raise
            job.progress = int(index / total * 100) if total else 100
            job.result = {"classes": results}
            db.commit()

        job.status = (
            OperationJobStatusEnum.failed
            if any(r["status"] == "failed" for r in results)
            else OperationJobStatusEnum.completed
        )
        job.completed_at = datetime.now(timezone.utc)
        job.progress = 100
        job.result = {"classes": results}
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.query(OperationJob).filter_by(id=job_id).first()
        if job:
            job.status = OperationJobStatusEnum.failed
            job.error = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


@router.get("/{job_id}")
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    job = db.query(OperationJob).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "payload": job.payload,
        "result": job.result,
        "error": job.error,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "completed_at": job.completed_at,
    }


@router.post("/yearend-promotion")
def create_yearend_promotion_job(
    data: YearEndPromotionJobRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    class_ids = data.class_ids
    if not class_ids:
        if not data.source_academic_year_id:
            raise HTTPException(status_code=422, detail="Provide class_ids or source_academic_year_id")
        class_ids = [
            c.id for c in db.query(Class)
            .filter(Class.academic_year_id == data.source_academic_year_id)
            .order_by(Class.id)
            .all()
        ]
    if not class_ids:
        raise HTTPException(status_code=422, detail="No classes found for promotion")

    job = OperationJob(
        job_type="yearend-promotion",
        status=OperationJobStatusEnum.pending,
        actor_user_id=current_user.id,
        payload={**data.model_dump(), "resolved_class_ids": class_ids},
        progress=0,
        result={"classes": []},
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(_run_yearend_promotion_job, job.id)

    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "result": job.result,
        "error": job.error,
    }
