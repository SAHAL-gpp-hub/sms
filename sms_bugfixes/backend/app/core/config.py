"""
app/core/config.py

SECURITY RISK 2 FIX: Added ALLOWED_ORIGINS so production deployments can
restrict CORS to real domain names by setting the env var, without any
code changes.

Added DISABLE_AUTH flag for local development convenience (default False).
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://sms_user:sms_pass@db:5432/school_sms"

    # JWT / Auth
    SECRET_KEY: str = "change-this-in-production-very-secret-at-least-32-chars"
    ALGORITHM:  str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480   # 8 hours

    # SECURITY RISK 2 FIX: comma-separated origins for CORS whitelist.
    # Example production value:
    #   ALLOWED_ORIGINS=https://sms.iqraschool.edu.in,https://admin.iqraschool.edu.in
    # Leave empty to use the default localhost origins (dev only).
    ALLOWED_ORIGINS: str = ""

    # Set DISABLE_AUTH=true in .env for local dev without token overhead.
    # NEVER set this in production.
    DISABLE_AUTH: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
