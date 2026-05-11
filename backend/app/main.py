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
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from alembic import command
from alembic.config import Config

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.database import Base, check_db_connection, engine, get_db
from app.core.config import settings
from app.models.base_models import *  # noqa — registers all models with Base
from app.routers import (
    audit_logs,
    admin_users,
    analytics,
    attendance,
    auth,
    enrollments,   # NEW
    fees,
    imports,
    marks,
    notifications,
    pdf,
    payments,
    portal,
    report_cards,
    setup,
    student_auth,
    students,
    yearend,
)
from app.routers.auth import get_current_user, limiter, require_role
from app.services.notification_service import run_notification_worker

logger = logging.getLogger("sms")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def run_startup_migrations() -> None:
    alembic_cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.SECRET_KEY or "change-this" in settings.SECRET_KEY:
        raise RuntimeError("SECRET_KEY not configured; set a strong random value in .env")
    should_run_db_initialization = app.dependency_overrides.get(get_db) is None
    if should_run_db_initialization:
        try:
            run_startup_migrations()
            logger.info("Alembic migrations applied.")
        except Exception as exc:
            logger.exception("Failed to apply database migrations at startup.")
            raise RuntimeError(
                f"Database migrations failed during startup ({exc.__class__.__name__}). "
                "Check migration files and DATABASE_URL."
            ) from exc

        if check_db_connection():
            logger.info("✅ Database connection verified — PostgreSQL is reachable.")
        else:
            logger.error(
                "❌ DATABASE CONNECTION FAILED.\n"
                "   Check DATABASE_URL in .env or docker-compose.yml."
            )
    else:
        logger.info("Skipping startup database initialization because the database dependency is overridden.")
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
app.state.latency_windows = defaultdict(lambda: deque(maxlen=200))

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


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    # nearest-rank percentile on a sorted bounded window (fast enough for live health metrics)
    idx = min(len(values) - 1, max(0, int(round((pct / 100) * (len(values) - 1)))))
    return round(sorted(values)[idx], 2)


@app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    route_key = request.url.path
    app.state.latency_windows[route_key].append(elapsed_ms)
    response.headers["X-Request-Time-Ms"] = f"{elapsed_ms:.2f}"
    if settings.PERF_LOG_REQUESTS and elapsed_ms >= settings.PERF_SLOW_REQUEST_MS:
        logger.warning("Slow request: %.2f ms | %s %s", elapsed_ms, request.method, route_key)
    return response

# ── Public routes (no auth required) ─────────────────────────────────────────
app.include_router(auth.router)
app.include_router(student_auth.router)
app.include_router(pdf.router)
app.include_router(yearend.public_router)   # tc-pdf, current-year, years (no JWT required)
app.include_router(payments.public_router)

# ── Protected routes (JWT Bearer token required) ──────────────────────────────
_auth = [Depends(get_current_user)]

app.include_router(students.router,     dependencies=_auth)
app.include_router(setup.router,        dependencies=_auth)
app.include_router(fees.router,         dependencies=_auth)
app.include_router(imports.router,      dependencies=_auth)
app.include_router(marks.router,        dependencies=_auth)
app.include_router(attendance.router,   dependencies=_auth)
app.include_router(analytics.router,    dependencies=_auth)
app.include_router(admin_users.router,  dependencies=_auth)
app.include_router(portal.router,       dependencies=_auth)
app.include_router(payments.router,     dependencies=_auth)
app.include_router(notifications.router, dependencies=_auth)
app.include_router(enrollments.router,  dependencies=_auth)   # NEW
app.include_router(report_cards.router, dependencies=_auth)
app.include_router(audit_logs.router, dependencies=_auth)
app.include_router(yearend.router,      dependencies=_auth)   # admin year-end operations


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


@app.get("/metrics/latency")
def latency_metrics(_: object = Depends(require_role("admin"))):
    payload = {}
    for path, samples in app.state.latency_windows.items():
        values = list(samples)
        if not values:
            continue
        payload[path] = {
            "count": len(values),
            "p95_ms": _percentile(values, 95),
            "p99_ms": _percentile(values, 99),
            "avg_ms": round(sum(values) / len(values), 2),
        }
    return payload
