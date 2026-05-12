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
    SQL_TIMING_LOG_ENABLED: bool = True
    SQL_SLOW_QUERY_MS: int = 250

    # ── JWT / Security ────────────────────────────────────────────────────
    # MUST be overridden in production via .env or docker-compose environment:
    #   SECRET_KEY=<64 random hex chars>
    #   e.g.: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = "change-this-in-production-use-a-64-char-random-hex-string"
    SECRET_KEY_MIN_LENGTH: int = 32
    ALGORITHM:  str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours — one full school day
    LOGIN_2FA_OTP_EXPIRE_MINUTES: int = 10
    LOGIN_2FA_MAX_ATTEMPTS: int = 5
    LATE_COUNTS_AS_PRESENT: bool = True
    CORS_ORIGINS: list[str] = []

    # ── Registration guard ────────────────────────────────────────────────
    # Set REGISTRATION_ENABLED=true only for first-run setup (creating the
    # first admin account). Disable immediately after.
    REGISTRATION_ENABLED: bool = False

    # ── Portal account auto-generation ───────────────────────────────────
    # Domain used when auto-generating portal account email addresses.
    # Email format: student.sms.2026.001@<PORTAL_EMAIL_DOMAIN>
    # This domain does not need to be resolvable — it is stored in the DB
    # only and used as a unique identifier.  Override in .env for production.
    PORTAL_EMAIL_DOMAIN: str = "portal.sms.local"
    DEFAULT_BRANCH_ID: int = 1

    # ── Student / parent self-activation ─────────────────────────────────
    ACTIVATION_TOKEN_EXPIRE_MINUTES: int = 15
    ACTIVATION_OTP_EXPIRE_MINUTES: int = 10
    ACTIVATION_RESEND_COOLDOWN_SECONDS: int = 60
    ACTIVATION_REQUEST_EXPIRE_MINUTES: int = 30
    ACTIVATION_MAX_OTP_ATTEMPTS: int = 5
    ACTIVATION_MAX_RESENDS: int = 5

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "no-reply@school.local"
    SMTP_FROM_NAME: str = "School Portal"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT_SECONDS: int = 10
    NOTIFICATION_WORKER_ENABLED: bool = True
    NOTIFICATION_WORKER_INTERVAL_SECONDS: int = 10
    RESPONSE_CACHE_TTL_SECONDS: int = 20
    PERF_LOG_REQUESTS: bool = True
    PERF_SLOW_REQUEST_MS: int = 500

    # ── Razorpay online fee payments ─────────────────────────────────────
    RAZORPAY_KEY_ID: str | None = None
    RAZORPAY_KEY_SECRET: str | None = None
    RAZORPAY_WEBHOOK_SECRET: str | None = None

    # ── Parent notifications: WhatsApp primary, SMS fallback ─────────────
    WHATSAPP_TOKEN: str | None = None
    WHATSAPP_PHONE_NUMBER_ID: str | None = None
    WHATSAPP_BUSINESS_ACCOUNT_ID: str | None = None
    WHATSAPP_API_VERSION: str = "v18.0"

    SMS_PROVIDER: str = "msg91"
    MSG91_AUTH_KEY: str | None = None
    MSG91_SENDER_ID: str | None = None
    MSG91_TEMPLATE_ID: str | None = None

    AUTO_SEND_PAYMENT_CONFIRMATION: bool = True
    AUTO_SEND_FEE_REMINDERS: bool = True
    AUTO_SEND_LOW_ATTENDANCE_ALERTS: bool = True
    LOW_ATTENDANCE_THRESHOLD_PERCENT: float = 75.0
    PORTAL_PUBLIC_URL: str = "https://iqraschool.in/portal"

    class Config:
        env_file = ".env"
        # Allow extra env vars (e.g. POSTGRES_DB set by docker) without failing
        extra = "ignore"


settings = Settings()
