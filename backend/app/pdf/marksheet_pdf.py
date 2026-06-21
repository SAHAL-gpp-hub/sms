import base64
import logging
import os
from datetime import date
from functools import lru_cache

from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session

from app.models.base_models import Student, Class, AcademicYear, Exam
from app.pdf import pdf_cache
from app.pdf.report_pdf import _logo_b64, _merge_pdfs
from app.services.marks_service import get_class_results

logger = logging.getLogger("sms.pdf.marksheet")

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__))

# ── Fix 2: a single long-lived Jinja2 environment per module ──────────────────
_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
_env.finalize = lambda x: '' if x is None else x


def _html_renderer():
    from weasyprint import HTML
    return HTML


def render_marksheet_pdf(
    db: Session,
    exam_id: int,
    class_id: int,
    student_id: int = None
) -> bytes:
    """Render a marksheet PDF for one student or a whole class.

    Fix 4: for a full class, each student's page is rendered as an independent
    HTML chunk and run through a process pool in parallel (WeasyPrint is not
    thread-safe, but is process-safe), then the resulting single-page PDFs are
    merged. A single student renders inline with no pool overhead.
    Fix 8: single-student marksheets are cached (immutable after lock); class
    marksheets are not (large, low repeat value).
    """
    # Get exam info
    exam = db.query(Exam).filter_by(id=exam_id).first()
    cls = db.query(Class).filter_by(id=class_id).first()
    year = db.query(AcademicYear).filter_by(id=cls.academic_year_id).first() if cls else None

    # Get results
    results = get_class_results(db, exam_id, class_id)

    # Filter to single student if requested
    if student_id:
        results = [r for r in results if r["student_id"] == student_id]

    if not results:
        return None

    # Enrich with student details
    for r in results:
        student = db.query(Student).filter_by(id=r["student_id"]).first()
        r["name_gu"] = student.name_gu if student else "—"
        r["name_en"] = student.name_en if student else "—"
        r["gr_number"] = student.gr_number if student else "—"
        r["dob"] = str(student.dob) if student else "—"
        r["class_name"] = cls.name if cls else "—"
        r["division"] = cls.division if cls else "A"

    template = _env.get_template("marksheet_template.html")

    # Single-student path: render inline, cache the result.
    if student_id:
        cache_key = pdf_cache.marksheet_student_key(student_id, exam_id)
        cached = pdf_cache.cache_get(cache_key)
        if cached:
            return cached

        html_content = template.render(
            students=results,
            exam_name=exam.name if exam else "Exam",
            academic_year=year.label if year else "2025-26",
            generated_date=date.today().strftime("%d %B %Y"),
            logo_src=_logo_b64(),
        )
        pdf_bytes = _html_renderer()(string=html_content, base_url=TEMPLATE_DIR).write_pdf()
        if pdf_bytes:
            pdf_cache.cache_set(cache_key, pdf_bytes)
        return pdf_bytes

    # ── Class path: one HTML chunk per student, rendered in parallel ────────
    logo = _logo_b64()
    render_ctx = dict(
        exam_name=exam.name if exam else "Exam",
        academic_year=year.label if year else "2025-26",
        generated_date=date.today().strftime("%d %B %Y"),
        logo_src=logo,
    )
    html_chunks = [template.render(students=[r], **render_ctx) for r in results]

    if len(html_chunks) == 1:
        # Degenerate case: class has one student — no pool overhead.
        return _html_renderer()(
            string=html_chunks[0], base_url=TEMPLATE_DIR
        ).write_pdf()

    # Local import keeps the pool out of the single-student hot path.
    from app.pdf.pdf_worker import render_html_chunks_parallel
    pdf_pages = render_html_chunks_parallel(
        [(chunk, TEMPLATE_DIR) for chunk in html_chunks]
    )
    return _merge_pdfs(pdf_pages)
