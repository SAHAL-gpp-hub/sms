"""
app/core/config.py

FIXES:
  - DATABASE_URL now falls back gracefully for both Docker ("db" hostname)
    and local development ("localhost"). The Docker compose file sets
    DATABASE_URL explicitly, so the default only matters for bare `uvicorn`
    or pytest runs outside Docker.
  - SECRET_KEY: still reads from env; the .env / docker-compose must set a
    real 64-char hex secret before production use.
  - Added DB_ECHO flag: set DB_ECHO=true in .env to see all SQL statements —
    essential for debugging "app not talking to DB" issues.
  - ACCESS_TOKEN_EXPIRE_MINUTES: 8 hours (480 min) is correct for a school
    day; teachers log in once in the morning.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────
    # Docker compose sets: DATABASE_URL=postgresql://sms_user:sms_pass@db:5432/school_sms
    # Local dev default:   postgresql://sms_user:sms_pass@localhost:5432/school_sms
    # To override for local: export DATABASE_URL=postgresql://...@localhost:5432/school_sms
    DATABASE_URL: str = "postgresql://sms_user:sms_pass@localhost:5432/school_sms"

    # Set to true to print all SQL to stdout — useful when debugging connection issues
    DB_ECHO: bool = False

    # ── JWT / Security ────────────────────────────────────────────────────
    # MUST be overridden in production via .env or docker-compose environment:
    #   SECRET_KEY=<64 random hex chars>
    #   e.g.: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = "change-this-in-production-use-a-64-char-random-hex-string"
    ALGORITHM:  str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours — one full school day

    class Config:
        env_file = ".env"
        # Allow extra env vars (e.g. POSTGRES_DB set by docker) without failing
        extra = "ignore"


settings = Settings()
