"""On-disk PDF cache for class marksheets and other large rendered PDFs.

Why a disk cache (instead of in-memory)?
  * Survives process restarts and uvicorn worker cycling — a single render
    persists across all workers without duplicating in each worker's RAM.
  * A 40-student class marksheet is ~500KB–2MB; caching 50 of them in-memory
    wastes 25–100MB per worker. On disk they're zero-cost until read.
  * FileResponse + sendfile() streams the file directly from the OS page cache
    to the socket — no Python buffering, no memory copy.

Why /tmp?
  * The deployment is a single Docker container (Render / docker-compose).
  * /tmp is writable without volume mounts and survives between requests.
  * It IS wiped on container restarts — but that's fine because:
    - Invalidation is event-driven (marks save/lock/unlock busts the cache).
    - First render after a restart is the only "cold" request; subsequent
      re-opens are instant until the next invalidation event.
  * An explicit comment here because /tmp looks sloppy — it isn't.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger("sms.pdf_file_cache")

# ── Configuration ────────────────────────────────────────────────────────────────

# /tmp on the container host. Docker mounts a tmpfs here by default,
# so reads after the first write are effectively from RAM anyway.
_CACHE_DIR = Path(os.getenv("SMS_PDF_CACHE_DIR", "/tmp/sms_pdf_cache"))

# Hard limit: if the cache directory exceeds this, evict the oldest files
# until we're under it. 200MB is conservative for a school app that
# might have ~50 classes × ~5 exams = ~250 files at ~1MB each.
_MAX_CACHE_BYTES = 200 * 1024 * 1024  # 200 MB

# Regex used to determine if a filename matches a given prefix key.
# Keys are slugified to filesystem-safe names (see _slugify_key).
_PREFIX_RE = re.compile(r"^([a-z0-9]+[_-])")


# ── Internal helpers ─────────────────────────────────────────────────────────────

def _ensure_dir() -> Path:
    """Create the cache directory if it doesn't exist. Idempotent."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return _CACHE_DIR


def _slugify_key(key: str) -> str:
    """Convert a cache key like 'marksheet:class:3:exam:7' to a safe filename."""
    return re.sub(r"[^a-zA-Z0-9._-]", "_", key)


def cache_path_for(key: str) -> Path:
    """Return the deterministic file path for a given cache key."""
    return _ensure_dir() / _slugify_key(key)


# ── Public API ───────────────────────────────────────────────────────────────────

def get_cached_pdf(key: str) -> Optional[Path]:
    """Return the file Path if cached, None otherwise.

    The caller can read the bytes directly or pass the path to
    FileResponse for zero-copy sendfile streaming.
    """
    path = cache_path_for(key)
    if path.is_file():
        logger.debug("PDF file cache hit: %s (%d bytes)", key, path.stat().st_size)
        return path
    return None


def store_pdf(key: str, pdf_bytes: bytes) -> Path:
    """Write PDF bytes to disk. Returns the file path.

    Handles mkdir automatically. If the cache dir exceeds the size limit,
    evicts oldest files first.
    """
    path = cache_path_for(key)
    path.write_bytes(pdf_bytes)
    logger.debug("PDF file cache store: %s (%d bytes)", key, len(pdf_bytes))
    _enforce_size_limit()
    return path


def invalidate_prefix(prefix: str) -> int:
    """Delete all cached files whose key starts with ``prefix``.

    Returns the number of files deleted. Safe to call even if nothing matches.
    Used by marks save/lock/unlock to bust stale class marksheet PDFs.
    """
    slug_prefix = _slugify_key(prefix)
    deleted = 0
    try:
        for f in _ensure_dir().iterdir():
            if f.name.startswith(slug_prefix):
                f.unlink(missing_ok=True)
                deleted += 1
    except OSError as exc:
        logger.warning("Failed to invalidate PDF cache prefix '%s': %s", prefix, exc)
    if deleted:
        logger.info("PDF file cache invalidated %d files matching '%s'", deleted, prefix)
    return deleted


def invalidate_all() -> int:
    """Delete every file in the cache. Returns count deleted."""
    deleted = 0
    try:
        for f in _ensure_dir().iterdir():
            if f.is_file():
                f.unlink(missing_ok=True)
                deleted += 1
    except OSError as exc:
        logger.warning("Failed to clear PDF file cache: %s", exc)
    return deleted


# ── Size limit enforcement ───────────────────────────────────────────────────────

def _enforce_size_limit() -> None:
    """If total cache size exceeds _MAX_CACHE_BYTES, evict oldest files."""
    try:
        files = [
            (f, f.stat().st_mtime_ns, f.stat().st_size)
            for f in _ensure_dir().iterdir()
            if f.is_file()
        ]
    except OSError:
        return

    if not files:
        return

    total_size = sum(size for _, _, size in files)
    if total_size <= _MAX_CACHE_BYTES:
        return

    # Sort by access time (oldest first) — evict those first.
    files.sort(key=lambda t: t[1])
    logger.info(
        "PDF file cache is %dMB (limit %dMB) — evicting oldest files",
        total_size // (1024 * 1024),
        _MAX_CACHE_BYTES // (1024 * 1024),
    )

    for path, _, size in files:
        if total_size <= _MAX_CACHE_BYTES:
            break
        try:
            path.unlink(missing_ok=True)
        except OSError:
            continue
        total_size -= size
