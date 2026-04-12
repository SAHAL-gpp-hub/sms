"""
app/core/security.py

JWT token utilities used by:
  - app/main.py middleware (decode_access_token)
  - app/routers/auth.py (create_access_token, verify_password, get_password_hash)

SECURITY RISK 1 FIX: This module did not exist before — auth was completely
missing from the codebase despite User model and jose/passlib being in
requirements.txt.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(plain_password: str) -> str:
    """Hash a plaintext password for storage."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored hash."""
    return _pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

def create_access_token(
    subject: Any,
    role: str = "admin",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        subject:       The user identifier to embed in the 'sub' claim
                       (usually User.id as a string).
        role:          User role embedded in the token ('admin', 'teacher', …).
        expires_delta: Token lifetime. Defaults to settings.ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        A signed JWT string.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub":  str(subject),
        "role": role,
        "exp":  expire,
        "iat":  datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.

    Raises:
        jose.JWTError: if the token is expired, tampered with, or malformed.

    Returns:
        The decoded payload dict (contains 'sub' and 'role' at minimum).
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        if payload.get("sub") is None:
            raise JWTError("Token missing 'sub' claim")
        return payload
    except JWTError:
        raise   # re-raise so the middleware returns 401
