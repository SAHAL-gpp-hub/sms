"""
app/routers/auth.py

SECURITY RISK 1 FIX: Login endpoint that issues JWT access tokens.
Previously the User model existed with password_hash and role columns
but there was no login route, no token issuance, and no middleware —
every single endpoint was open to the network with no authentication.

Endpoints:
  POST /api/v1/auth/login    → { access_token, token_type }
  POST /api/v1/auth/register → create a new admin user (guarded by REGISTRATION_ENABLED)
  POST /api/v1/auth/logout   → revoke the current token (jti added to blocklist)
  GET  /api/v1/auth/me       → return current user info (requires token)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.models.base_models import Student, TeacherClassAssignment, TokenBlocklist, User

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# STEP 4.5: Rate limiter — max 10 login attempts per minute per IP.
# The Limiter is created here and attached to app in main.py.
limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------------------------
# Pydantic schemas (auth-specific, kept here to avoid circular imports)
# ---------------------------------------------------------------------------

class Token(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      int
    user_name:    str
    role:         str
    assigned_class_ids: list[int] = []
    class_teacher_class_ids: list[int] = []
    subject_assignments: list[dict] = []
    linked_student_id: int | None = None
    linked_student_ids: list[int] = []


class UserRegister(BaseModel):
    name:     str
    email:    EmailStr
    password: str
    role:     str = "admin"


class UserOut(BaseModel):
    id:       int
    name:     str
    email:    str
    role:     str
    is_active: bool
    assigned_class_ids: list[int] = []
    class_teacher_class_ids: list[int] = []
    subject_assignments: list[dict] = []
    linked_student_id: int | None = None
    linked_student_ids: list[int] = []

    model_config = {"from_attributes": True}


@dataclass
class CurrentUser:
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    assigned_class_ids: list[int] = field(default_factory=list)
    class_teacher_class_ids: list[int] = field(default_factory=list)
    subject_assignments: list[dict] = field(default_factory=list)
    linked_student_id: int | None = None
    linked_student_ids: list[int] = field(default_factory=list)


def build_current_user(db: Session, user: User) -> CurrentUser:
    assigned_class_ids: list[int] = []
    class_teacher_class_ids: list[int] = []
    subject_assignments: list[dict] = []
    linked_student_id = None
    linked_student_ids: list[int] = []

    if user.role == "teacher":
        assignments = (
            db.query(TeacherClassAssignment)
            .filter_by(teacher_id=user.id)
            .all()
        )
        assigned_class_ids = sorted({a.class_id for a in assignments})
        class_teacher_class_ids = sorted({a.class_id for a in assignments if a.subject_id is None})
        subject_assignments = [
            {
                "class_id": a.class_id,
                "academic_year_id": a.academic_year_id,
                "subject_id": a.subject_id,
            }
            for a in assignments
            if a.subject_id is not None
        ]
    elif user.role == "student":
        student = db.query(Student).filter_by(student_user_id=user.id).first()
        if student:
            linked_student_id = student.id
    elif user.role == "parent":
        students = db.query(Student).filter_by(parent_user_id=user.id).all()
        linked_student_ids = [s.id for s in students]

    return CurrentUser(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        assigned_class_ids=assigned_class_ids,
        class_teacher_class_ids=class_teacher_class_ids,
        subject_assignments=subject_assignments,
        linked_student_id=linked_student_id,
        linked_student_ids=linked_student_ids,
    )


# ---------------------------------------------------------------------------
# Dependency: get the current authenticated user from the token
# ---------------------------------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db),
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload  = decode_access_token(token)
        user_id  = int(payload.get("sub"))
        jti      = payload.get("jti")
    except Exception:
        raise credentials_exception

    # STEP 4.7: Reject tokens whose jti has been revoked (logged out).
    if jti and db.query(TokenBlocklist).filter_by(jti=jti).first():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter_by(id=user_id, is_active=True).first()
    if user is None:
        raise credentials_exception
    return build_current_user(db, user)


def require_role(*allowed_roles: str):
    def dep(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Access denied. Required roles: "
                    f"{', '.join(allowed_roles)}. Your role: {current_user.role}"
                ),
            )
        return current_user

    return dep


def ensure_class_access(current_user: CurrentUser, class_id: int | None) -> None:
    if current_user.role == "teacher" and class_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="class_id is required for teacher role",
        )
    if current_user.role == "teacher" and class_id not in current_user.assigned_class_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this class",
        )


def ensure_class_teacher_access(current_user: CurrentUser, class_id: int | None) -> None:
    if current_user.role == "teacher" and class_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="class_id is required for teacher role",
        )
    if current_user.role == "teacher" and class_id not in current_user.class_teacher_class_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the class teacher can manage attendance for this class",
        )


def ensure_subject_assignment_access(
    current_user: CurrentUser,
    class_id: int | None,
    subject_id: int | None,
) -> None:
    if current_user.role != "teacher":
        return
    if not any(
        a.get("class_id") == class_id and a.get("subject_id") == subject_id
        for a in current_user.subject_assignments
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this subject for this class",
        )


def ensure_student_access(db: Session, current_user: CurrentUser, student_id: int) -> Student:
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    if current_user.role == "admin":
        return student
    if current_user.role == "teacher":
        ensure_class_access(current_user, student.class_id)
        return student
    if current_user.role == "student" and current_user.linked_student_id == student_id:
        return student
    if current_user.role == "parent" and student_id in current_user.linked_student_ids:
        return student

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this student",
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login", response_model=Token, summary="Login and receive a JWT token")
@limiter.limit("10/minute")  # STEP 4.5: Brute-force protection
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Accepts username (email) + password via standard OAuth2 password form.
    Returns a JWT Bearer token valid for ACCESS_TOKEN_EXPIRE_MINUTES.
    Rate-limited to 10 attempts per minute per IP.
    """
    user = db.query(User).filter_by(email=form_data.username, is_active=True).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    db.query(TokenBlocklist).filter(TokenBlocklist.expires_at < datetime.now(timezone.utc)).delete()

    token = create_access_token(
        subject=user.id,
        role=user.role,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    current_user = build_current_user(db, user)
    return Token(
        access_token=token,
        user_id=user.id,
        user_name=user.name,
        role=user.role,
        assigned_class_ids=current_user.assigned_class_ids,
        class_teacher_class_ids=current_user.class_teacher_class_ids,
        subject_assignments=current_user.subject_assignments,
        linked_student_id=current_user.linked_student_id,
        linked_student_ids=current_user.linked_student_ids,
    )


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new admin user (first-run setup only)",
)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Create the first admin account.

    STEP 1.2 FIX: Guarded by the REGISTRATION_ENABLED setting (default false).
    Set REGISTRATION_ENABLED=true in .env only during first-run setup, then
    disable immediately after creating the initial admin account.
    """
    if not settings.REGISTRATION_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Registration is disabled. "
                "Set REGISTRATION_ENABLED=true in .env for first-run setup only."
            ),
        )

    existing = db.query(User).filter_by(email=data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{data.email}' already exists",
        )

    user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=data.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/register-status", summary="Registration UI status")
def register_status(db: Session = Depends(get_db)):
    return {
        "enabled": settings.REGISTRATION_ENABLED,
        "has_users": db.query(User.id).first() is not None,
    }


@router.post("/logout", summary="Revoke the current access token")
def logout(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db),
):
    """
    STEP 4.7: Add the token's jti to the blocklist so it can no longer be used,
    even if it hasn't expired yet. Clients should discard the token locally too.
    """
    try:
        payload = decode_access_token(token)
        jti = payload.get("jti")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if not jti:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token does not contain a jti claim and cannot be revoked.",
        )

    exp = payload.get("exp")
    expires_at = (
        datetime.fromtimestamp(exp, tz=timezone.utc)
        if isinstance(exp, (int, float))
        else datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    if not db.query(TokenBlocklist).filter_by(jti=jti).first():
        db.add(TokenBlocklist(jti=jti, expires_at=expires_at))
        db.commit()

    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserOut, summary="Get current user info")
def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user
