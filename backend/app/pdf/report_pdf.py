from jinja2 import Environment, FileSystemLoader
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from app.models.base_models import (
    AcademicYear, Class, Enrollment, Exam,
    FeePayment, Student, StudentFee,
)
from app.services.fee_service import get_defaulters
from app.services.attendance_service import get_monthly_summary
from app.services.marks_service import get_class_results, get_subjects
from datetime import date
import os

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__))
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December']


def _html_renderer():
    from weasyprint import HTML
    return HTML

def _render_pdf(html: str) -> bytes:
    return _html_renderer()(
        string=html,
        base_url=TEMPLATE_DIR
    ).write_pdf()


def render_defaulter_report(db: Session, academic_year_id: int = None) -> bytes:
    defaulters = get_defaulters(db, academic_year_id=academic_year_id)
    year = db.query(AcademicYear).filter_by(is_current=True).first()

    total_outstanding = sum(d["balance"] for d in defaulters)
    total_collected = sum(d["total_paid"] for d in defaulters)

    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template("defaulter_report.html")
    html = template.render(
        defaulters=defaulters,
        academic_year=year.label if year else "2025-26",
        total_outstanding=total_outstanding,
        total_collected=total_collected,
        generated_date=date.today().strftime("%d %B %Y")
    )
    return _render_pdf(html)


def render_attendance_report(db: Session, class_id: int, year: int, month: int) -> bytes:
    cls = db.query(Class).filter_by(id=class_id).first()
    summary = get_monthly_summary(db, class_id, year, month)

    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template("attendance_report.html")
    html = template.render(
        summary=summary,
        class_name=cls.name if cls else "—",
        month_name=MONTHS[month - 1],
        year=year,
        generated_date=date.today().strftime("%d %B %Y")
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

    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    env.finalize = lambda x: '' if x is None else x
    template = env.get_template("result_report.html")
    html = template.render(
        results=results,
        subjects=subject_names,
        class_name=cls.name if cls else "—",
        exam_name=exam.name if exam else "Exam",
        academic_year=year.label if year else "2025-26",
        generated_date=date.today().strftime("%d %B %Y")
    )
    return _render_pdf(html)


def render_tc_pdf(db: Session, student_id: int, reason: str, conduct: str) -> bytes:
    from app.services.yearend_service import get_tc_data
    data = get_tc_data(db, student_id, reason, conduct)
    if not data:
        return None

    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template("tc_template.html")
    html = template.render(**data)
    return _render_pdf(html)


def render_fee_receipt_pdf(db: Session, payment_id: int) -> bytes | None:
    """
    Generate a consolidated PDF receipt for a payment session.

    All FeePayment rows that share the same receipt_number as the given
    payment_id are grouped onto ONE receipt — so paying ₹750 split across
    Tuition/Exam/Activity produces a single receipt listing all three lines,
    not three separate PDFs.
    """
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

    # ── Build allocation rows (one per sibling payment) ──────────────
    allocations = []
    total_amount_paid = 0.0

    for p in sibling_payments:
        sf = db.query(StudentFee).filter_by(id=p.student_fee_id).first()
        if not sf:
            continue

        fee_head_name = "General Fee"
        if sf.fee_structure is not None and sf.fee_structure.fee_head is not None:
            fee_head_name = sf.fee_structure.fee_head.name

        total_paid_for_sf = float(
            db.query(func.coalesce(func.sum(FeePayment.amount_paid), 0))
            .filter(FeePayment.student_fee_id == sf.id)
            .scalar()
        )
        balance_after = max(0.0, float(sf.net_amount) - total_paid_for_sf)

        allocations.append({
            "fee_head_name": fee_head_name,
            "amount_paid": float(p.amount_paid or 0),
            "balance_after": balance_after,
        })
        total_amount_paid += float(p.amount_paid or 0)

    # ── Total outstanding across ALL student fees ────────────────────
    all_student_fees = (
        db.query(StudentFee)
        .outerjoin(Enrollment, Enrollment.id == StudentFee.enrollment_id)
        .filter(
            or_(
                StudentFee.student_id == student.id,
                Enrollment.student_id == student.id,
            )
        )
        .all()
    )
    total_balance_after = 0.0
    for sf in all_student_fees:
        paid = float(
            db.query(func.coalesce(func.sum(FeePayment.amount_paid), 0))
            .filter(FeePayment.student_fee_id == sf.id)
            .scalar()
        )
        total_balance_after += max(0.0, float(sf.net_amount) - paid)

    # ── Render consolidated receipt ───────────────────────────────────
    # ── Render consolidated receipt ───────────────────────────────────
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template("fee_receipt_template.html")
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
        }
    )
    return _render_pdf(html)