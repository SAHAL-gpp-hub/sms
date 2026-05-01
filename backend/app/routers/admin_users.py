from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.base_models import Student, TeacherClassAssignment, User
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
    if subject_id is not None:
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
