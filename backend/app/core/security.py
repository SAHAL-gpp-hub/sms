"""
app/core/security.py

C-01 FIX: This file was referenced by auth.py but never existed in the
codebase because authentication was fully disabled (DISABLE_AUTH=true).
Now that auth is being enabled, this module provides the JWT and password
hashing utilities that auth.py depends on.

Dependencies already in requirements.txt:
  - python-jose[cryptography]  → JWT encode/decode
  - passlib[bcrypt]            → password hashing
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Union

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT token creation / decoding
# ---------------------------------------------------------------------------

def create_access_token(
    subject: Union[str, Any],
    role: str = "admin",
    expires_delta: timedelta = None,
    jti: str = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        subject:       Typically the user's database ID (int), stored as str in 'sub'.
        role:          User role string stored in the payload.
        expires_delta: How long until the token expires. Defaults to
                       settings.ACCESS_TOKEN_EXPIRE_MINUTES.
        jti:           JWT ID claim for token revocation support. A UUID is
                       generated automatically if not provided.
    """
    import uuid
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    payload = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
        "iat": now,
        "jti": jti or str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Returns the decoded payload dict.
    Raises jose.JWTError if the token is invalid or expired.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
