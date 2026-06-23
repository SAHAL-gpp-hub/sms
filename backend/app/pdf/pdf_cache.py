"""Cache for rendered PDFs.

Tiered strategy:
  1. Redis (when REDIS_URL is set) — shared across workers, survives restarts.
  2. In-memory TTLCache (always active) — fast, process-local fallback.

Redis is OPTIONAL. If REDIS_URL is unset or the server is unreachable,
every Redis operation silently degrades to a cache miss / no-op. A Redis
outage must never break PDF generation.

Design rules
------------
* All public helpers swallow exceptions — callers do not need try/except.
* Redis TTL is long (30 days) because these documents are immutable.
* In-memory TTL is short (5 minutes) to balance freshness with speed for
  reports that may change (defaulters, attendance, results).
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from app.core.cache import TTLCache

logger = logging.getLogger("sms.pdf_cache")

# ── Redis tier ────────────────────────────────────────────────────────────────
_REDIS_TTL_SECONDS = 86400 * 30  # 30 days — documents are immutable
_redis_client = None
_redis_disabled = False


def _get_redis_client():
    """Lazily connect to Redis. Returns None if disabled or unreachable."""
    global _redis_client, _redis_disabled
    if _redis_disabled:
        return None
    if _redis_client is not None:
        return _redis_client

    url = os.getenv("REDIS_URL")
    if not url:
        _redis_disabled = True
        logger.info("REDIS_URL not set — PDF Redis cache disabled.")
        return None

    try:
        import redis as _redis_mod  # imported lazily so missing pkg is non-fatal
        _redis_client = _redis_mod.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        _redis_client.ping()
        logger.info("PDF cache connected to Redis.")
    except Exception as exc:  # noqa: BLE001 — any failure disables the cache
        logger.warning("PDF Redis cache disabled (unavailable): %s", exc)
        _redis_client = None
        _redis_disabled = True
    return _redis_client


def _redis_get(key: str) -> Optional[bytes]:
    client = _get_redis_client()
    if client is None:
        return None
    try:
        return client.get(key)
    except Exception as exc:  # noqa: BLE001
        logger.debug("redis cache_get failed for %s: %s", key, exc)
        return None


def _redis_set(key: str, pdf: bytes) -> None:
    if not pdf:
        return
    client = _get_redis_client()
    if client is None:
        return
    try:
        client.setex(key, _REDIS_TTL_SECONDS, pdf)
    except Exception as exc:  # noqa: BLE001
        logger.debug("redis cache_set failed for %s: %s", key, exc)


# ── In-memory tier (always available) ──────────────────────────────────────────
_MEMORY_TTL_SECONDS = 300  # 5 minutes — short for mutable reports
_pdf_cache = TTLCache(max_entries=128)


def _memory_get(key: str) -> Optional[bytes]:
    return _pdf_cache.get(key)


def _memory_set(key: str, pdf: bytes) -> None:
    if pdf:
        _pdf_cache.set(key, pdf, _MEMORY_TTL_SECONDS)


# ── Public API ─────────────────────────────────────────────────────────────────

def cache_get(key: str, *, long_ttl: bool = False) -> Optional[bytes]:
    """Return cached PDF bytes, or None on miss / disabled / error.

    Args:
        key: Cache key (use the typed key builders below).
        long_ttl: If True, check Redis (30-day TTL) first, then memory.
                  If False, check memory only (5-minute TTL).
                  Use long_ttl=True for immutable documents (receipts, locked marksheets).
                  Use long_ttl=False for mutable reports (defaulters, attendance, results).
    """
    if long_ttl:
        val = _redis_get(key)
        if val is not None:
            return val
    return _memory_get(key)


def cache_set(key: str, pdf: bytes, *, long_ttl: bool = False) -> None:
    """Store PDF bytes. No-op on failure.

    Args:
        long_ttl: If True, store in both Redis (30 days) and memory (5 min).
                  If False, store in memory only (5 min).
    """
    if not pdf:
        return
    _memory_set(key, pdf)
    if long_ttl:
        _redis_set(key, pdf)


def invalidate_prefix(prefix: str) -> None:
    """Remove all cache entries matching a prefix (memory only; Redis keys
    expire naturally)."""
    _pdf_cache.invalidate_prefix(prefix)


# ── Typed key builders (keep keys stable & namespaced) ────────────────────────
def receipt_key(payment_id: int) -> str:
    return f"pdf:receipt:{payment_id}"


def marksheet_student_key(student_id: int, exam_id: int) -> str:
    return f"pdf:marksheet:student:{student_id}:{exam_id}"


def defaulter_report_key(academic_year_id, class_id) -> str:
    return f"pdf:report:defaulter:year={academic_year_id or 'all'}:class={class_id or 'all'}"


def attendance_report_key(class_id: int, year: int, month: int) -> str:
    return f"pdf:report:attendance:{class_id}:{year}:{month}"


def result_report_key(exam_id: int, class_id: int) -> str:
    return f"pdf:report:results:{exam_id}:{class_id}"
