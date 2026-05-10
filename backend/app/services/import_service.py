from __future__ import annotations

import csv
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.models.base_models import (
    AcademicYear,
    Class,
    Exam,
    FeeStructure,
    ImportBatch,
    ImportBatchItem,
    ImportStatusEnum,
    Student,
    StudentStatusEnum,
    Subject,
    TeacherClassAssignment,
)
from app.schemas.student import StudentCreate
from app.services import student_service
from app.services.yearend_service import normalize_class_name

MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024
SUPPORTED_EXTENSIONS = {'.csv', '.xlsx'}
REQUIRED_COLUMNS = {
    'name_en',
    'name_gu',
    'dob',
    'gender',
    'class_name',
    'father_name',
    'contact',
    'admission_date',
}
TEMPLATE_COLUMNS = [
    'student_id',
    'gr_number',
    'name_en',
    'name_gu',
    'dob',
    'gender',
    'class_name',
    'division',
    'father_name',
    'mother_name',
    'contact',
    'student_email',
    'student_phone',
    'guardian_email',
    'guardian_phone',
    'address',
    'category',
    'aadhar_last4',
    'admission_date',
    'academic_year_label',
    'roll_number',
    'previous_school',
]
HEADER_ALIASES = {
    'class': 'class_name',
    'class_standard': 'class_name',
    'standard': 'class_name',
    'class_division': 'division',
    'section': 'division',
    'academic_year': 'academic_year_label',
    'year': 'academic_year_label',
    'mobile': 'contact',
    'phone': 'contact',
    'guardian_name': 'father_name',
}
SAMPLE_ROW = {
    'student_id': 'OLD-2024-001',
    'gr_number': 'GR2024001',
    'name_en': 'Aarav Patel',
    'name_gu': 'આરવ પટેલ',
    'dob': '2013-05-12',
    'gender': 'M',
    'class_name': '7',
    'division': 'A',
    'father_name': 'Rakesh Patel',
    'mother_name': 'Pooja Patel',
    'contact': '9876543210',
    'student_email': 'aarav.student@example.com',
    'student_phone': '9876543210',
    'guardian_email': 'rakesh.parent@example.com',
    'guardian_phone': '9876543210',
    'address': 'Palanpur, Gujarat',
    'category': 'GEN',
    'aadhar_last4': '1234',
    'admission_date': '2024-06-01',
    'academic_year_label': '2025-26',
    'roll_number': '1',
    'previous_school': 'Iqra Primary School',
}


@dataclass
class RowContext:
    row_number: int
    raw: dict[str, Any]
    normalized: dict[str, Any]
    issues: list[str]
    warnings: list[str]
    status: str
    action: str
    class_key: tuple[str, str, int] | None
    missing_class: bool
    student_id: str | None
    gr_number: str | None


class ImportValidationError(ValueError):
    pass


def _normalize_header(value: Any) -> str:
    text = str(value or '').strip().lower()
    for ch in (' ', '-', '/', '\\'):
        text = text.replace(ch, '_')
    while '__' in text:
        text = text.replace('__', '_')
    return HEADER_ALIASES.get(text.strip('_'), text.strip('_'))


def _normalize_cell(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()


def _read_rows(filename: str, file_bytes: bytes) -> tuple[str, list[str], list[dict[str, str]]]:
    ext = Path(filename or '').suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ImportValidationError('Unsupported file type. Upload CSV or XLSX files only.')
    if len(file_bytes) > MAX_IMPORT_FILE_SIZE:
        raise ImportValidationError('Import file is too large. Maximum supported size is 5 MB.')

    if ext == '.csv':
        text = file_bytes.decode('utf-8-sig')
        reader = csv.DictReader(StringIO(text))
        if not reader.fieldnames:
            raise ImportValidationError('CSV file is missing a header row.')
        headers = [_normalize_header(field) for field in reader.fieldnames]
        rows: list[dict[str, str]] = []
        for raw_row in reader:
            row = {
                headers[idx]: _normalize_cell(value)
                for idx, value in enumerate(raw_row.values())
                if idx < len(headers)
            }
            if any(value for value in row.values()):
                rows.append(row)
        return 'csv', headers, rows

    workbook = load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
    sheet = workbook.active
    raw_headers = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not raw_headers:
        raise ImportValidationError('XLSX file is missing a header row.')
    headers = [_normalize_header(field) for field in raw_headers]
    rows = []
    for values in sheet.iter_rows(min_row=2, values_only=True):
        row = {
            headers[idx]: _normalize_cell(value)
            for idx, value in enumerate(values)
            if idx < len(headers)
        }
        if any(value for value in row.values()):
            rows.append(row)
    return 'xlsx', headers, rows


def _parse_date(value: str, field_name: str) -> date:
    cleaned = (value or '').strip()
    if not cleaned:
        raise ValueError(f'{field_name} is required')
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y'):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    raise ValueError(f'{field_name} must be a valid date (YYYY-MM-DD preferred)')


def _normalize_gender(value: str) -> str:
    cleaned = (value or '').strip().lower()
    mapping = {
        'm': 'M',
        'male': 'M',
        'f': 'F',
        'female': 'F',
        'other': 'Other',
        'o': 'Other',
    }
    if cleaned not in mapping:
        raise ValueError('gender must be M, F, or Other')
    return mapping[cleaned]


def _maybe_int(value: str, field_name: str) -> int | None:
    cleaned = (value or '').strip()
    if not cleaned:
        return None
    try:
        parsed = int(cleaned)
    except ValueError as exc:
        raise ValueError(f'{field_name} must be a whole number') from exc
    if parsed <= 0:
        raise ValueError(f'{field_name} must be greater than 0')
    return parsed


def _current_year(db: Session) -> AcademicYear | None:
    return db.query(AcademicYear).filter(AcademicYear.is_current.is_(True)).first()


def _build_class_lookup(db: Session) -> dict[tuple[str, str, int], Class]:
    classes = db.query(Class).all()
    lookup: dict[tuple[str, str, int], Class] = {}
    for cls in classes:
        lookup[(normalize_class_name(cls.name), (cls.division or 'A').strip().upper(), cls.academic_year_id)] = cls
    return lookup


def _build_preview(
    db: Session,
    *,
    filename: str,
    file_bytes: bytes,
    create_missing_classes: bool,
) -> dict[str, Any]:
    file_format, headers, rows = _read_rows(filename, file_bytes)
    missing_columns = sorted(REQUIRED_COLUMNS - set(headers))

    year_lookup = {year.label: year for year in db.query(AcademicYear).all()}
    current_year = _current_year(db)
    class_lookup = _build_class_lookup(db)

    incoming_student_ids = [row.get('student_id', '').strip() for row in rows if row.get('student_id', '').strip()]
    incoming_gr_numbers = [row.get('gr_number', '').strip() for row in rows if row.get('gr_number', '').strip()]
    existing_student_ids = {
        value
        for value, in db.query(Student.student_id).filter(Student.student_id.in_(incoming_student_ids)).all()
    } if incoming_student_ids else set()
    existing_gr_numbers = {
        value
        for value, in db.query(Student.gr_number).filter(Student.gr_number.in_(incoming_gr_numbers)).all()
        if value
    } if incoming_gr_numbers else set()
    file_student_id_counts = Counter(incoming_student_ids)
    file_gr_counts = Counter(incoming_gr_numbers)

    preview_rows: list[RowContext] = []
    missing_class_refs: set[tuple[str, str, str]] = set()
    for index, raw_row in enumerate(rows, start=2):
        issues: list[str] = []
        warnings: list[str] = []
        normalized: dict[str, Any] = {}
        student_id = raw_row.get('student_id', '').strip() or None
        gr_number = raw_row.get('gr_number', '').strip() or None
        class_name = normalize_class_name(raw_row.get('class_name', '').strip()) if raw_row.get('class_name') else ''
        division = (raw_row.get('division') or 'A').strip().upper() or 'A'
        year_label = (raw_row.get('academic_year_label') or '').strip()
        academic_year = year_lookup.get(year_label) if year_label else current_year

        if missing_columns:
            issues.extend(f'Missing required column: {column}' for column in missing_columns)
        if not academic_year:
            issues.append('No academic year found for this row and no current academic year is set')
        if not class_name:
            issues.append('class_name is required')

        class_key = None
        class_obj = None
        if academic_year and class_name:
            class_key = (class_name, division, academic_year.id)
            class_obj = class_lookup.get(class_key)
            if not class_obj:
                if create_missing_classes:
                    missing_class_refs.add((class_name, division, academic_year.label))
                    warnings.append(f'Class {class_name}-{division} will be created in {academic_year.label}')
                else:
                    issues.append(f'Class {class_name}-{division} does not exist in {academic_year.label}')

        if student_id and file_student_id_counts[student_id] > 1:
            issues.append('Duplicate student_id found in uploaded file')
        if gr_number and file_gr_counts[gr_number] > 1:
            issues.append('Duplicate gr_number found in uploaded file')
        if student_id and student_id in existing_student_ids:
            issues.append('student_id already exists in the system')
        if gr_number and gr_number in existing_gr_numbers:
            issues.append('gr_number already exists in the system')

        try:
            normalized['dob'] = _parse_date(raw_row.get('dob', ''), 'dob')
        except ValueError as exc:
            issues.append(str(exc))
        try:
            normalized['admission_date'] = _parse_date(raw_row.get('admission_date', ''), 'admission_date')
        except ValueError as exc:
            issues.append(str(exc))
        try:
            normalized['gender'] = _normalize_gender(raw_row.get('gender', ''))
        except ValueError as exc:
            issues.append(str(exc))
        try:
            normalized['roll_number'] = _maybe_int(raw_row.get('roll_number', ''), 'roll_number')
        except ValueError as exc:
            issues.append(str(exc))

        normalized.update({
            'name_en': raw_row.get('name_en', '').strip(),
            'name_gu': raw_row.get('name_gu', '').strip(),
            'father_name': raw_row.get('father_name', '').strip(),
            'mother_name': raw_row.get('mother_name', '').strip() or None,
            'contact': ''.join(ch for ch in raw_row.get('contact', '').strip() if ch.isdigit()),
            'student_email': raw_row.get('student_email', '').strip() or None,
            'student_phone': ''.join(ch for ch in raw_row.get('student_phone', '').strip() if ch.isdigit()) or None,
            'guardian_email': raw_row.get('guardian_email', '').strip() or None,
            'guardian_phone': ''.join(ch for ch in raw_row.get('guardian_phone', '').strip() if ch.isdigit()) or None,
            'address': raw_row.get('address', '').strip() or None,
            'category': raw_row.get('category', '').strip() or None,
            'aadhar_last4': raw_row.get('aadhar_last4', '').strip() or None,
            'academic_year_id': academic_year.id if academic_year else 1,
            'class_id': class_obj.id if class_obj else 1,
            'gr_number': gr_number,
            'previous_school': raw_row.get('previous_school', '').strip() or None,
        })

        if normalized.get('contact'):
            if not normalized.get('student_phone'):
                normalized['student_phone'] = normalized['contact']
            if not normalized.get('guardian_phone'):
                normalized['guardian_phone'] = normalized['contact']

        for field in ('name_en', 'name_gu', 'father_name', 'contact'):
            if not normalized.get(field):
                issues.append(f'{field} is required')

        if not issues:
            try:
                model = StudentCreate(**normalized)
                normalized = model.model_dump()
                normalized['previous_school'] = raw_row.get('previous_school', '').strip() or None
            except Exception as exc:  # pragma: no cover - pydantic aggregates errors variably
                message = str(exc)
                issues.append(message.split('\n')[0])

        status = 'ready' if not issues else 'invalid'
        action = 'create'
        if issues and any('already exists' in issue or 'Duplicate' in issue for issue in issues):
            action = 'skip_duplicate'
        elif issues:
            action = 'fix_errors'
        elif class_obj is None and class_key is not None:
            action = 'create_class_and_student'

        preview_rows.append(RowContext(
            row_number=index,
            raw=raw_row,
            normalized=normalized,
            issues=issues,
            warnings=warnings,
            status=status,
            action=action,
            class_key=class_key,
            missing_class=class_obj is None and class_key is not None,
            student_id=student_id,
            gr_number=gr_number,
        ))

    summary = {
        'total_rows': len(preview_rows),
        'ready_rows': sum(1 for row in preview_rows if row.status == 'ready'),
        'invalid_rows': sum(1 for row in preview_rows if row.status == 'invalid'),
        'duplicate_rows': sum(1 for row in preview_rows if any('already exists' in issue or 'Duplicate' in issue for issue in row.issues)),
        'missing_class_rows': sum(1 for row in preview_rows if row.missing_class),
        'classes_to_create': [
            {'class_name': class_name, 'division': division, 'academic_year_label': year_label}
            for class_name, division, year_label in sorted(missing_class_refs)
        ],
    }
    return {
        'file_name': filename,
        'file_format': file_format,
        'headers': headers,
        'missing_columns': missing_columns,
        'summary': summary,
        'rows': [
            {
                'row_number': row.row_number,
                'student_id': row.student_id,
                'gr_number': row.gr_number,
                'name_en': row.raw.get('name_en', ''),
                'class_name': row.raw.get('class_name', ''),
                'division': row.raw.get('division') or 'A',
                'academic_year_label': row.raw.get('academic_year_label') or (current_year.label if current_year else ''),
                'status': row.status,
                'action': row.action,
                'issues': row.issues,
                'warnings': row.warnings,
            }
            for row in preview_rows
        ],
        '_contexts': preview_rows,
    }


def preview_students_import(
    db: Session,
    *,
    filename: str,
    file_bytes: bytes,
    create_missing_classes: bool,
) -> dict[str, Any]:
    try:
        payload = _build_preview(
            db,
            filename=filename,
            file_bytes=file_bytes,
            create_missing_classes=create_missing_classes,
        )
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    payload.pop('_contexts', None)
    return payload


def get_template_csv() -> str:
    return ','.join(TEMPLATE_COLUMNS) + '\n'


def get_sample_csv() -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=TEMPLATE_COLUMNS)
    writer.writeheader()
    writer.writerow(SAMPLE_ROW)
    return output.getvalue()


def list_student_import_batches(db: Session, limit: int = 10) -> dict[str, Any]:
    items = db.query(ImportBatch).filter_by(entity_type='student').order_by(ImportBatch.created_at.desc()).limit(limit).all()
    totals = db.query(ImportBatch).filter_by(entity_type='student').all()
    return {
        'summary': {
            'total_batches': len(totals),
            'imported_rows': sum(batch.imported_rows for batch in totals),
            'skipped_rows': sum(batch.skipped_rows for batch in totals),
            'error_rows': sum(batch.error_rows for batch in totals),
            'rolled_back_batches': sum(1 for batch in totals if batch.status == ImportStatusEnum.rolled_back),
        },
        'items': [
            {
                'id': batch.id,
                'file_name': batch.file_name,
                'file_format': batch.file_format,
                'status': batch.status.value if hasattr(batch.status, 'value') else batch.status,
                'merge_mode': batch.merge_mode,
                'total_rows': batch.total_rows,
                'imported_rows': batch.imported_rows,
                'skipped_rows': batch.skipped_rows,
                'error_rows': batch.error_rows,
                'created_at': batch.created_at.isoformat() if batch.created_at else None,
                'rolled_back_at': batch.rolled_back_at.isoformat() if batch.rolled_back_at else None,
                'summary': batch.summary or {},
                'created_by_name': batch.created_by.name if getattr(batch, 'created_by', None) else None,
            }
            for batch in items
        ],
    }


def commit_students_import(
    db: Session,
    *,
    filename: str,
    file_bytes: bytes,
    create_missing_classes: bool,
    actor: Any,
) -> dict[str, Any]:
    try:
        preview = _build_preview(
            db,
            filename=filename,
            file_bytes=file_bytes,
            create_missing_classes=create_missing_classes,
        )
    except ImportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    contexts: list[RowContext] = preview.pop('_contexts')
    ready_rows = [row for row in contexts if row.status == 'ready']
    if not ready_rows:
        raise HTTPException(status_code=422, detail='No valid rows are ready to import')

    batch = ImportBatch(
        entity_type='student',
        file_name=filename,
        file_format=preview['file_format'],
        merge_mode='skip_duplicates',
        status=ImportStatusEnum.completed,
        total_rows=preview['summary']['total_rows'],
        imported_rows=0,
        skipped_rows=preview['summary']['duplicate_rows'],
        error_rows=preview['summary']['invalid_rows'] - preview['summary']['duplicate_rows'],
        summary={
            **preview['summary'],
            'create_missing_classes': create_missing_classes,
        },
        created_by_user_id=actor.id,
    )
    db.add(batch)
    db.flush()

    class_lookup = _build_class_lookup(db)
    created_classes: list[dict[str, Any]] = []
    if create_missing_classes:
        for ref in preview['summary']['classes_to_create']:
            academic_year = db.query(AcademicYear).filter_by(label=ref['academic_year_label']).first()
            if not academic_year:
                continue
            key = (normalize_class_name(ref['class_name']), ref['division'].strip().upper(), academic_year.id)
            if key in class_lookup:
                continue
            cls = Class(
                name=normalize_class_name(ref['class_name']),
                division=ref['division'].strip().upper(),
                academic_year_id=academic_year.id,
            )
            db.add(cls)
            db.flush()
            class_lookup[key] = cls
            created_classes.append({
                'id': cls.id,
                'name': cls.name,
                'division': cls.division,
                'academic_year_label': academic_year.label,
            })
            db.add(ImportBatchItem(
                import_batch_id=batch.id,
                entity_type='class',
                entity_id=cls.id,
                action='created',
                payload={'name': cls.name, 'division': cls.division, 'academic_year_label': academic_year.label},
            ))

    created_students: list[dict[str, Any]] = []
    try:
        current_year = _current_year(db)
        for row in ready_rows:
            academic_year_label = row.raw.get('academic_year_label') or (current_year.label if current_year else '')
            class_key = row.class_key
            if not class_key:
                raise HTTPException(status_code=422, detail=f'Row {row.row_number} is missing class information')
            class_obj = class_lookup.get(class_key)
            if not class_obj:
                raise HTTPException(status_code=422, detail=f'Class missing for row {row.row_number}')
            payload = dict(row.normalized)
            payload['class_id'] = class_obj.id
            payload['academic_year_id'] = class_key[2]
            student = student_service.create_student_from_import(
                db,
                StudentCreate(**payload),
                student_id_override=row.student_id,
                previous_school=payload.get('previous_school'),
                auto_commit=False,
            )
            created_students.append({
                'id': student.id,
                'student_id': student.student_id,
                'name_en': student.name_en,
            })
            db.add(ImportBatchItem(
                import_batch_id=batch.id,
                entity_type='student',
                entity_id=student.id,
                action='created',
                payload={
                    'student_id': student.student_id,
                    'gr_number': student.gr_number,
                    'name_en': student.name_en,
                    'class_name': class_obj.name,
                    'division': class_obj.division,
                    'academic_year_label': academic_year_label,
                },
            ))

        batch.imported_rows = len(created_students)
        batch.summary = {
            **(batch.summary or {}),
            'created_classes': created_classes,
            'created_students_preview': created_students[:10],
        }
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(batch)
    return {
        'batch': {
            'id': batch.id,
            'status': batch.status.value if hasattr(batch.status, 'value') else batch.status,
            'file_name': batch.file_name,
            'imported_rows': batch.imported_rows,
            'skipped_rows': batch.skipped_rows,
            'error_rows': batch.error_rows,
            'summary': batch.summary,
        },
        'preview': preview,
    }


def rollback_student_import(db: Session, batch_id: int, actor: Any) -> dict[str, Any]:
    batch = db.query(ImportBatch).filter_by(id=batch_id, entity_type='student').first()
    if not batch:
        raise HTTPException(status_code=404, detail='Import batch not found')
    if batch.status == ImportStatusEnum.rolled_back:
        raise HTTPException(status_code=409, detail='Import batch has already been rolled back')

    student_items = db.query(ImportBatchItem).filter_by(import_batch_id=batch.id, entity_type='student', action='created').all()
    class_items = db.query(ImportBatchItem).filter_by(import_batch_id=batch.id, entity_type='class', action='created').all()

    deactivated_students = 0
    skipped_students = 0
    for item in student_items:
        student = db.query(Student).filter_by(id=item.entity_id).first()
        if not student:
            skipped_students += 1
            continue
        if student.status != StudentStatusEnum.Left:
            student.status = StudentStatusEnum.Left
            if not student.reason_for_leaving:
                student.reason_for_leaving = f'Rolled back import batch #{batch.id}'
            deactivated_students += 1
        else:
            skipped_students += 1

    batch.status = ImportStatusEnum.rolled_back
    batch.rolled_back_at = datetime.now(UTC)
    batch.rollback_summary = {
        'rolled_back_by_user_id': actor.id,
        'deactivated_students': deactivated_students,
        'skipped_students': skipped_students,
        'preserved_classes': len(class_items),
    }
    db.commit()
    return {
        'batch_id': batch.id,
        'status': batch.status.value if hasattr(batch.status, 'value') else batch.status,
        'rollback_summary': batch.rollback_summary,
    }
