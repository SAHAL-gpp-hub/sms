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
import time

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

logger = logging.getLogger("sms.sql")

# ── Engine ────────────────────────────────────────────────────────────────
# pool_pre_ping: validate connection before checkout (fixes stale-connection errors)
# pool_recycle: discard connections older than 30 min (fixes broken-pipe after idle)
# connect_timeout: fail fast if DB unreachable rather than hanging
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=settings.DB_ECHO,
    connect_args={
        "connect_timeout": 10,          # seconds before giving up on TCP connect
        "options": "-c statement_timeout=30000",  # 30s max per query
    },
)


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
def check_db_connection() -> bool:
    """
    Returns True if the database is reachable, False otherwise.
    Used by /health endpoint so ops/docker can confirm DB connectivity
    without needing to inspect the backend logs.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
