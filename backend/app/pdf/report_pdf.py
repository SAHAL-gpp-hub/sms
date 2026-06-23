import base64
import io
import logging
import os
from datetime import date
from functools import lru_cache

from jinja2 import Environment, FileSystemLoader
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.base_models import (
    AcademicYear, Class, Enrollment, Exam,
    FeePayment, FeeStructure, Student, StudentFee,
)
from app.pdf import pdf_cache
from app.services.attendance_service import get_monthly_summary
from app.services.fee_service import get_defaulters
from app.services.marks_service import get_class_results, get_subjects

logger = logging.getLogger("sms.pdf")

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__))
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December']

# ── Fix 2: a single long-lived Jinja2 environment per module ──────────────────
# Previously every render function rebuilt Environment(loader=FileSystemLoader),
# which re-reads and re-compiles template source on every request. Jinja2 caches
# compiled templates on the Environment, so a module-level env amortizes that.
_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
_env.finalize = lambda x: '' if x is None else x  # render None as "" like before


def _html_renderer():
    from weasyprint import HTML
    return HTML


def _render_pdf(html: str) -> bytes:
    return _html_renderer()(
        string=html,
        base_url=TEMPLATE_DIR
    ).write_pdf()


# ── Fix 1: embed the logo as a base64 data URL once, at first use ─────────────
# Before, every render resolved `logo.jpeg` from disk via base_url (and once per
# page for multi-page docs). Reading it once and caching the data URL removes
# all per-render disk I/O.
@lru_cache(maxsize=1)
def _logo_b64() -> str:
    path = os.path.join(TEMPLATE_DIR, "logo.jpeg")
    try:
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return f"data:image/jpeg;base64,{data}"
    except OSError as exc:
        logger.warning("Could not read logo at %s: %s — templates will fall back.", path, exc)
        return ""


# ── Fix 4 helper: merge multiple single-page PDFs into one document ──────────
def _merge_pdfs(pdf_list: list[bytes]) -> bytes:
    from pypdf import PdfWriter
    writer = PdfWriter()
    for pdf_bytes in pdf_list:
        writer.append(io.BytesIO(pdf_bytes))
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _humanize_class(name: str) -> str:
    """'1' → 'Class 1', 'nursery' → 'Nursery', 'lkg' → 'LKG', etc."""
    if not name:
        return "—"
    low = str(name).strip().lower()
    if low == "nursery":
        return "Nursery"
    if low in ("lkg", "ukg"):
        return low.upper()
    try:
        int(low)
        return f"Class {low}"
    except ValueError:
        return name


def render_defaulter_report(
    db: Session, academic_year_id: int = None, class_id: int = None
) -> bytes:
    # link_legacy=False: the defaulter PDF is a READ path. Self-healing of legacy
    # unlinked fees is a write and should not run on every report download — the
    # interactive defaulters list (admin UI) keeps link_legacy=True.
    defaulters = get_defaulters(
        db,
        class_id=class_id,
        academic_year_id=academic_year_id,
        link_legacy=False,
    )
    year = db.query(AcademicYear).filter_by(is_current=True).first()
    cls = db.query(Class).filter_by(id=class_id).first() if class_id else None

    total_outstanding = sum(d["balance"] for d in defaulters)
    total_collected   = sum(d["total_paid"] for d in defaulters)
    total_due         = sum(d["total_due"] for d in defaulters)

    # Group by class for the per-grade sections in the report.
    grouped: list[dict] = []
    current_class = None
    bucket: list[dict] = []
    for d in defaulters:
        if d["class_name"] != current_class:
            if bucket:
                grouped.append({"class_name": current_class, "rows": bucket})
            current_class = d["class_name"]
            bucket = []
        bucket.append(d)
    if bucket:
        grouped.append({"class_name": current_class, "rows": bucket})

    scope_label = "All Classes"
    if cls:
        scope_label = _humanize_class(cls.name) + (f" – {cls.division}" if cls.division else "")

    template = _env.get_template("defaulter_report.html")
    html = template.render(
        defaulters=defaulters,
        grouped=grouped,
        scope_label=scope_label,
        academic_year=year.label if year else "2025-26",
        total_outstanding=total_outstanding,
        total_collected=total_collected,
        total_due=total_due,
        generated_date=date.today().strftime("%d %B %Y"),
        logo_src=_logo_b64(),
    )
    return _render_pdf(html)


def render_attendance_report(db: Session, class_id: int, year: int, month: int) -> bytes:
    cls = db.query(Class).filter_by(id=class_id).first()
    summary = get_monthly_summary(db, class_id, year, month)

    template = _env.get_template("attendance_report.html")
    html = template.render(
        summary=summary,
        class_name=cls.name if cls else "—",
        month_name=MONTHS[month - 1],
        year=year,
        generated_date=date.today().strftime("%d %B %Y"),
        logo_src=_logo_b64(),
    )
    return _render_pdf(html)


def render_result_report(db: Session, exam_id: int, class_id: int) -> bytes:
    cls = db.query(Class).filter_by(id=class_id).first()
    exam = db.query(Exam).filter_by(id=exam_id).first()
    year = db.query(AcademicYear).filter_by(
        id=cls.academic_year_id
    ).first() if cls else None
    results = get_class_results(db, exam_id, class_id)
    subjects = get_subjects(db, class_id)
    subject_names = [s.name for s in subjects]

    if not results:
        return None

    template = _env.get_template("result_report.html")
    html = template.render(
        results=results,
        subjects=subject_names,
        class_name=cls.name if cls else "—",
        exam_name=exam.name if exam else "Exam",
        academic_year=year.label if year else "2025-26",
        generated_date=date.today().strftime("%d %B %Y"),
        logo_src=_logo_b64(),
    )
    return _render_pdf(html)


def render_tc_pdf(db: Session, student_id: int, reason: str, conduct: str) -> bytes:
    from app.services.yearend_service import get_tc_data
    data = get_tc_data(db, student_id, reason, conduct)
    if not data:
        return None

    template = _env.get_template("tc_template.html")
    html = template.render(**data, logo_src=_logo_b64())
    return _render_pdf(html)


def render_fee_receipt_pdf(db: Session, payment_id: int) -> bytes | None:
    """
    Generate a consolidated PDF receipt for a payment session.

    All FeePayment rows that share the same receipt_number as the given
    payment_id are grouped onto ONE receipt — so paying ₹750 split across
    Tuition/Exam/Activity produces a single receipt listing all three lines,
    not three separate PDFs.

    Fix 3: previously fired one SUM(amount_paid) query per sibling payment AND
    one per StudentFee in `all_student_fees` (5–10 queries for a typical split
    payment). Now both are collapsed into a single grouped query.
    Fix 8: receipts are immutable once a payment is recorded, so the rendered
    PDF is cached in Redis for repeat downloads.
    """
    # ── Fix 8: serve from cache before doing any DB work ──────────────────────
    cache_key = pdf_cache.receipt_key(payment_id)
    cached = pdf_cache.cache_get(cache_key)
    if cached:
        return cached

    payment = db.query(FeePayment).filter(FeePayment.id == payment_id).first()
    if not payment:
        return None

    # ── Collect all FeePayment rows in this receipt group ────────────
    sibling_payments = (
        db.query(FeePayment)
        .filter(FeePayment.receipt_number == payment.receipt_number)
        .order_by(FeePayment.id)
        .all()
    )

    # ── Resolve student from the first payment ────────────────────────
    first_sf = db.query(StudentFee).filter_by(id=payment.student_fee_id).first()
    if not first_sf:
        return None

    student = None
    enrollment = None

    if first_sf.student_id:
        student = db.query(Student).filter_by(id=first_sf.student_id).first()

    if first_sf.enrollment_id:
        enrollment = db.query(Enrollment).filter_by(id=first_sf.enrollment_id).first()
        if not student and enrollment:
            student = db.query(Student).filter_by(id=enrollment.student_id).first()

    if not student:
        return None

    # ── Class lookup ──────────────────────────────────────────────────
    if enrollment:
        cls = db.query(Class).filter_by(id=enrollment.class_id).first()
    elif hasattr(student, 'class_id') and student.class_id:
        cls = db.query(Class).filter_by(id=student.class_id).first()
    else:
        cls = None

    # ── Total outstanding across ALL student fees ────────────────────
    # Fetched BEFORE allocations because the joined StudentFee rows (with their
    # fee_head names) are reused for both code paths below.
    all_student_fees = (
        db.query(StudentFee)
        .options(joinedload(StudentFee.fee_structure).joinedload(FeeStructure.fee_head))
        .outerjoin(Enrollment, Enrollment.id == StudentFee.enrollment_id)
        .filter(
            or_(
                StudentFee.student_id == student.id,
                Enrollment.student_id == student.id,
            )
        )
        .all()
    )
    all_sf_ids = {sf.id for sf in all_student_fees}
    sibling_sf_ids = {p.student_fee_id for p in sibling_payments}

    # ── Fix 3: ONE grouped query for every paid-to-date sum we need ────────
    # Covers both the per-StudentFee balances (for the receipt's sibling rows
    # and the total outstanding). Replaces one SUM query per fee head.
    ids_for_paid_sums = list(all_sf_ids | sibling_sf_ids)
    paid_sums: dict[int, float] = {}
    if ids_for_paid_sums:
        rows = (
            db.query(
                FeePayment.student_fee_id,
                func.coalesce(func.sum(FeePayment.amount_paid), 0),
            )
            .filter(FeePayment.student_fee_id.in_(ids_for_paid_sums))
            .group_by(FeePayment.student_fee_id)
            .all()
        )
        paid_sums = {sf_id: float(total) for sf_id, total in rows}

    # Index all_student_fees by id so sibling rows resolve without per-row queries
    sf_by_id = {sf.id: sf for sf in all_student_fees}

    # ── Build allocation rows (one per sibling payment) ──────────────
    allocations = []
    total_amount_paid = 0.0

    for p in sibling_payments:
        sf = sf_by_id.get(p.student_fee_id)
        if sf is None:
            # Sibling fee isn't in the student's own set — fetch once as a fallback
            sf = db.query(StudentFee).filter_by(id=p.student_fee_id).first()
        if not sf:
            continue

        fee_head_name = "General Fee"
        if sf.fee_structure is not None and sf.fee_structure.fee_head is not None:
            fee_head_name = sf.fee_structure.fee_head.name

        total_paid_for_sf = paid_sums.get(sf.id, 0.0)
        balance_after = max(0.0, float(sf.net_amount) - total_paid_for_sf)

        allocations.append({
            "fee_head_name": fee_head_name,
            "amount_paid": float(p.amount_paid or 0),
            "balance_after": balance_after,
        })
        total_amount_paid += float(p.amount_paid or 0)

    # ── Total outstanding (from pre-fetched paid_sums dict — no DB calls) ───
    total_balance_after = 0.0
    for sf in all_student_fees:
        paid = paid_sums.get(sf.id, 0.0)
        total_balance_after += max(0.0, float(sf.net_amount) - paid)

    # ── Render consolidated receipt ───────────────────────────────────
    template = _env.get_template("fee_receipt_template.html")
    html = template.render(
        receipt={
            "receipt_number": payment.receipt_number,
            "date": payment.payment_date.strftime("%d-%m-%Y") if payment.payment_date else "",
            "student_name": student.name_en,
            "gr_number": student.gr_number or "—",
            "class_name": f"{cls.name}-{cls.division}" if cls else "—",
            "mode": payment.mode or "—",
            "fee_items": [
                {
                    "fee_head": a["fee_head_name"],
                    "amount": "{:,.0f}".format(a["amount_paid"]),
                }
                for a in allocations
            ],
            "total_paid": "{:,.0f}".format(total_amount_paid),
        },
        logo_src=_logo_b64(),
    )
    pdf = _render_pdf(html)

    # ── Fix 8: cache the rendered PDF for repeat downloads ────────────────
    if pdf:
        pdf_cache.cache_set(cache_key, pdf)
    return pdf
