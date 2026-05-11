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
import hashlib
import hmac
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator
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
from app.models.base_models import AdminLoginOTPChallenge, Student, TeacherClassAssignment, TokenBlocklist, User
from app.services.notification_service import notification_service

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# STEP 4.5: Rate limiter — max 10 login attempts per minute per IP.
# The Limiter is created here and attached to app in main.py.
limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------------------------
# Pydantic schemas (auth-specific, kept here to avoid circular imports)
# ---------------------------------------------------------------------------

class Token(BaseModel):
    requires_2fa: bool = False
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

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


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
    two_factor_enabled: bool = False
    two_factor_channel: str | None = None
    two_factor_destination: str | None = None

    model_config = {"from_attributes": True}


class LoginChallengeResponse(BaseModel):
    requires_2fa: bool = True
    challenge_id: str
    expires_in_seconds: int
    channel: str


class LoginResponse(BaseModel):
    requires_2fa: bool = False
    access_token: str | None = None
    token_type: str = "bearer"
    user_id: int | None = None
    user_name: str | None = None
    role: str | None = None
    assigned_class_ids: list[int] = []
    class_teacher_class_ids: list[int] = []
    subject_assignments: list[dict] = []
    linked_student_id: int | None = None
    linked_student_ids: list[int] = []
    challenge_id: str | None = None
    expires_in_seconds: int | None = None
    channel: str | None = None


class Verify2FARequest(BaseModel):
    challenge_id: str
    otp: str


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
    two_factor_enabled: bool = False
    two_factor_channel: str | None = None
    two_factor_destination: str | None = None


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
        two_factor_enabled=bool(user.two_factor_enabled),
        two_factor_channel=user.two_factor_channel,
        two_factor_destination=user.two_factor_destination,
    )


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _hash_login_otp(challenge_id: str, otp: str) -> str:
    material = f"{challenge_id}:{otp}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), material, hashlib.sha256).hexdigest()


def _create_admin_2fa_challenge(db: Session, user: User) -> LoginChallengeResponse:
    channel = (user.two_factor_channel or "whatsapp").lower()
    if channel not in {"whatsapp", "sms"}:
        raise HTTPException(status_code=422, detail="Invalid admin 2FA channel. Use whatsapp or sms.")
    destination = (user.two_factor_destination or "").strip()
    if not destination:
        raise HTTPException(status_code=422, detail="Admin 2FA destination is not configured.")

    challenge_id = str(uuid.uuid4())
    otp = f"{secrets.randbelow(1_000_000):06d}"
    challenge = AdminLoginOTPChallenge(
        challenge_id=challenge_id,
        user_id=user.id,
        channel=channel,
        destination=destination,
        otp_hash=_hash_login_otp(challenge_id, otp),
        expires_at=_utcnow() + timedelta(minutes=settings.LOGIN_2FA_OTP_EXPIRE_MINUTES),
        max_attempts=settings.LOGIN_2FA_MAX_ATTEMPTS,
    )
    db.add(challenge)
    notification_service.enqueue_otp(
        db,
        channel,
        destination,
        otp,
        {
            "template_name": "admin_login_otp",
            "params": [otp],
            "account_type": "admin",
            "name": user.name,
            "message_type": "template",
        },
    )
    db.commit()
    return LoginChallengeResponse(
        challenge_id=challenge_id,
        expires_in_seconds=settings.LOGIN_2FA_OTP_EXPIRE_MINUTES * 60,
        channel=channel,
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
        if payload.get("purpose") not in (None, "access"):
            raise ValueError("Unsupported token purpose")
        user_id  = int(payload.get("sub"))
        jti      = payload.get("jti")
    except Exception:
        raise credentials_exception

    # STEP 4.7: Reject tokens whose jti has been revoked (logged out).
    if jti and db.query(TokenBlocklist.id).filter_by(jti=jti).first():
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

@router.post("/login", response_model=LoginResponse, summary="Login and receive a JWT token")
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

    if user.role == "admin" and user.two_factor_enabled:
        challenge = _create_admin_2fa_challenge(db, user)
        return LoginResponse(
            requires_2fa=True,
            challenge_id=challenge.challenge_id,
            expires_in_seconds=challenge.expires_in_seconds,
            channel=challenge.channel,
        )

    token = create_access_token(
        subject=user.id,
        role=user.role,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    current_user = build_current_user(db, user)
    return LoginResponse(
        requires_2fa=False,
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


@router.post("/verify-2fa", response_model=Token, summary="Verify admin login OTP and issue JWT")
@limiter.limit("10/minute")
def verify_login_2fa(
    request: Request,
    data: Verify2FARequest,
    db: Session = Depends(get_db),
):
    challenge = (
        db.query(AdminLoginOTPChallenge)
        .filter_by(challenge_id=data.challenge_id)
        .first()
    )
    now = _utcnow()
    if not challenge or challenge.verified_at is not None or _as_utc(challenge.expires_at) <= now:
        raise HTTPException(status_code=400, detail="2FA challenge expired. Please login again.")
    if challenge.attempt_count >= challenge.max_attempts:
        raise HTTPException(status_code=429, detail="Too many OTP attempts. Please login again.")

    challenge.attempt_count += 1
    expected = _hash_login_otp(challenge.challenge_id, data.otp.strip())
    if not hmac.compare_digest(challenge.otp_hash, expected):
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user = db.query(User).filter_by(id=challenge.user_id, is_active=True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    challenge.verified_at = now
    db.commit()

    token = create_access_token(
        subject=user.id,
        role=user.role,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    current_user = build_current_user(db, user)
    return Token(
        requires_2fa=False,
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

    if data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only admin role can be created via this bootstrap endpoint.",
        )

    if db.query(User.id).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Registration bootstrap is allowed only when no users exist. "
                "Use admin user management endpoints after initial setup."
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
