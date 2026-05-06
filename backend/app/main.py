"""
app/main.py — Updated.

Changes vs original:
  - Registers the new enrollments router
  - yearend router now covers activation, undo, lock-marks, clone-fees,
    clone-subjects, calendar, audit-log (all added in yearend.py rewrite)
  - All other behaviour preserved
"""

import logging
import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.database import Base, check_db_connection, engine
from app.core.config import settings
from app.models.base_models import *  # noqa — registers all models with Base
from app.routers import (
    admin_users,
    attendance,
    auth,
    enrollments,   # NEW
    fees,
    marks,
    pdf,
    portal,
    report_cards,
    setup,
    student_auth,
    students,
    yearend,
)
from app.routers.auth import get_current_user, limiter
from app.services.notification_service import run_notification_worker

logger = logging.getLogger("sms")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.SECRET_KEY or "change-this" in settings.SECRET_KEY:
        raise RuntimeError("SECRET_KEY not configured; set a strong random value in .env")
    Base.metadata.create_all(bind=engine)
    logger.info("SQLAlchemy tables ensured.")

    if check_db_connection():
        logger.info("✅ Database connection verified — PostgreSQL is reachable.")
    else:
        logger.error(
            "❌ DATABASE CONNECTION FAILED.\n"
            "   Check DATABASE_URL in .env or docker-compose.yml."
        )
    app.state.notification_stop_event = asyncio.Event()
    app.state.notification_worker_task = None
    if settings.NOTIFICATION_WORKER_ENABLED:
        app.state.notification_worker_task = asyncio.create_task(
            run_notification_worker(app.state.notification_stop_event)
        )
    yield
    if getattr(app.state, "notification_stop_event", None):
        app.state.notification_stop_event.set()
    task = getattr(app.state, "notification_worker_task", None)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    logger.info("SMS backend shutting down.")


app = FastAPI(
    title="School Management System — GSEB",
    version="2.0.0",
    description="SMS for Iqra English Medium School — Palanpur, Gujarat",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public routes (no auth required) ─────────────────────────────────────────
app.include_router(auth.router)
app.include_router(student_auth.router)
app.include_router(pdf.router)
app.include_router(yearend.router)   # TC PDF download is public inside this router

# ── Protected routes (JWT Bearer token required) ──────────────────────────────
_auth = [Depends(get_current_user)]

app.include_router(students.router,     dependencies=_auth)
app.include_router(setup.router,        dependencies=_auth)
app.include_router(fees.router,         dependencies=_auth)
app.include_router(marks.router,        dependencies=_auth)
app.include_router(attendance.router,   dependencies=_auth)
app.include_router(admin_users.router,  dependencies=_auth)
app.include_router(portal.router,       dependencies=_auth)
app.include_router(enrollments.router,  dependencies=_auth)   # NEW
app.include_router(report_cards.router, dependencies=_auth)


@app.get("/")
def root():
    return {"status": "SMS Backend is running ✅", "version": "2.0.0"}


@app.get("/health")
def health():
    db_ok = check_db_connection()
    return {
        "status":       "ok" if db_ok else "degraded",
        "db_connected": db_ok,
        "message": (
            "All systems operational."
            if db_ok
            else "Database unreachable. Check DATABASE_URL."
        ),
    }
