from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from app.models.base_models import Student, Class, AcademicYear, Exam
from app.services.marks_service import get_class_results
from datetime import date
import os

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__))


def _html_renderer():
    from weasyprint import HTML
    return HTML

def render_marksheet_pdf(
    db: Session,
    exam_id: int,
    class_id: int,
    student_id: int = None
) -> bytes:
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
        r["gr_number"] = student.gr_number if student else "—"
        r["dob"] = str(student.dob) if student else "—"
        r["class_name"] = cls.name if cls else "—"
        r["division"] = cls.division if cls else "A"

    # Render template
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template("marksheet_template.html")
    html_content = template.render(
        students=results,
        exam_name=exam.name if exam else "Exam",
        academic_year=year.label if year else "2025-26",
        generated_date=date.today().strftime("%d %B %Y"),
    )

    # Generate PDF
    pdf_bytes = _html_renderer()(string=html_content).write_pdf()
    return pdf_bytes
