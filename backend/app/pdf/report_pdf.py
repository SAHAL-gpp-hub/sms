from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from app.models.base_models import AcademicYear, Class, Exam
from app.services.fee_service import get_defaulters
from app.services.attendance_service import get_monthly_summary
from app.services.marks_service import get_class_results, get_subjects
from datetime import date
import os

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__))
MONTHS = ['January','February','March','April','May','June',
          'July','August','September','October','November','December']

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
    return HTML(string=html).write_pdf()

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
    return HTML(string=html).write_pdf()

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
    # Add undefined=Undefined to handle None gracefully
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
    return HTML(string=html).write_pdf()

def render_tc_pdf(db: Session, student_id: int, reason: str, conduct: str) -> bytes:
    from app.services.yearend_service import get_tc_data
    data = get_tc_data(db, student_id, reason, conduct)
    if not data:
        return None

    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template("tc_template.html")
    html = template.render(**data)
    return HTML(string=html).write_pdf()