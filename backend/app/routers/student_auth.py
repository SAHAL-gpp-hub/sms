from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.auth import Token, create_refresh_session, limiter
from app.services import student_activation_service

router = APIRouter(prefix="/api/v1/student-auth", tags=["Student Activation"])


class StartActivationRequest(BaseModel):
    identifier: str
    email: EmailStr
    account_type: Literal["student", "parent"]

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Identifier is required")
        return value


class ActivationStartResponse(BaseModel):
    message: str
    activation_id: str
    expires_at: datetime
    resend_available_at: datetime


class VerifyOTPRequest(BaseModel):
    activation_id: str
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        value = value.strip()
        if not value.isdigit() or len(value) != 6:
            raise ValueError("OTP must be 6 digits")
        return value


class ResendOTPRequest(BaseModel):
    activation_id: str


class VerifyOTPResponse(BaseModel):
    activation_token: str
    account_type: str
    expires_in_minutes: int


class CompleteRegistrationRequest(BaseModel):
    activation_token: str
    password: str


class AcceptInviteRequest(BaseModel):
    invite_token: str


@router.post("/start-activation", response_model=ActivationStartResponse)
@limiter.limit("5/minute")
def start_activation(
    request: Request,
    data: StartActivationRequest,
    db: Session = Depends(get_db),
):
    return student_activation_service.start_activation(
        db,
        data.identifier,
        str(data.email),
        data.account_type,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


@router.post("/accept-invite", response_model=ActivationStartResponse)
@limiter.limit("5/minute")
def accept_invite(
    request: Request,
    data: AcceptInviteRequest,
    db: Session = Depends(get_db),
):
    return student_activation_service.accept_activation_invite(
        db,
        data.invite_token,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )


@router.post("/resend-otp", response_model=ActivationStartResponse)
@limiter.limit("5/minute")
def resend_otp(
    request: Request,
    data: ResendOTPRequest,
    db: Session = Depends(get_db),
):
    return student_activation_service.resend_otp(db, data.activation_id)


@router.post("/verify-otp", response_model=VerifyOTPResponse)
@limiter.limit("10/minute")
def verify_otp(
    request: Request,
    data: VerifyOTPRequest,
    db: Session = Depends(get_db),
):
    return student_activation_service.verify_otp(db, data.activation_id, data.otp)


@router.post("/complete-registration", response_model=Token)
@limiter.limit("5/minute")
def complete_registration(
    request: Request,
    response: Response,
    data: CompleteRegistrationRequest,
    db: Session = Depends(get_db),
):
    token = student_activation_service.complete_registration(
        db,
        data.activation_token,
        data.password,
    )
    if token.user_id:
        create_refresh_session(db, response, token.user_id, request)
        db.commit()
    return token
