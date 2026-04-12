"""
app/routers/auth.py

SECURITY RISK 1 FIX: Login endpoint that issues JWT access tokens.
Previously the User model existed with password_hash and role columns
but there was no login route, no token issuance, and no middleware —
every single endpoint was open to the network with no authentication.

Endpoints:
  POST /api/v1/auth/login    → { access_token, token_type }
  POST /api/v1/auth/register → create a new admin user (first-run setup)
  GET  /api/v1/auth/me       → return current user info (requires token)
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.models.base_models import User

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ---------------------------------------------------------------------------
# Pydantic schemas (auth-specific, kept here to avoid circular imports)
# ---------------------------------------------------------------------------

class Token(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      int
    user_name:    str
    role:         str


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

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Dependency: get the current authenticated user from the token
# ---------------------------------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload  = decode_access_token(token)
        user_id  = int(payload.get("sub"))
    except Exception:
        raise credentials_exception

    user = db.query(User).filter_by(id=user_id, is_active=True).first()
    if user is None:
        raise credentials_exception
    return user


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login", response_model=Token, summary="Login and receive a JWT token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Accepts username (email) + password via standard OAuth2 password form.
    Returns a JWT Bearer token valid for ACCESS_TOKEN_EXPIRE_MINUTES.
    """
    user = db.query(User).filter_by(email=form_data.username, is_active=True).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        subject=user.id,
        role=user.role,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(
        access_token=token,
        user_id=user.id,
        user_name=user.name,
        role=user.role,
    )


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new admin user (first-run setup only)",
)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Create the first admin account.  In production, disable this endpoint
    (or protect it with an existing admin token) after initial setup.
    """
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


@router.get("/me", response_model=UserOut, summary="Get current user info")
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user
