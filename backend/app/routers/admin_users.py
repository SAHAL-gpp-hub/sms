from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.base_models import AcademicYear, Class, Student, StudentStatusEnum, Subject, TeacherClassAssignment, User
from app.routers.auth import CurrentUser, require_role


router = APIRouter(prefix="/api/v1/admin", tags=["Admin Users"])

VALID_ROLES = {"admin", "teacher", "student", "parent"}


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    is_active: bool = True

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in VALID_ROLES:
            raise ValueError("Role must be admin, teacher, student, or parent")
        return value


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_ROLES:
            raise ValueError("Role must be admin, teacher, student, or parent")
        return value


class AdminUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class PasswordResetRequest(BaseModel):
    new_password: str


class TeacherAssignmentCreate(BaseModel):
    class_id: int
    academic_year_id: int
    subject_id: Optional[int] = None


class TeacherAssignmentOut(BaseModel):
    id: int
    teacher_id: int
    class_id: int
    academic_year_id: int
    subject_id: Optional[int]

    model_config = {"from_attributes": True}


class PortalLinkRequest(BaseModel):
    user_id: int
    student_id: int
    role: str

    @field_validator("role")
    @classmethod
    def validate_portal_role(cls, value: str) -> str:
        if value not in {"student", "parent"}:
            raise ValueError("Role must be student or parent")
        return value


@router.post(
    "/users",
    response_model=AdminUserOut,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=data.role,
        is_active=data.is_active,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="User email already exists") from exc
    db.refresh(user)
    return user


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    return query.order_by(User.name).all()


@router.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="User email already exists") from exc
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password reset successfully"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    return {"message": "User deactivated successfully"}


@router.post(
    "/teachers/{teacher_id}/assign-class",
    response_model=TeacherAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
def assign_teacher_class(
    teacher_id: int,
    data: TeacherAssignmentCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    teacher = db.query(User).filter_by(id=teacher_id, role="teacher").first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher user not found")
    cls = db.query(Class).filter_by(id=data.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    year = db.query(AcademicYear).filter_by(id=data.academic_year_id).first()
    if not year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    if cls.academic_year_id and cls.academic_year_id != data.academic_year_id:
        raise HTTPException(
            status_code=422,
            detail="Assignment academic year must match the selected class",
        )
    if data.subject_id is not None:
        subject = db.query(Subject).filter_by(id=data.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        if subject.class_id != data.class_id:
            raise HTTPException(
                status_code=422,
                detail="Subject must belong to the selected class",
            )
    duplicate_query = db.query(TeacherClassAssignment).filter_by(
        teacher_id=teacher_id,
        class_id=data.class_id,
        academic_year_id=data.academic_year_id,
    )
    if data.subject_id is None:
        duplicate_query = duplicate_query.filter(TeacherClassAssignment.subject_id.is_(None))
    else:
        duplicate_query = duplicate_query.filter(TeacherClassAssignment.subject_id == data.subject_id)
    if duplicate_query.first():
        raise HTTPException(status_code=409, detail="Teacher assignment already exists")
    assignment = TeacherClassAssignment(
        teacher_id=teacher_id,
        class_id=data.class_id,
        academic_year_id=data.academic_year_id,
        subject_id=data.subject_id,
    )
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Teacher assignment already exists") from exc
    db.refresh(assignment)
    return assignment


@router.delete("/teachers/{teacher_id}/assign-class/{class_id}")
def remove_teacher_assignment(
    teacher_id: int,
    class_id: int,
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    query = db.query(TeacherClassAssignment).filter_by(
        teacher_id=teacher_id,
        class_id=class_id,
    )
    if subject_id is None:
        query = query.filter(TeacherClassAssignment.subject_id.is_(None))
    else:
        query = query.filter(TeacherClassAssignment.subject_id == subject_id)
    deleted = query.delete(synchronize_session=False)
    db.commit()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Teacher assignment not found")
    return {"message": "Assignment removed successfully"}


@router.get(
    "/teachers/{teacher_id}/assignments",
    response_model=list[TeacherAssignmentOut],
)
def list_teacher_assignments(
    teacher_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    return (
        db.query(TeacherClassAssignment)
        .filter_by(teacher_id=teacher_id)
        .order_by(TeacherClassAssignment.class_id)
        .all()
    )


@router.post("/portal/link-student")
def link_portal_user(
    data: PortalLinkRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    user = db.query(User).filter_by(id=data.user_id, role=data.role).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"{data.role.title()} user not found")
    student = db.query(Student).filter_by(id=data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if data.role == "student":
        student.student_user_id = user.id
    else:
        student.parent_user_id = user.id
    db.commit()
    return {"message": "Portal account linked successfully"}


@router.get("/portal/accounts", response_model=list[AdminUserOut])
def list_portal_accounts(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    return (
        db.query(User)
        .filter(User.role.in_(["student", "parent"]))
        .order_by(User.name)
        .all()
    )


# ─────────────────────────────────────────────────────────────────────────────
# Portal account auto-generation helpers
# ─────────────────────────────────────────────────────────────────────────────

class UnlinkedStudentItem(BaseModel):
    id: int
    student_id: str
    name_en: str
    class_id: Optional[int]
    has_student_account: bool
    has_parent_account: bool

    model_config = {"from_attributes": True}


class LinkStatusResponse(BaseModel):
    total_active_students: int
    students_with_portal_account: int
    students_without_portal_account: int
    students_with_parent_account: int
    students_without_parent_account: int
    unlinked_students: list[UnlinkedStudentItem]


class BulkGenerateRequest(BaseModel):
    academic_year_id: Optional[int] = None
    include_students: bool = True
    include_parents: bool = True


class BulkGenerateResult(BaseModel):
    student_accounts_created: int
    parent_accounts_created: int
    already_linked_students: int
    already_linked_parents: int
    errors: list[str]
    default_password_note: str


class SingleGenerateResult(BaseModel):
    student_account_created: bool
    parent_account_created: bool
    student_email: Optional[str]
    parent_email: Optional[str]
    default_password_note: str
    message: str


def _make_portal_email(prefix: str, student_id: str, domain: str) -> str:
    """
    Build a synthetic portal email that is unique per student.
    Example: student.sms.2026.001@portal.sms.local
    """
    normalized = student_id.lower().replace("-", ".")
    return f"{prefix}.{normalized}@{domain}"


def _unique_email(db: Session, base_email: str) -> str:
    """
    Return base_email if it is available, otherwise append an incrementing
    suffix until a free slot is found.  Stops at 99 to avoid infinite loops.
    """
    if not db.query(User).filter_by(email=base_email).first():
        return base_email
    local, domain = base_email.rsplit("@", 1)
    for i in range(2, 100):
        candidate = f"{local}.{i}@{domain}"
        if not db.query(User).filter_by(email=candidate).first():
            return candidate
    raise HTTPException(
        status_code=409,
        detail=f"Could not find a unique email starting from {base_email}",
    )


def _default_password(student: Student) -> str:
    """Return student DOB as DDMMYYYY — communicated to users by the school."""
    return student.dob.strftime("%d%m%Y")


def _create_and_link_student_account(db: Session, student: Student) -> Optional[str]:
    """
    Create a User account with role='student' and link it to the student.
    Returns the created email, or None if the student is already linked.
    """
    if student.student_user_id is not None:
        return None
    domain = settings.PORTAL_EMAIL_DOMAIN
    email = _unique_email(db, _make_portal_email("student", student.student_id, domain))
    user = User(
        name=student.name_en,
        email=email,
        password_hash=get_password_hash(_default_password(student)),
        role="student",
        is_active=True,
    )
    db.add(user)
    db.flush()  # get user.id without committing
    student.student_user_id = user.id
    return email


def _create_and_link_parent_account(db: Session, student: Student) -> Optional[str]:
    """
    Create a User account with role='parent' and link it to the student.
    Returns the created email, or None if already linked.

    Parent name defaults to father_name; falls back to student name with
    "Parent of" prefix so the admin can identify it in the user list.
    """
    if student.parent_user_id is not None:
        return None
    domain = settings.PORTAL_EMAIL_DOMAIN
    email = _unique_email(db, _make_portal_email("parent", student.student_id, domain))
    parent_name = student.father_name or f"Parent of {student.name_en}"
    user = User(
        name=parent_name,
        email=email,
        password_hash=get_password_hash(_default_password(student)),
        role="parent",
        is_active=True,
    )
    db.add(user)
    db.flush()
    student.parent_user_id = user.id
    return email


# ─────────────────────────────────────────────────────────────────────────────
# New endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/portal/link-status",
    response_model=LinkStatusResponse,
    summary="Get portal account linking statistics",
)
def get_link_status(
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Returns counts of active students with/without portal accounts, plus a
    list of unlinked students so the admin can act on them.
    """
    query = db.query(Student).filter(Student.status == StudentStatusEnum.Active)
    if academic_year_id:
        query = query.filter(Student.academic_year_id == academic_year_id)
    students = query.order_by(Student.name_en).all()

    total = len(students)
    with_student = sum(1 for s in students if s.student_user_id is not None)
    with_parent  = sum(1 for s in students if s.parent_user_id  is not None)

    unlinked = [
        UnlinkedStudentItem(
            id=s.id,
            student_id=s.student_id,
            name_en=s.name_en,
            class_id=s.class_id,
            has_student_account=s.student_user_id is not None,
            has_parent_account=s.parent_user_id  is not None,
        )
        for s in students
        if s.student_user_id is None or s.parent_user_id is None
    ]

    return LinkStatusResponse(
        total_active_students=total,
        students_with_portal_account=with_student,
        students_without_portal_account=total - with_student,
        students_with_parent_account=with_parent,
        students_without_parent_account=total - with_parent,
        unlinked_students=unlinked,
    )


@router.post(
    "/portal/bulk-generate",
    response_model=BulkGenerateResult,
    summary="Bulk-generate missing portal accounts for all active students",
)
def bulk_generate_portal_accounts(
    data: BulkGenerateRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Finds every active student that is missing a student and/or parent portal
    account, creates those User accounts, and auto-links them.

    - Email format: ``student.sms.2026.001@<PORTAL_EMAIL_DOMAIN>``
    - Default password: student's DOB in DDMMYYYY format
    - Idempotent: already-linked students are skipped, not duplicated
    - Optionally filter by academic_year_id
    """
    query = db.query(Student).filter(Student.status == StudentStatusEnum.Active)
    if data.academic_year_id:
        query = query.filter(Student.academic_year_id == data.academic_year_id)
    students = query.order_by(Student.id).all()

    result = BulkGenerateResult(
        student_accounts_created=0,
        parent_accounts_created=0,
        already_linked_students=0,
        already_linked_parents=0,
        errors=[],
        default_password_note=(
            "Default password is the student's date of birth in DDMMYYYY format "
            "(e.g. 15082010 for 15 Aug 2010). Admins should communicate this to users."
        ),
    )

    for student in students:
        try:
            if data.include_students:
                email = _create_and_link_student_account(db, student)
                if email:
                    result.student_accounts_created += 1
                else:
                    result.already_linked_students += 1

            if data.include_parents:
                email = _create_and_link_parent_account(db, student)
                if email:
                    result.parent_accounts_created += 1
                else:
                    result.already_linked_parents += 1

            db.commit()

        except HTTPException as exc:
            db.rollback()
            result.errors.append(
                f"Student {student.student_id} ({student.name_en}): {exc.detail}"
            )
        except IntegrityError as exc:
            db.rollback()
            result.errors.append(
                f"Student {student.student_id} ({student.name_en}): DB error — {exc.orig}"
            )

    return result


@router.post(
    "/portal/generate/{student_id}",
    response_model=SingleGenerateResult,
    summary="Generate missing portal accounts for one student",
)
def generate_portal_accounts_for_student(
    student_id: int,
    include_students: bool = Query(True),
    include_parents: bool = Query(True),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Creates missing student and/or parent portal accounts for a single
    student record and auto-links them.  Same email and password rules as
    bulk-generate.
    """
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student_email: Optional[str] = None
    parent_email:  Optional[str] = None
    student_created = False
    parent_created  = False

    try:
        if include_students:
            student_email = _create_and_link_student_account(db, student)
            student_created = student_email is not None

        if include_parents:
            parent_email = _create_and_link_parent_account(db, student)
            parent_created = parent_email is not None

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc.orig)) from exc

    parts = []
    if student_created:
        parts.append(f"student account created ({student_email})")
    if parent_created:
        parts.append(f"parent account created ({parent_email})")
    if not student_created and not parent_created:
        parts.append("all requested accounts already exist")

    return SingleGenerateResult(
        student_account_created=student_created,
        parent_account_created=parent_created,
        student_email=student_email or (
            db.query(User).filter_by(id=student.student_user_id).first().email
            if student.student_user_id
            else None
        ),
        parent_email=parent_email or (
            db.query(User).filter_by(id=student.parent_user_id).first().email
            if student.parent_user_id
            else None
        ),
        default_password_note=(
            "Default password is the student's date of birth in DDMMYYYY format "
            "(e.g. 15082010 for 15 Aug 2010)."
        ),
        message="; ".join(parts).capitalize() + ".",
    )

