"""In-memory tracking for background PDF jobs (e.g. class marksheet).

A full-class marksheet can take 10–20s to render even when parallelized — too
long for a synchronous HTTP request that browsers/proxies may time out. Such
jobs are moved to a BackgroundTask, and the client polls a status endpoint
until the rendered PDF is ready.

This store is intentionally process-local and in-memory. It is sufficient for
a single-worker deployment and for surviving the lifetime of a single render
job. If the process restarts mid-job the client simply gets a 404 and must
re-request; nothing is persisted in a corrupt state.
"""

from __future__ import annotations

import threading
import uuid
from typing import Optional

_store: dict[str, dict] = {}
_lock = threading.Lock()


def create_job() -> str:
    """Register a new pending job; return its id."""
    jid = str(uuid.uuid4())
    with _lock:
        _store[jid] = {"status": "pending", "pdf": None, "error": None}
    return jid


def set_done(jid: str, pdf: bytes) -> None:
    with _lock:
        if jid in _store:
            _store[jid].update({"status": "done", "pdf": pdf})


def set_error(jid: str, msg: str) -> None:
    with _lock:
        if jid in _store:
            _store[jid].update({"status": "error", "error": msg})


def get(jid: str) -> Optional[dict]:
    with _lock:
        return _store.get(jid)


def cleanup(jid: str) -> None:
    """Remove a finished job from memory (call after the client has fetched it)."""
    with _lock:
        _store.pop(jid, None)
