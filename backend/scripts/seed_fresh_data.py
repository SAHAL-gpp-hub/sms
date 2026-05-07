#!/usr/bin/env python3
"""
Reset and seed a coherent local/demo dataset.

This script is intentionally deterministic so activation, portal linking,
fees, marks, and attendance can be debugged without inherited data pollution.
Run inside the backend container:
    python scripts/seed_fresh_data.py
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import text

from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models.base_models import (
    AcademicYear,
    Attendance,
    Class,
    Enrollment,
    EnrollmentStatusEnum,
    Exam,
    FeeHead,
    FeePayment,
    FeeStructure,
    GenderEnum,
    Mark,
    Student,
    StudentFee,
    StudentStatusEnum,
    Subject,
    TeacherClassAssignment,
    User,
)


def reset_database() -> None:
    Base.metadata.create_all(bind=engine)
    table_names = [
        table.name
        for table in Base.metadata.sorted_tables
        if table.name != "alembic_version"
    ]
    if not table_names:
        return
    quoted = ", ".join(f'"{name}"' for name in table_names)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))


def make_user(name: str, email: str, password: str, role: str) -> User:
    return User(
        name=name,
        email=email,
        password_hash=get_password_hash(password),
        role=role,
        is_active=True,
    )


def add_student(
    db,
    *,
    student_id: str,
    gr_number: str,
    name_en: str,
    name_gu: str,
    dob: date,
    gender: GenderEnum,
    class_obj: Class,
    roll_number: int,
    father_name: str,
    mother_name: str,
    contact: str,
    address: str,
    student_email: str | None,
    guardian_email: str | None,
    academic_year: AcademicYear,
    student_user: User | None = None,
    parent_user: User | None = None,
) -> Student:
    student = Student(
        student_id=student_id,
        gr_number=gr_number,
        name_en=name_en,
        name_gu=name_gu,
        dob=dob,
        gender=gender,
        class_id=class_obj.id,
        roll_number=roll_number,
        father_name=father_name,
        mother_name=mother_name,
        contact=contact,
        student_email=student_email,
        student_phone=contact,
        guardian_email=guardian_email,
        guardian_phone=contact,
        address=address,
        category="GEN",
        aadhar_last4=f"{2300 + roll_number}"[-4:],
        admission_date=academic_year.start_date,
        academic_year_id=academic_year.id,
        student_user_id=student_user.id if student_user else None,
        parent_user_id=parent_user.id if parent_user else None,
        status=StudentStatusEnum.Active,
    )
    db.add(student)
    db.flush()
    db.add(
        Enrollment(
            student_id=student.id,
            academic_year_id=academic_year.id,
            class_id=class_obj.id,
            roll_number=str(roll_number),
            original_roll_number=str(roll_number),
            status=EnrollmentStatusEnum.active,
            enrolled_on=academic_year.start_date,
        )
    )
    return student


def seed() -> None:
    reset_database()
    db = SessionLocal()
    try:
        # The live PostgreSQL enum is named yearsstatusenum from an older
        # migration, while the model enum is YearStatusEnum. Insert with the
        # database enum explicitly so seeding works against the real schema.
        db.execute(
            text(
                """
                INSERT INTO academic_years
                    (label, start_date, end_date, is_current, is_upcoming, status)
                VALUES
                    ('2025-26', '2025-06-01', '2026-04-30', TRUE, FALSE, 'active'::yearsstatusenum),
                    ('2026-27', '2026-06-01', '2027-04-30', FALSE, TRUE, 'draft'::yearsstatusenum)
                """
            )
        )
        db.flush()
        current_year = db.query(AcademicYear).filter_by(label="2025-26").one()
        next_year = db.query(AcademicYear).filter_by(label="2026-27").one()

        classes: dict[str, Class] = {}
        for year in [current_year, next_year]:
            for standard in ["5", "7", "10"]:
                cls = Class(
                    name=standard,
                    division="A",
                    academic_year_id=year.id,
                    capacity=40,
                    medium="English",
                    promotion_status="not_started",
                )
                db.add(cls)
                db.flush()
                if year.id == current_year.id:
                    classes[standard] = cls

        admin = make_user("School Admin", "admin@iqraschool.in", "admin123", "admin")
        class_teacher = make_user("Meera Shah", "teacher7@iqraschool.in", "teacher123", "teacher")
        math_teacher = make_user("Rohan Patel", "math.teacher@iqraschool.in", "teacher123", "teacher")
        linked_student_user = make_user("Linked Demo Student", "linked.student@example.com", "student123", "student")
        linked_parent_user = make_user("Linked Demo Parent", "linked.parent@example.com", "parent123", "parent")
        db.add_all([admin, class_teacher, math_teacher, linked_student_user, linked_parent_user])
        db.flush()

        students = [
            add_student(
                db,
                student_id="STU-2025-001",
                gr_number="GR2025001",
                name_en="Aryan Patel",
                name_gu="આર્યન પટેલ",
                dob=date(2012, 4, 15),
                gender=GenderEnum.M,
                class_obj=classes["7"],
                roll_number=1,
                father_name="Ramesh Patel",
                mother_name="Sunita Patel",
                contact="9876543201",
                address="12 Gandhi Nagar, Palanpur",
                student_email="manasiyasahal98@gmail.com",
                guardian_email="ramesh.parent@example.com",
                academic_year=current_year,
            ),
            add_student(
                db,
                student_id="STU-2025-002",
                gr_number="GR2025002",
                name_en="Zoya Sheikh",
                name_gu="ઝોયા શેખ",
                dob=date(2012, 7, 22),
                gender=GenderEnum.F,
                class_obj=classes["7"],
                roll_number=2,
                father_name="Imran Sheikh",
                mother_name="Fatima Sheikh",
                contact="9876543202",
                address="45 Nehru Road, Palanpur",
                student_email="zoya.student@example.com",
                guardian_email="imran.parent@example.com",
                academic_year=current_year,
            ),
            add_student(
                db,
                student_id="STU-2025-003",
                gr_number="GR2025003",
                name_en="Dhruv Sharma",
                name_gu="ધ્રુવ શર્મા",
                dob=date(2012, 1, 10),
                gender=GenderEnum.M,
                class_obj=classes["7"],
                roll_number=3,
                father_name="Vikram Sharma",
                mother_name="Priya Sharma",
                contact="9876543203",
                address="8 Station Road, Palanpur",
                student_email="linked.student@example.com",
                guardian_email="linked.parent@example.com",
                academic_year=current_year,
                student_user=linked_student_user,
                parent_user=linked_parent_user,
            ),
            add_student(
                db,
                student_id="STU-2025-004",
                gr_number="GR2025004",
                name_en="Riya Modi",
                name_gu="રિયા મોદી",
                dob=date(2014, 6, 12),
                gender=GenderEnum.F,
                class_obj=classes["5"],
                roll_number=1,
                father_name="Ajay Modi",
                mother_name="Kavita Modi",
                contact="9876543204",
                address="10 MG Road, Palanpur",
                student_email="riya.student@example.com",
                guardian_email="ajay.parent@example.com",
                academic_year=current_year,
            ),
            add_student(
                db,
                student_id="STU-2025-005",
                gr_number="GR2025005",
                name_en="Kabir Ansari",
                name_gu="કબીર અન્સારી",
                dob=date(2010, 11, 30),
                gender=GenderEnum.M,
                class_obj=classes["10"],
                roll_number=1,
                father_name="Salim Ansari",
                mother_name="Noor Ansari",
                contact="9876543205",
                address="67 Bhagat Singh Nagar, Palanpur",
                student_email="kabir.student@example.com",
                guardian_email="salim.parent@example.com",
                academic_year=current_year,
            ),
        ]

        subject_specs = [
            ("English", "ENG", 80, 20),
            ("Gujarati", "GUJ", 80, 20),
            ("Mathematics", "MAT", 100, 0),
            ("Science", "SCI", 80, 20),
            ("Social Studies", "SST", 100, 0),
        ]
        subjects_by_class: dict[int, list[Subject]] = {}
        for cls in classes.values():
            subjects_by_class[cls.id] = []
            for name, code, theory, practical in subject_specs:
                subject = Subject(
                    name=name,
                    code=code,
                    class_id=cls.id,
                    max_theory=theory,
                    max_practical=practical,
                    passing_marks=33,
                    subject_type="Theory",
                    is_active=True,
                    is_exam_eligible=True,
                )
                db.add(subject)
                db.flush()
                subjects_by_class[cls.id].append(subject)

        for teacher, subject in [(class_teacher, None), (math_teacher, subjects_by_class[classes["7"].id][2])]:
            db.add(
                TeacherClassAssignment(
                    teacher_id=teacher.id,
                    class_id=classes["7"].id,
                    academic_year_id=current_year.id,
                    subject_id=subject.id if subject else None,
                )
            )

        exams_by_class: dict[int, list[Exam]] = {}
        for cls in classes.values():
            exams_by_class[cls.id] = []
            for name, exam_date, weightage in [
                ("Unit Test 1", date(2025, 8, 15), Decimal("10.00")),
                ("Half-Yearly", date(2025, 11, 20), Decimal("30.00")),
                ("Annual", date(2026, 3, 10), Decimal("60.00")),
            ]:
                exam = Exam(
                    name=name,
                    class_id=cls.id,
                    exam_date=exam_date,
                    academic_year_id=current_year.id,
                    weightage=weightage,
                )
                db.add(exam)
                db.flush()
                exams_by_class[cls.id].append(exam)

        fee_heads = [
            FeeHead(name="Tuition Fee", frequency="Monthly", description="Monthly tuition", is_active=True),
            FeeHead(name="Exam Fee", frequency="Term", description="Exam and assessment fee", is_active=True),
            FeeHead(name="Activity Fee", frequency="Annual", description="Sports and activities", is_active=True),
        ]
        db.add_all(fee_heads)
        db.flush()

        fee_amounts = {"5": [900, 350, 250], "7": [1200, 500, 300], "10": [1500, 700, 400]}
        fee_structures_by_class: dict[int, list[FeeStructure]] = {}
        for standard, cls in classes.items():
            fee_structures_by_class[cls.id] = []
            for head, amount in zip(fee_heads, fee_amounts[standard], strict=True):
                structure = FeeStructure(
                    class_id=cls.id,
                    fee_head_id=head.id,
                    amount=Decimal(amount),
                    due_date=date(2025, 7, 15),
                    academic_year_id=current_year.id,
                )
                db.add(structure)
                db.flush()
                fee_structures_by_class[cls.id].append(structure)

        student_fees: dict[int, list[StudentFee]] = {}
        for student in students:
            student_fees[student.id] = []
            for structure in fee_structures_by_class[student.class_id]:
                fee = StudentFee(
                    student_id=student.id,
                    fee_structure_id=structure.id,
                    concession=Decimal("0"),
                    net_amount=structure.amount,
                    academic_year_id=current_year.id,
                    invoice_type="regular",
                )
                db.add(fee)
                db.flush()
                student_fees[student.id].append(fee)

        db.add(
            FeePayment(
                student_fee_id=student_fees[students[0].id][0].id,
                amount_paid=student_fees[students[0].id][0].net_amount,
                payment_date=date(2025, 7, 1),
                mode="Cash",
                receipt_number="RCPT-2025-0001",
                collected_by="School Admin",
            )
        )
        db.add(
            FeePayment(
                student_fee_id=student_fees[students[1].id][0].id,
                amount_paid=Decimal("600"),
                payment_date=date(2025, 7, 5),
                mode="UPI",
                receipt_number="RCPT-2025-0002",
                collected_by="School Admin",
            )
        )

        score_rows = {
            "STU-2025-001": [88, 82, 91, 85, 79],
            "STU-2025-002": [72, 75, 68, 81, 74],
            "STU-2025-003": [94, 89, 96, 92, 90],
            "STU-2025-004": [78, 80, 83, 76, 72],
            "STU-2025-005": [65, 69, 71, 67, 73],
        }
        for student in students:
            annual_exam = exams_by_class[student.class_id][-1]
            subjects = subjects_by_class[student.class_id]
            scores = score_rows[student.student_id]
            for subject, score in zip(subjects, scores, strict=True):
                db.add(
                    Mark(
                        student_id=student.id,
                        subject_id=subject.id,
                        exam_id=annual_exam.id,
                        theory_marks=Decimal(score),
                        practical_marks=Decimal("0"),
                        is_absent=False,
                    )
                )

        today = date.today()
        patterns = {
            students[0].id: ["P", "P", "P", "P", "P"],
            students[1].id: ["P", "P", "A", "P", "P"],
            students[2].id: ["P", "P", "P", "L", "P"],
            students[3].id: ["P", "A", "P", "P", "P"],
            students[4].id: ["A", "P", "P", "A", "P"],
        }
        for offset in range(5):
            attendance_date = today - timedelta(days=4 - offset)
            for student in students:
                db.add(
                    Attendance(
                        student_id=student.id,
                        class_id=student.class_id,
                        date=attendance_date,
                        status=patterns[student.id][offset],
                    )
                )

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Fresh SMS demo data seeded.")
    print("Admin login: admin@iqraschool.in / admin123")
    print("Teacher login: teacher7@iqraschool.in / teacher123")
    print("Linked student login: linked.student@example.com / student123")
    print("Linked parent login: linked.parent@example.com / parent123")
    print("Activation-ready student: STU-2025-001 + manasiyasahal98@gmail.com")
    print("Activation-ready parent: STU-2025-001 + ramesh.parent@example.com")
