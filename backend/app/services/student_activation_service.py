import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, get_password_hash
from app.models.base_models import (
    AuditLog,
    AuditOperationEnum,
    ActivationInviteStatusEnum,
    NotificationOutbox,
    OTPVerification,
    PortalActivationInvite,
    Student,
    StudentActivationRequest,
    StudentStatusEnum,
    User,
)
from app.routers.auth import Token, build_current_user
from app.services.notification_service import notification_service

GENERIC_START_MESSAGE = (
    "If the details match our admission records, an activation code will be sent."
)


def normalize_email(value: str) -> str:
    return value.strip().lower()


def fingerprint(value: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        normalize_email(value).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def hash_otp(activation_id: str, otp: str) -> str:
    material = f"{activation_id}:{otp}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), material, hashlib.sha256).hexdigest()


def hash_invite_token(raw_token: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        raw_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _audit(
    db: Session,
    operation: AuditOperationEnum,
    student_id: int | None,
    result: str = "success",
    error_detail: str | None = None,
    payload: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            operation=operation,
            affected_count=1 if student_id else 0,
            result=result,
            error_detail=error_detail,
            payload=json.dumps(payload or {}, default=str),
        )
    )


def _find_student(db: Session, identifier: str, email: str, account_type: str) -> Student | None:
    normalized_identifier = identifier.strip()
    identifier_candidates = {
        normalized_identifier,
        normalized_identifier.upper(),
        normalized_identifier.lower(),
    }
    normalized_email = normalize_email(email)
    query = db.query(Student).filter(
        Student.status == StudentStatusEnum.Active,
        or_(
            Student.student_id.in_(identifier_candidates),
            Student.gr_number.in_(identifier_candidates),
        ),
    )
    if account_type == "student":
        query = query.filter(func.lower(Student.student_email) == normalized_email)
    else:
        query = query.filter(func.lower(Student.guardian_email) == normalized_email)
    return query.first()


def _activation_allowed(student: Student, account_type: str) -> bool:
    if account_type == "student":
        return student.student_user_id is None
    return student.parent_user_id is None


def _destination_for(student: Student, account_type: str) -> str | None:
    return student.student_email if account_type == "student" else student.guardian_email


def _latest_otp(db: Session, request_id: int) -> OTPVerification | None:
    return (
        db.query(OTPVerification)
        .filter_by(activation_request_id=request_id)
        .order_by(OTPVerification.id.desc())
        .first()
    )


def _enqueue_otp(db: Session, activation: StudentActivationRequest, student: Student) -> OTPVerification:
    now = _utcnow()
    otp = generate_otp()
    verification = OTPVerification(
        activation_request_id=activation.id,
        provider="email",
        destination_fingerprint=activation.destination_fingerprint,
        otp_hash=hash_otp(activation.activation_id, otp),
        expires_at=now + timedelta(minutes=settings.ACTIVATION_OTP_EXPIRE_MINUTES),
        max_attempts=settings.ACTIVATION_MAX_OTP_ATTEMPTS,
        resend_available_at=now + timedelta(seconds=settings.ACTIVATION_RESEND_COOLDOWN_SECONDS),
    )
    db.add(verification)
    activation.resend_count += 1
    notification_service.enqueue_otp(
        db,
        "email",
        activation.destination,
        otp,
        {
            "activation_id": activation.activation_id,
            "account_type": activation.account_type,
            "student_id": student.student_id,
            "name": student.name_en,
        },
    )
    return verification


def start_activation(
    db: Session,
    identifier: str,
    email: str,
    account_type: str,
    request_ip: str | None,
    user_agent: str | None,
) -> dict:
    now = _utcnow()
    generic_activation_id = str(uuid.uuid4())
    student = _find_student(db, identifier, email, account_type)
    if not student or not _activation_allowed(student, account_type):
        return {
            "message": GENERIC_START_MESSAGE,
            "activation_id": generic_activation_id,
            "expires_at": now + timedelta(minutes=settings.ACTIVATION_REQUEST_EXPIRE_MINUTES),
            "resend_available_at": now + timedelta(seconds=settings.ACTIVATION_RESEND_COOLDOWN_SECONDS),
        }

    destination = normalize_email(email)
    destination_fingerprint = fingerprint(destination)
    activation = (
        db.query(StudentActivationRequest)
        .filter(
            StudentActivationRequest.student_id == student.id,
            StudentActivationRequest.account_type == account_type,
            StudentActivationRequest.destination_fingerprint == destination_fingerprint,
            StudentActivationRequest.status.in_(["pending", "verified"]),
            StudentActivationRequest.expires_at > now,
        )
        .order_by(StudentActivationRequest.id.desc())
        .first()
    )
    if activation is None:
        activation = StudentActivationRequest(
            activation_id=str(uuid.uuid4()),
            student_id=student.id,
            account_type=account_type,
            destination=destination,
            destination_fingerprint=destination_fingerprint,
            expires_at=now + timedelta(minutes=settings.ACTIVATION_REQUEST_EXPIRE_MINUTES),
            request_ip=request_ip,
            user_agent=(user_agent or "")[:255] or None,
        )
        db.add(activation)
        db.flush()

    latest = _latest_otp(db, activation.id)
    if latest and _as_utc(latest.resend_available_at) > now:
        db.commit()
        return {
            "message": GENERIC_START_MESSAGE,
            "activation_id": activation.activation_id,
            "expires_at": activation.expires_at,
            "resend_available_at": latest.resend_available_at,
        }

    if activation.resend_count >= settings.ACTIVATION_MAX_RESENDS:
        activation.status = "locked"
        activation.locked_until = now + timedelta(minutes=30)
        _audit(
            db,
            AuditOperationEnum.student_activation_failed,
            student.id,
            result="failed",
            error_detail="resend limit exceeded",
            payload={"account_type": account_type},
        )
        db.commit()
        return {
            "message": GENERIC_START_MESSAGE,
            "activation_id": activation.activation_id,
            "expires_at": activation.expires_at,
            "resend_available_at": now + timedelta(minutes=30),
        }

    verification = _enqueue_otp(db, activation, student)
    _audit(
        db,
        AuditOperationEnum.student_activation_started,
        student.id,
        payload={"account_type": account_type, "activation_id": activation.activation_id},
    )
    db.commit()
    return {
        "message": GENERIC_START_MESSAGE,
        "activation_id": activation.activation_id,
        "expires_at": activation.expires_at,
        "resend_available_at": verification.resend_available_at,
    }


def create_activation_invite(
    db: Session,
    student: Student,
    account_type: str,
    created_by_user_id: int | None,
) -> dict:
    if account_type not in {"student", "parent"}:
        raise HTTPException(status_code=422, detail="Account type must be student or parent")
    if not _activation_allowed(student, account_type):
        raise HTTPException(status_code=409, detail=f"{account_type.title()} account is already activated.")
    destination = _destination_for(student, account_type)
    if not destination:
        raise HTTPException(status_code=422, detail=f"{account_type.title()} email is missing for this student")

    now = _utcnow()
    raw_token = secrets.token_urlsafe(32)
    invite = PortalActivationInvite(
        invite_id=str(uuid.uuid4()),
        token_hash=hash_invite_token(raw_token),
        student_id=student.id,
        account_type=account_type,
        destination=normalize_email(destination),
        created_by_user_id=created_by_user_id,
        expires_at=now + timedelta(days=7),
    )
    db.add(invite)
    portal_base = settings.PORTAL_PUBLIC_URL.rstrip("/")
    if portal_base.endswith("/portal"):
        portal_base = portal_base[:-7]
    invite_url = f"{portal_base}/activate-account?invite={raw_token}"
    db.add(NotificationOutbox(
        provider="email",
        destination=invite.destination,
        subject="Activate your school portal account",
        body=(
            f"Hello {student.name_en},\n\n"
            "Use this secure link to activate your school portal account:\n"
            f"{invite_url}\n\n"
            "The link expires in 7 days. If you did not expect this, contact the school office."
        ),
        payload={
            "invite_id": invite.invite_id,
            "account_type": account_type,
            "student_id": student.student_id,
            "invite_url": invite_url,
        },
    ))
    db.commit()
    return {
        "invite_id": invite.invite_id,
        "account_type": account_type,
        "destination": invite.destination,
        "expires_at": invite.expires_at,
        "invite_url": invite_url,
        "qr_payload": invite_url,
    }


def accept_activation_invite(
    db: Session,
    invite_token: str,
    request_ip: str | None,
    user_agent: str | None,
) -> dict:
    now = _utcnow()
    invite = (
        db.query(PortalActivationInvite)
        .filter_by(token_hash=hash_invite_token(invite_token))
        .with_for_update()
        .first()
    )
    if not invite or invite.status != ActivationInviteStatusEnum.pending or _as_utc(invite.expires_at) <= now:
        raise HTTPException(status_code=400, detail="Invite link is invalid or expired. Ask the school office to send a new one.")
    student = db.query(Student).filter_by(id=invite.student_id).first()
    if not student or student.status != StudentStatusEnum.Active:
        raise HTTPException(status_code=404, detail="Student record is no longer active.")
    if not _activation_allowed(student, invite.account_type):
        invite.status = ActivationInviteStatusEnum.used
        invite.used_at = now
        db.commit()
        raise HTTPException(status_code=409, detail="This account is already activated.")

    invite.status = ActivationInviteStatusEnum.used
    invite.used_at = now
    return start_activation(
        db,
        student.student_id,
        invite.destination,
        invite.account_type,
        request_ip,
        user_agent,
    )


def resend_otp(db: Session, activation_id: str) -> dict:
    activation = (
        db.query(StudentActivationRequest)
        .filter_by(activation_id=activation_id)
        .first()
    )
    now = _utcnow()
    if not activation or activation.status not in {"pending", "verified"} or _as_utc(activation.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Activation has expired. Please start again.")
    student = db.query(Student).filter_by(id=activation.student_id).first()
    if not student or not _activation_allowed(student, activation.account_type):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account is already activated.")

    latest = _latest_otp(db, activation.id)
    if latest and _as_utc(latest.resend_available_at) > now:
        return {
            "message": "Please wait before requesting another code.",
            "activation_id": activation.activation_id,
            "expires_at": activation.expires_at,
            "resend_available_at": latest.resend_available_at,
        }
    if activation.resend_count >= settings.ACTIVATION_MAX_RESENDS:
        activation.status = "locked"
        activation.locked_until = now + timedelta(minutes=30)
        db.commit()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP requests. Please try again later.")

    verification = _enqueue_otp(db, activation, student)
    db.commit()
    return {
        "message": "A new activation code has been sent.",
        "activation_id": activation.activation_id,
        "expires_at": activation.expires_at,
        "resend_available_at": verification.resend_available_at,
    }


def verify_otp(db: Session, activation_id: str, otp: str) -> dict:
    now = _utcnow()
    activation = (
        db.query(StudentActivationRequest)
        .filter_by(activation_id=activation_id)
        .first()
    )
    if not activation or activation.status not in {"pending", "verified"} or _as_utc(activation.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Activation has expired. Please start again.")
    if activation.locked_until and _as_utc(activation.locked_until) > now:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Please try again later.")

    verification = _latest_otp(db, activation.id)
    if not verification or _as_utc(verification.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP has expired. Please request a new code.")
    if verification.attempt_count >= verification.max_attempts:
        activation.status = "locked"
        activation.locked_until = now + timedelta(minutes=30)
        db.commit()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP attempts. Please start again later.")

    verification.attempt_count += 1
    expected_hash = hash_otp(activation.activation_id, otp.strip())
    if not verification.otp_hash:
        activation.status = "failed"
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP has expired. Please request a new code.")
    if not hmac.compare_digest(verification.otp_hash, expected_hash):
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid activation code.")

    verification.verified_at = now
    activation.verified_at = now
    activation.status = "verified"
    token = create_access_token(
        subject=f"activation:{activation.activation_id}",
        role="activation",
        expires_delta=timedelta(minutes=settings.ACTIVATION_TOKEN_EXPIRE_MINUTES),
        extra_claims={
            "purpose": "student_activation",
            "activation_id": activation.activation_id,
            "account_type": activation.account_type,
        },
    )
    _audit(
        db,
        AuditOperationEnum.student_activation_verified,
        activation.student_id,
        payload={"account_type": activation.account_type, "activation_id": activation.activation_id},
    )
    db.commit()
    return {
        "activation_token": token,
        "account_type": activation.account_type,
        "expires_in_minutes": settings.ACTIVATION_TOKEN_EXPIRE_MINUTES,
    }


def _validate_activation_token(token: str) -> tuple[str, str]:
    try:
        payload = decode_access_token(token)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Activation token is invalid or expired.") from exc
    if payload.get("purpose") != "student_activation":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Activation token is invalid.")
    activation_id = payload.get("activation_id")
    account_type = payload.get("account_type")
    if not activation_id or account_type not in {"student", "parent"}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Activation token is invalid.")
    return activation_id, account_type


def complete_registration(db: Session, activation_token: str, password: str) -> Token:
    if len(password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters.")

    activation_id, account_type = _validate_activation_token(activation_token)
    now = _utcnow()
    activation = (
        db.query(StudentActivationRequest)
        .filter_by(activation_id=activation_id, account_type=account_type)
        .with_for_update()
        .first()
    )
    if not activation or activation.status != "verified" or _as_utc(activation.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Activation is not ready or has expired.")

    student = (
        db.query(Student)
        .filter_by(id=activation.student_id)
        .with_for_update()
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student record not found.")

    try:
        if account_type == "student":
            if student.student_user_id is not None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student account is already activated.")
            existing = db.query(User).filter_by(email=activation.destination).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already in use.")
            user = User(
                name=student.name_en,
                email=activation.destination,
                password_hash=get_password_hash(password),
                role="student",
                is_active=True,
            )
            db.add(user)
            db.flush()
            student.student_user_id = user.id
        else:
            if student.parent_user_id is not None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Parent account is already linked for this student.")
            user = db.query(User).filter_by(email=activation.destination).first()
            if user and user.role != "parent":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already used by another portal role.")
            if user is None:
                user = User(
                    name=student.father_name or f"Parent of {student.name_en}",
                    email=activation.destination,
                    password_hash=get_password_hash(password),
                    role="parent",
                    is_active=True,
                )
                db.add(user)
                db.flush()
            student.parent_user_id = user.id

        activation.status = "completed"
        activation.completed_at = now
        _audit(
            db,
            AuditOperationEnum.student_activation_completed,
            student.id,
            payload={"account_type": account_type, "activation_id": activation.activation_id, "user_id": user.id},
        )
        db.flush()
        current_user = build_current_user(db, user)
        token = create_access_token(subject=user.id, role=user.role)
        response = Token(
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
        db.commit()
        return response
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account activation conflicted with an existing account.") from exc
