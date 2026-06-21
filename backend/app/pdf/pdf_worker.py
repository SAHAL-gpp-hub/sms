"""Process pool for parallel PDF rendering.

WeasyPrint is NOT thread-safe (it shares font/CSS state across calls in the
same interpreter), but it is safe to run one instance per OS process. A class
of 40 students rendered sequentially takes ~40× a single page; rendering each
student's HTML in a separate worker and merging the resulting PDFs cuts that
to roughly ceil(N / workers) × single-page time.

The pool is created lazily on first use and sized to the smaller of 4 or the
CPU count. WeasyPrint is imported INSIDE the worker function so the parent
process never pays the import cost and workers don't share state.
"""

from __future__ import annotations

import logging
import os
from multiprocessing import Pool

logger = logging.getLogger("sms.pdf_worker")

_POOL: Pool | None = None


def get_pool() -> Pool:
    """Return a lazily-created, long-lived process pool."""
    global _POOL
    if _POOL is None:
        workers = min(4, os.cpu_count() or 2)
        logger.info("Creating PDF render pool with %d workers.", workers)
        _POOL = Pool(processes=workers)
    return _POOL


def _render_one_html(args: tuple[str, str]) -> bytes:
    """Run in a worker process. Import WeasyPrint locally to avoid shared state.

    Args:
        args: (html_str, base_url) — the rendered HTML chunk and the base URL
              for resolving any remaining relative references.
    """
    html_str, base_url = args
    from weasyprint import HTML  # imported in worker to keep parent lean
    return HTML(string=html_str, base_url=base_url).write_pdf()


def render_html_chunks_parallel(chunks: list[tuple[str, str]]) -> list[bytes]:
    """Render a list of (html, base_url) chunks in parallel; return PDF bytes each.

    Caller is responsible for merging the returned PDFs (see report_pdf._merge_pdfs).
    """
    pool = get_pool()
    return pool.map(_render_one_html, chunks)
