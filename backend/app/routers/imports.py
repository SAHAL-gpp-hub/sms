from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.auth import CurrentUser, require_role
from app.services import import_service

router = APIRouter(prefix='/api/v1/imports', tags=['Imports'])


async def _read_upload(file: UploadFile) -> tuple[str, bytes]:
    contents = await file.read()
    return file.filename or 'students.csv', contents


@router.get('/students/template')
def download_students_template(_: CurrentUser = Depends(require_role('admin'))):
    return Response(
        content=import_service.get_template_csv(),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=student-import-template.csv'},
    )


@router.get('/students/sample')
def download_students_sample(_: CurrentUser = Depends(require_role('admin'))):
    return Response(
        content=import_service.get_sample_csv(),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=student-import-sample.csv'},
    )


@router.post('/students/preview')
async def preview_students_import(
    file: UploadFile = File(...),
    create_missing_classes: bool = Form(False),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role('admin')),
):
    filename, contents = await _read_upload(file)
    return import_service.preview_students_import(
        db,
        filename=filename,
        file_bytes=contents,
        create_missing_classes=create_missing_classes,
    )


@router.post('/students/commit')
async def commit_students_import(
    file: UploadFile = File(...),
    create_missing_classes: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role('admin')),
):
    filename, contents = await _read_upload(file)
    return import_service.commit_students_import(
        db,
        filename=filename,
        file_bytes=contents,
        create_missing_classes=create_missing_classes,
        actor=current_user,
    )


@router.get('/students/batches')
def list_students_import_batches(
    limit: int = 10,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role('admin')),
):
    return import_service.list_student_import_batches(db, limit=limit)


@router.post('/students/batches/{batch_id}/rollback')
def rollback_students_import(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role('admin')),
):
    return import_service.rollback_student_import(db, batch_id=batch_id, actor=current_user)
