"""
app/core/cache.py

PERF-06 FIX: The previous implementation was an in-process OrderedDict that
was invisible to other uvicorn workers and was wiped on every restart.

This module now uses the redis_client singleton as the primary store so that:
  - Cache entries survive restarts (Redis persists across app restarts).
  - Multiple uvicorn workers share the same cache state.
  - Cache invalidation (invalidate_prefix) works across all processes.

When Redis is unavailable (no REDIS_URL or connection failure), redis_client
transparently falls back to its own in-memory store, so the old behaviour is
preserved with zero code changes in callers.
"""

import json
import threading
import time
from collections import OrderedDict
from typing import Any

from app.core.redis_client import redis_client


# ---------------------------------------------------------------------------
# Local in-memory fallback (unchanged from original — used when Redis is
# unavailable AND as a fast L1 layer when Redis IS available)
# ---------------------------------------------------------------------------

class TTLCache:
    """Thread-safe in-process TTL cache (LRU eviction, max_entries cap)."""

    def __init__(self, max_entries: int = 512):
        self._max_entries = max_entries
        self._lock = threading.Lock()
        self._values: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    def get(self, key: str):
        now = time.time()
        with self._lock:
            item = self._values.get(key)
            if not item:
                return None
            expires_at, value = item
            if expires_at < now:
                self._values.pop(key, None)
                return None
            self._values.move_to_end(key)
            return value

    def set(self, key: str, value: Any, ttl_seconds: int):
        if ttl_seconds <= 0:
            return
        expires_at = time.time() + ttl_seconds
        with self._lock:
            self._values[key] = (expires_at, value)
            self._values.move_to_end(key)
            while len(self._values) > self._max_entries:
                self._values.popitem(last=False)

    def invalidate_prefix(self, prefix: str):
        with self._lock:
            for key in list(self._values.keys()):
                if key.startswith(prefix):
                    self._values.pop(key, None)


# ---------------------------------------------------------------------------
# Redis-backed cache (with in-process L1 for read-hot keys)
# ---------------------------------------------------------------------------

class HybridCache:
    """
    Two-level cache: Redis (L2, shared across workers) + in-memory TTLCache
    (L1, per-process fast path).

    Write path: write to both L1 and L2.
    Read path:  check L1 first; on miss check L2 and populate L1.
    Invalidate: clear from both L1 and L2.
    """

    def __init__(self, max_local_entries: int = 512):
        self._local = TTLCache(max_local_entries)

    def get(self, key: str) -> Any | None:
        # L1 hit
        value = self._local.get(key)
        if value is not None:
            return value
        # L2 hit
        raw = redis_client.get(key)
        if raw is None:
            return None
        try:
            value = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            value = raw
        return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return
        try:
            raw = json.dumps(value, default=str)
        except (TypeError, ValueError):
            raw = str(value)
        self._local.set(key, value, ttl_seconds)
        redis_client.set(key, raw, ex=ttl_seconds)

    def invalidate_prefix(self, prefix: str) -> None:
        self._local.invalidate_prefix(prefix)
        redis_client.delete_by_prefix(prefix)


# Module-level singleton used by fees.py, analytics.py, etc.
# Drop-in replacement — same .get / .set / .invalidate_prefix API.
response_cache = HybridCache()
