"""
app/core/database.py

FIXES:
  - Added pool_pre_ping=True: SQLAlchemy will test the connection before
    using it from the pool. Without this, stale connections after a DB
    restart (or Docker restart) cause "server closed the connection
    unexpectedly" errors — the most common "app not talking to DB" symptom
    when running docker-compose and the DB container restarts.

  - Added connect_args with connect_timeout: prevents the app from hanging
    indefinitely when the DB is unreachable (e.g. DB container not yet
    healthy at startup). Will raise an error after 10s instead of hanging.

  - Added pool_recycle=1800: connections older than 30 minutes are
    discarded and re-created. PostgreSQL closes idle connections by default
    after a while; without recycling, these show up as broken pipe errors.

  - DB_ECHO support: when settings.DB_ECHO is True, all SQL statements are
    printed to stdout. Set DB_ECHO=true in .env for debugging.
"""

import logging
import threading
import time

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

logger = logging.getLogger("sms.sql")

# ── Engine ────────────────────────────────────────────────────────────────
# pool_pre_ping: validate connection before checkout (fixes stale-connection errors)
# pool_recycle: discard connections older than 30 min (fixes broken-pipe after idle)
# connect_timeout: fail fast if DB unreachable rather than hanging
engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
    "echo": settings.DB_ECHO,
}
if settings.DATABASE_URL.startswith("postgresql"):
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "connect_args": {
            "connect_timeout": 10,          # seconds before giving up on TCP connect
            "options": "-c statement_timeout=30000",  # 30s max per query
        },
    })

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)


if settings.SQL_TIMING_LOG_ENABLED:
    @event.listens_for(engine, "before_cursor_execute")
    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault("query_start_time", []).append(time.perf_counter())

    @event.listens_for(engine, "after_cursor_execute")
    def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        timings = conn.info.get("query_start_time") or []
        start = timings.pop() if timings else None
        if start is None:
            return
        duration_ms = (time.perf_counter() - start) * 1000
        if duration_ms >= settings.SQL_SLOW_QUERY_MS:
            logger.warning("Slow SQL query: %.2f ms | %s", duration_ms, statement.splitlines()[0][:220])

# ── Session ───────────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ── Base ──────────────────────────────────────────────────────────────────
Base = declarative_base()


# ── Dependency ────────────────────────────────────────────────────────────
def get_db():
    """
    FastAPI dependency that yields a database session and guarantees cleanup.
    Usage in router: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Health-check helper ────────────────────────────────────────────────────

# PERF-07 FIX: cache the health-check result for 5 seconds.
# /health and /health/ready are polled every few seconds by Docker, nginx, and
# load balancers. Each call previously opened a real connection from the pool.
# Now we return the last known state and only re-test every 5 seconds.
_db_healthy: bool = True
_db_last_check: float = 0.0
_DB_CHECK_INTERVAL: float = 5.0  # seconds between real DB pings
_db_lock = threading.Lock()


def check_db_connection() -> bool:
    """
    Returns True if the database is reachable, False otherwise.
    Result is cached for _DB_CHECK_INTERVAL seconds to avoid pool churn from
    frequent health-check polling.
    """
    global _db_healthy, _db_last_check
    now = time.monotonic()
    with _db_lock:
        if now - _db_last_check < _DB_CHECK_INTERVAL:
            return _db_healthy
        # Time to re-check
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            _db_healthy = True
        except Exception:
            _db_healthy = False
        _db_last_check = now
        return _db_healthy
