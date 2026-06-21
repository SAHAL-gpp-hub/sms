"""Optional Redis-backed cache for immutable rendered PDFs.

Fee receipts and single-student marksheets never change once the underlying
data is locked (a payment is final; marks are immutable after year-end lock).
Re-downloading them is common (parents re-print receipts), so caching the
rendered bytes saves a full WeasyPrint render on every repeat download.

Design rules
------------
* Redis is OPTIONAL. If REDIS_URL is unset or the server is unreachable,
  every operation silently degrades to a cache miss / no-op. A Redis outage
  must never break PDF generation.
* All public helpers swallow exceptions — callers do not need try/except.
* TTL is long (30 days) because these documents are immutable.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger("sms.pdf_cache")

_TTL_SECONDS = 86400 * 30  # 30 days — documents are immutable
_client = None
_disabled = False


def _get_client():
    """Lazily connect to Redis. Returns None if disabled or unreachable."""
    global _client, _disabled
    if _disabled:
        return None
    if _client is not None:
        return _client

    url = os.getenv("REDIS_URL")
    if not url:
        _disabled = True
        logger.info("REDIS_URL not set — PDF cache disabled.")
        return None

    try:
        import redis as _redis_mod  # imported lazily so missing pkg is non-fatal
        _client = _redis_mod.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        _client.ping()
        logger.info("PDF cache connected to Redis.")
    except Exception as exc:  # noqa: BLE001 — any failure disables the cache
        logger.warning("PDF cache disabled (Redis unavailable): %s", exc)
        _client = None
        _disabled = True
    return _client


def cache_get(key: str) -> Optional[bytes]:
    """Return cached PDF bytes, or None on miss / disabled / error."""
    client = _get_client()
    if client is None:
        return None
    try:
        return client.get(key)
    except Exception as exc:  # noqa: BLE001
        logger.debug("cache_get failed for %s: %s", key, exc)
        return None


def cache_set(key: str, pdf: bytes) -> None:
    """Store PDF bytes with the default TTL. No-op on failure."""
    if not pdf:
        return
    client = _get_client()
    if client is None:
        return
    try:
        client.setex(key, _TTL_SECONDS, pdf)
    except Exception as exc:  # noqa: BLE001
        logger.debug("cache_set failed for %s: %s", key, exc)


# ── Typed key builders (keep keys stable & namespaced) ────────────────────────
def receipt_key(payment_id: int) -> str:
    return f"pdf:receipt:{payment_id}"


def marksheet_student_key(student_id: int, exam_id: int) -> str:
    return f"pdf:marksheet:student:{student_id}:{exam_id}"
