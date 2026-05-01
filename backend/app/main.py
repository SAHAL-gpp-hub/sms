"""
app/main.py

FIXES:
  - /health endpoint now checks actual DB connectivity (not just "app is up").
    Previously /health returned {"status": "ok"} even when the DB was down,
    making it useless for Docker healthchecks and ops monitoring.

  - Added startup event that verifies DB connection at boot time and logs
    a clear error if it fails. Without this, the app would start "successfully"
    but every API call would fail with cryptic SQLAlchemy errors — the most
    common "app not talking to DB" experience.

  - Improved CORS: added localhost:3000 (Create React App default) and
    localhost:5173 (Vite default) so local dev works without Docker.

  - Route registration order preserved exactly — auth and PDF are public,
    all data routes require JWT.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.database import Base, check_db_connection, engine
from app.models.base_models import *  # noqa — registers all models with Base
from app.routers import admin_users, attendance, auth, fees, marks, pdf, setup, students, yearend
from app.routers.auth import get_current_user, limiter

logger = logging.getLogger("sms")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


# ── Startup / shutdown ────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once at startup before accepting requests.
    Verifies DB connectivity early so failures are obvious in logs,
    not hidden inside the first API request.
    """
    # Create tables if they don't exist yet (idempotent; migrations are preferred)
    Base.metadata.create_all(bind=engine)
    logger.info("SQLAlchemy tables ensured.")

    # Verify actual DB connectivity
    if check_db_connection():
        logger.info("✅ Database connection verified — PostgreSQL is reachable.")
    else:
        logger.error(
            "❌ DATABASE CONNECTION FAILED.\n"
            "   Check DATABASE_URL in .env or docker-compose.yml.\n"
            "   Current value: see settings.DATABASE_URL in app/core/config.py\n"
            "   Common causes:\n"
            "     - DB container not yet healthy (add depends_on healthcheck)\n"
            "     - Wrong hostname: use 'db' inside Docker, 'localhost' outside\n"
            "     - Wrong port: PostgreSQL default is 5432\n"
            "     - Wrong credentials: sms_user / sms_pass\n"
            "     - DB not created: run 'createdb school_sms' or docker-compose up db"
        )

    yield
    # Shutdown: nothing to clean up (SQLAlchemy pool handles connections)
    logger.info("SMS backend shutting down.")


# ── App factory ───────────────────────────────────────────────────────────
app = FastAPI(
    title="School Management System — GSEB",
    version="1.0.0",
    description="SMS for Iqra English Medium School — Palanpur, Gujarat",
    lifespan=lifespan,
)

# STEP 4.5: Attach the rate limiter so @limiter.limit() decorators work.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────
# Allow the Vite dev server, CRA dev server, and the Docker nginx proxy.
# In production, replace "*" with the actual deployed domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",        # Docker nginx (port 80)
        "http://localhost:80",
        "http://localhost:3000",   # Create React App dev
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Public routes (no auth required) ──────────────────────────────────────

# Auth: login/register/me — must be public so users can obtain tokens
app.include_router(auth.router)

# PDF downloads: browser navigates directly via window.open / <a href>,
# so no Authorization header can be attached. These are read-only endpoints.
app.include_router(pdf.router)

# Year-End: TC PDF downloads are public; write ops (promote, new-year)
# enforce their own per-route Depends(get_current_user) inside the router.
app.include_router(yearend.router)


# ── Protected routes (JWT Bearer token required) ───────────────────────────
_auth = [Depends(get_current_user)]

app.include_router(students.router,   dependencies=_auth)
app.include_router(setup.router,      dependencies=_auth)
app.include_router(fees.router,       dependencies=_auth)
app.include_router(marks.router,      dependencies=_auth)
app.include_router(attendance.router, dependencies=_auth)
app.include_router(admin_users.router, dependencies=_auth)


# ── Utility endpoints ──────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "SMS Backend is running ✅", "version": "1.0.0"}


@app.get("/health")
def health():
    """
    FIXED: Now returns actual DB connectivity status, not just "ok".
    Used by Docker healthcheck and ops tooling.
    Responds 200 even when DB is down (with db_connected: false) so
    the response body can be inspected — a 503 would make curl/wget exit
    non-zero and hide the diagnostic info.
    """
    db_ok = check_db_connection()
    return {
        "status":       "ok" if db_ok else "degraded",
        "db_connected": db_ok,
        "message": (
            "All systems operational."
            if db_ok
            else (
                "Database unreachable. Check DATABASE_URL and that the "
                "PostgreSQL container/service is running and healthy."
            )
        ),
    }
