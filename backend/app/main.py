"""
app/main.py — Updated.

Changes vs original:
  - Registers the new enrollments router
  - yearend router now covers activation, undo, lock-marks, clone-fees,
    clone-subjects, calendar, audit-log (all added in yearend.py rewrite)
  - All other behaviour preserved
"""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.database import Base, check_db_connection, engine
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
    setup,
    students,
    yearend,
)
from app.routers.auth import get_current_user, limiter

logger = logging.getLogger("sms")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("SQLAlchemy tables ensured.")

    if check_db_connection():
        logger.info("✅ Database connection verified — PostgreSQL is reachable.")
    else:
        logger.error(
            "❌ DATABASE CONNECTION FAILED.\n"
            "   Check DATABASE_URL in .env or docker-compose.yml."
        )
    yield
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
    allow_origins=[
        "http://localhost",
        "http://localhost:80",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public routes (no auth required) ─────────────────────────────────────────
app.include_router(auth.router)
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