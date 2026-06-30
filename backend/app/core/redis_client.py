"""
app/core/redis_client.py

Redis client with graceful in-memory fallback.
If REDIS_URL is not set or Redis is unreachable, all operations fall through to
a lightweight in-process TTL dict so the app stays functional.

Used for:
  - Token blocklist fast-path (PERF-04)
  - CurrentUser data caching (PERF-05)
  - Response/fee cache backing store (PERF-06)
"""

import logging
import time
import threading
from typing import Any

logger = logging.getLogger("sms.redis")

# ---------------------------------------------------------------------------
# In-memory fallback (thread-safe, TTL-aware)
# ---------------------------------------------------------------------------

class _InMemoryStore:
    """Simple thread-safe TTL key-value store used when Redis is unavailable."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[float, str]] = {}  # key → (expires_at, value)
        self._lock = threading.Lock()

    def get(self, key: str) -> str | None:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at != -1 and time.monotonic() > expires_at:
                del self._data[key]
                return None
            return value

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        expires_at = (time.monotonic() + ex) if ex else -1
        with self._lock:
            self._data[key] = (expires_at, value)

    def delete(self, *keys: str) -> None:
        with self._lock:
            for k in keys:
                self._data.pop(k, None)

    def exists(self, key: str) -> int:
        return 1 if self.get(key) is not None else 0

    def keys(self, pattern: str) -> list[str]:
        """Naive prefix scan for the fallback store (pattern must end with *)."""
        prefix = pattern.rstrip("*")
        with self._lock:
            now = time.monotonic()
            return [
                k for k, (exp, _) in self._data.items()
                if k.startswith(prefix) and (exp == -1 or exp > now)
            ]

    def delete_by_prefix(self, prefix: str) -> None:
        with self._lock:
            for k in list(self._data.keys()):
                if k.startswith(prefix):
                    del self._data[k]


# ---------------------------------------------------------------------------
# Redis wrapper (tries real Redis; falls back to _InMemoryStore)
# ---------------------------------------------------------------------------

class _RedisClient:
    """
    Thin wrapper around redis.Redis.
    All public methods are safe to call even if Redis is unavailable —
    they silently fall back to the in-memory store and log a warning once.
    """

    def __init__(self) -> None:
        self._redis: Any = None
        self._fallback = _InMemoryStore()
        self._warned = False
        self._connected = False

    def connect(self, redis_url: str | None) -> None:
        """Call this once during app startup."""
        if not redis_url:
            logger.info("REDIS_URL not set — using in-memory fallback for caching.")
            return
        try:
            import redis as _redis_lib
            client = _redis_lib.from_url(redis_url, decode_responses=True, socket_connect_timeout=2)
            client.ping()
            self._redis = client
            self._connected = True
            logger.info("Redis connected: %s", redis_url.split("@")[-1])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis unavailable (%s) — using in-memory fallback for caching.", exc)

    def _backend(self):
        return self._redis if self._connected else self._fallback

    # ── Public interface ──────────────────────────────────────────────────

    def get(self, key: str) -> str | None:
        try:
            return self._backend().get(key)
        except Exception as exc:  # noqa: BLE001
            self._log_redis_error(exc)
            return self._fallback.get(key)

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        try:
            if ex:
                self._backend().set(key, value, ex=ex)
            else:
                self._backend().set(key, value)
        except Exception as exc:  # noqa: BLE001
            self._log_redis_error(exc)
            self._fallback.set(key, value, ex=ex)

    def delete(self, *keys: str) -> None:
        try:
            self._backend().delete(*keys)
        except Exception as exc:  # noqa: BLE001
            self._log_redis_error(exc)
            self._fallback.delete(*keys)

    def exists(self, key: str) -> bool:
        try:
            return bool(self._backend().exists(key))
        except Exception as exc:  # noqa: BLE001
            self._log_redis_error(exc)
            return bool(self._fallback.exists(key))

    def delete_by_prefix(self, prefix: str) -> None:
        """Delete all keys whose name starts with *prefix*."""
        try:
            if self._connected and self._redis:
                cursor = 0
                while True:
                    cursor, keys = self._redis.scan(cursor, match=f"{prefix}*", count=200)
                    if keys:
                        self._redis.delete(*keys)
                    if cursor == 0:
                        break
            else:
                self._fallback.delete_by_prefix(prefix)
        except Exception as exc:  # noqa: BLE001
            self._log_redis_error(exc)
            self._fallback.delete_by_prefix(prefix)

    @property
    def is_available(self) -> bool:
        return self._connected

    def _log_redis_error(self, exc: Exception) -> None:
        if not self._warned:
            logger.warning("Redis error — falling back to in-memory store: %s", exc)
            self._warned = True
        # Reset connected flag so future calls go to fallback
        self._connected = False


# Singleton — import and use this everywhere
redis_client = _RedisClient()
