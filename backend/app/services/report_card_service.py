from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.base_models import Enrollment, Exam, ReportCard


def _get_exam(db: Session, exam_id: int) -> Exam | None:
    return db.query(Exam).filter_by(id=exam_id).first()


def upsert_report_card(
    db: Session,
    *,
    student_id: int,
    exam_id: int,
    pdf_path: str,
) -> ReportCard | None:
    exam = _get_exam(db, exam_id)
    if not exam:
        return None

    enrollment = db.query(Enrollment).filter_by(
        student_id=student_id,
        academic_year_id=exam.academic_year_id,
    ).first()
    if not enrollment:
        return None

    report_card = db.query(ReportCard).filter_by(
        enrollment_id=enrollment.id,
        exam_id=exam_id,
    ).first()
    if not report_card:
        report_card = ReportCard(
            enrollment_id=enrollment.id,
            exam_id=exam_id,
        )
        db.add(report_card)

    report_card.pdf_path = pdf_path
    report_card.generated_at = datetime.now(timezone.utc)
    return report_card


def upsert_class_report_cards(
    db: Session,
    *,
    class_id: int,
    exam_id: int,
) -> int:
    exam = _get_exam(db, exam_id)
    if not exam:
        return 0

    enrollments = db.query(Enrollment).filter_by(
        class_id=class_id,
        academic_year_id=exam.academic_year_id,
    ).all()

    count = 0
    for enrollment in enrollments:
        report_card = upsert_report_card(
            db,
            student_id=enrollment.student_id,
            exam_id=exam_id,
            pdf_path=(
                f"/api/v1/pdf/marksheet/student/{enrollment.student_id}"
                f"?exam_id={exam_id}&class_id={class_id}"
            ),
        )
        if report_card:
            count += 1
    return count
