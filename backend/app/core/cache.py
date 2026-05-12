"""
In-memory response cache with TTL and LRU eviction.

Note: this cache is process-local. In multi-worker deployments, each worker has
its own independent cache and entries are not shared across processes.
"""

import threading
import time
from collections import OrderedDict
from typing import Any


class TTLCache:
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


response_cache = TTLCache()
