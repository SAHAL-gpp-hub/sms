from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.base_models import AcademicYear, Branch, Class, CorrectionRequestStatusEnum, DataAuditActionEnum, NotificationOutbox, ProfileCorrectionRequest, Student, StudentActivationRequest, StudentStatusEnum, Subject, TeacherClassAssignment, User
from app.routers.auth import CurrentUser, require_role
from app.services.audit_service import log_data_change, model_snapshot
from app.services import student_activation_service


router = APIRouter(prefix="/api/v1/admin", tags=["Admin Users"])

VALID_ROLES = {"admin", "teacher", "student", "parent"}
CORRECTION_FIELDS = {
    "name_en", "name_gu", "dob", "contact", "address",
    "father_name", "mother_name", "guardian_email", "guardian_phone",
}


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: str
    is_active: bool = True
    branch_id: Optional[int] = None

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
    branch_id: Optional[int] = None

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
    branch_id: Optional[int] = None
    two_factor_enabled: bool = False
    two_factor_channel: Optional[str] = None
    two_factor_destination: Optional[str] = None


class CorrectionResolveRequest(BaseModel):
    status: str
    admin_note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in {"approved", "rejected"}:
            raise ValueError("Status must be approved or rejected")
        return value

    model_config = {"from_attributes": True}


class PasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=8)


class AdminTwoFactorUpdate(BaseModel):
    enabled: bool
    channel: Optional[str] = None
    destination: Optional[str] = None

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.lower().strip()
        if value not in {"whatsapp", "sms"}:
            raise ValueError("channel must be whatsapp or sms")
        return value


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


class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    gseb_affiliation_no: Optional[str] = None
    is_active: bool = True


class BranchOut(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    gseb_affiliation_no: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


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
    if data.role == "admin":
        raise HTTPException(status_code=403, detail="Use the bootstrap or a dedicated privilege workflow to create admins")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=data.role,
        is_active=data.is_active,
        branch_id=data.branch_id if data.branch_id is not None else settings.DEFAULT_BRANCH_ID,
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
    current_user: CurrentUser = Depends(require_role("admin")),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = data.model_dump(exclude_unset=True)
    if "role" in updates and updates["role"] != user.role:
        if user.role == "admin":
            raise HTTPException(status_code=403, detail="Admin roles cannot be changed through this endpoint")
        if updates["role"] == "admin":
            raise HTTPException(status_code=403, detail="Use a dedicated privilege workflow to create admins")
        if user.id == current_user.id:
            raise HTTPException(status_code=403, detail="You cannot change your own role")

    for key, value in updates.items():
        setattr(user, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="User email already exists") from exc
    db.refresh(user)
    return user


@router.put("/users/{user_id}/2fa", response_model=AdminUserOut)
def update_user_2fa(
    user_id: int,
    data: AdminTwoFactorUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "admin":
        raise HTTPException(status_code=422, detail="2FA settings are only available for admin users")

    user.two_factor_enabled = data.enabled
    if data.enabled:
        if not data.channel or not data.destination:
            raise HTTPException(status_code=422, detail="channel and destination are required when enabling 2FA")
        user.two_factor_channel = data.channel
        user.two_factor_destination = data.destination.strip()
    else:
        user.two_factor_channel = None
        user.two_factor_destination = None
    db.commit()
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
    has_student_email: bool = False
    has_guardian_email: bool = False
    student_activation_status: Optional[str] = None
    parent_activation_status: Optional[str] = None
    failed_activation_attempts: int = 0
    last_activation_sent_at: Optional[str] = None

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


class SingleGenerateResult(BaseModel):
    student_account_created: bool
    parent_account_created: bool
    student_email: Optional[str]
    parent_email: Optional[str]
    message: str


class AdminActivationResendRequest(BaseModel):
    account_type: str

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, value: str) -> str:
        if value not in {"student", "parent"}:
            raise ValueError("Account type must be student or parent")
        return value


class AdminActivationInviteResponse(BaseModel):
    invite_id: str
    account_type: str
    destination: str
    expires_at: datetime
    invite_url: str
    qr_payload: str


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
    with_parent = sum(1 for s in students if s.parent_user_id is not None)
    activation_rows = (
        db.query(StudentActivationRequest)
        .filter(StudentActivationRequest.student_id.in_([s.id for s in students]))
        .order_by(StudentActivationRequest.created_at.desc())
        .all()
        if students
        else []
    )
    latest_by_student_type: dict[tuple[int, str], StudentActivationRequest] = {}
    failed_by_student: dict[int, int] = {}
    for row in activation_rows:
        latest_by_student_type.setdefault((row.student_id, row.account_type), row)
        if row.status in {"failed", "locked"}:
            failed_by_student[row.student_id] = failed_by_student.get(row.student_id, 0) + 1
    def latest_sent_at(student_id: int) -> Optional[str]:
        values = [
            row.created_at
            for row in (
                latest_by_student_type.get((student_id, "student")),
                latest_by_student_type.get((student_id, "parent")),
            )
            if row is not None and row.created_at is not None
        ]
        latest = max(values) if values else None
        return latest.isoformat() if latest else None

    unlinked = [
        UnlinkedStudentItem(
            id=s.id,
            student_id=s.student_id,
            name_en=s.name_en,
            class_id=s.class_id,
            has_student_account=s.student_user_id is not None,
            has_parent_account=s.parent_user_id is not None,
            has_student_email=bool(s.student_email),
            has_guardian_email=bool(s.guardian_email),
            student_activation_status=(
                latest_by_student_type.get((s.id, "student")).status
                if latest_by_student_type.get((s.id, "student"))
                else None
            ),
            parent_activation_status=(
                latest_by_student_type.get((s.id, "parent")).status
                if latest_by_student_type.get((s.id, "parent"))
                else None
            ),
            failed_activation_attempts=failed_by_student.get(s.id, 0),
            last_activation_sent_at=latest_sent_at(s.id),
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
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Portal account auto-generation is deprecated. Use activation emails instead.",
    )


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
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Portal account auto-generation is deprecated. Send an activation email instead.",
    )


@router.post(
    "/portal/resend-activation/{student_id}",
    summary="Send an activation OTP to a student or parent contact",
)
def resend_activation_for_student(
    student_id: int,
    data: AdminActivationResendRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    email = student.student_email if data.account_type == "student" else student.guardian_email
    if not email:
        raise HTTPException(status_code=422, detail=f"{data.account_type.title()} email is missing for this student")
    return student_activation_service.start_activation(
        db,
        student.student_id,
        email,
        data.account_type,
        None,
        "admin-resend",
    )


@router.post(
    "/portal/invite/{student_id}",
    response_model=AdminActivationInviteResponse,
    summary="Create and send an invite-link activation for one student or parent",
)
def create_activation_invite_for_student(
    student_id: int,
    data: AdminActivationResendRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student_activation_service.create_activation_invite(
        db,
        student,
        data.account_type,
        current_user.id,
    )


# ─────────────────────────────────────────────────────────────────────────────
# OTP / Notification outbox debug
# ─────────────────────────────────────────────────────────────────────────────

class OtpOutboxItem(BaseModel):
    id: int
    provider: str
    destination: str
    status: str
    attempts: int
    max_attempts: int
    last_error: Optional[str]
    payload: Optional[dict]
    created_at: Optional[str]
    next_attempt_at: Optional[str]
    sent_at: Optional[str]

    model_config = {"from_attributes": True}


class OtpOutboxResponse(BaseModel):
    total: int
    items: list[OtpOutboxItem]


@router.get(
    "/notifications/otp-failures",
    response_model=OtpOutboxResponse,
    summary="List recent OTP notification failures for SMTP debugging",
)
def list_otp_failures(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter by outbox status: failed, retry, pending, sent. Defaults to failed and retry.",
    ),
    limit: int = Query(50, ge=1, le=200, description="Max number of records to return"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Returns recent OTP notification outbox entries for diagnosing delivery
    failures.  By default returns items with status ``failed`` or ``retry``;
    pass ``?status=sent`` to verify successful deliveries, or ``?status=pending``
    to see items still queued.
    """
    if status_filter:
        valid_statuses = {"failed", "retry", "pending", "sent", "sending"}
        if status_filter not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"status must be one of: {', '.join(sorted(valid_statuses))}",
            )
        statuses = [status_filter]
    else:
        statuses = ["failed", "retry"]

    rows = (
        db.query(NotificationOutbox)
        .filter(NotificationOutbox.status.in_(statuses))
        .order_by(NotificationOutbox.created_at.desc())
        .limit(limit)
        .all()
    )
    items = [
        OtpOutboxItem(
            id=row.id,
            provider=row.provider,
            destination=row.destination,
            status=row.status,
            attempts=row.attempts,
            max_attempts=row.max_attempts,
            last_error=row.last_error,
            payload=row.payload,
            created_at=row.created_at.isoformat() if row.created_at else None,
            next_attempt_at=row.next_attempt_at.isoformat() if row.next_attempt_at else None,
            sent_at=row.sent_at.isoformat() if row.sent_at else None,
        )
        for row in rows
    ]
    return OtpOutboxResponse(total=len(items), items=items)


@router.get("/branches", response_model=list[BranchOut])
def list_branches(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    query = db.query(Branch)
    if not include_inactive:
        query = query.filter(Branch.is_active == True)  # noqa: E712
    return query.order_by(Branch.id).all()


@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(
    data: BranchCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    existing = db.query(Branch).filter(Branch.name.ilike(data.name.strip())).first()
    if existing:
        raise HTTPException(status_code=409, detail="Branch with this name already exists")
    branch = Branch(**data.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.get("/correction-requests")
def list_correction_requests(
    status_filter: Optional[str] = Query("pending", alias="status"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    query = db.query(ProfileCorrectionRequest, Student).join(Student, Student.id == ProfileCorrectionRequest.student_id)
    if status_filter:
        query = query.filter(ProfileCorrectionRequest.status == status_filter)
    rows = query.order_by(ProfileCorrectionRequest.created_at.desc()).limit(200).all()
    return [
        {
            "id": req.id,
            "student_id": req.student_id,
            "student_name": student.name_en,
            "field_name": req.field_name,
            "current_value": req.current_value,
            "requested_value": req.requested_value,
            "reason": req.reason,
            "status": req.status,
            "admin_note": req.admin_note,
            "created_at": req.created_at,
            "resolved_at": req.resolved_at,
        }
        for req, student in rows
    ]


@router.patch("/correction-requests/{request_id}")
def resolve_correction_request(
    request_id: int,
    data: CorrectionResolveRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    req = db.query(ProfileCorrectionRequest).filter_by(id=request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Correction request not found")
    if req.status != CorrectionRequestStatusEnum.pending:
        raise HTTPException(status_code=409, detail="Correction request is already resolved")
    student = db.query(Student).filter_by(id=req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    old_req = {
        "status": req.status,
        "field_name": req.field_name,
        "current_value": req.current_value,
        "requested_value": req.requested_value,
    }
    if data.status == "approved":
        if req.field_name not in CORRECTION_FIELDS:
            raise HTTPException(status_code=422, detail="This field cannot be applied")
        old_student = model_snapshot(student)
        value = req.requested_value
        if req.field_name == "dob":
            try:
                value = date.fromisoformat(req.requested_value)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail="Date of birth must use YYYY-MM-DD") from exc
        setattr(student, req.field_name, value)
        log_data_change(
            db,
            user_id=current_user.id,
            action=DataAuditActionEnum.update,
            table_name="students",
            record_id=student.id,
            old_value=old_student,
            new_value=model_snapshot(student),
        )
        req.status = CorrectionRequestStatusEnum.approved
    else:
        req.status = CorrectionRequestStatusEnum.rejected

    req.admin_note = data.admin_note
    req.resolved_by_user_id = current_user.id
    req.resolved_at = datetime.now(timezone.utc)
    log_data_change(
        db,
        user_id=current_user.id,
        action=DataAuditActionEnum.update,
        table_name="profile_correction_requests",
        record_id=req.id,
        old_value=old_req,
        new_value={
            "status": req.status,
            "admin_note": req.admin_note,
            "resolved_by_user_id": req.resolved_by_user_id,
        },
    )
    db.commit()
    db.refresh(req)
    return {"id": req.id, "status": req.status, "resolved_at": req.resolved_at}
