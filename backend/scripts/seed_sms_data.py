#!/usr/bin/env python3
"""
scripts/seed_sms_data.py — SMS Data Seeding for Docker

Injects realistic test data into the SMS database.
Docker-safe: reads DATABASE_URL from environment, retries on cold-start.

Aligned to the actual schema (academic_years.label, students.name_en/name_gu,
students.dob, users.name, genderenum / studentstatusenum, etc.).
"""

import os
import sys
import time
from faker import Faker
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
import bcrypt

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set")
    sys.exit(1)

MAX_RETRIES = 5
RETRY_DELAY = 3


# ── DB connect with retry ─────────────────────────────────────────────────
def get_engine_with_retry():
    for attempt in range(MAX_RETRIES):
        try:
            engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"✓ Database connected (attempt {attempt + 1})")
            return engine
        except OperationalError as e:
            if attempt < MAX_RETRIES - 1:
                print(f"⚠️  Connection failed, retrying in {RETRY_DELAY}s... "
                      f"({attempt + 1}/{MAX_RETRIES})")
                time.sleep(RETRY_DELAY)
            else:
                print(f"❌ Failed to connect after {MAX_RETRIES} attempts\n   Error: {e}")
                sys.exit(1)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ── Main ──────────────────────────────────────────────────────────────────
def seed_data():
    print("\n" + "=" * 70)
    print("  SMS DATA SEEDING TOOL (DOCKER)")
    print("=" * 70 + "\n")

    engine = get_engine_with_retry()
    Session = sessionmaker(bind=engine)
    session = Session()

    fake = Faker(['en_US'])

    gujarati_first_names = [
        "અર્જુન", "ગૌરવ", "રાજેશ", "આનંદ", "વિક્રમ",
        "અંજલી", "પ્રિયા", "હર્ષા", "ઉષા", "નીતા",
    ]
    gujarati_last_names = [
        "જોશી", "શર્મા", "પટેલ", "વર્મા", "ગુપ્તા",
        "મલ્હોત્રા", "સિંહ", "ત્રિપાઠી", "મિશ્રા", "વર્માણી",
    ]

    try:
        print("🗄️  Checking database structure...")
        session.execute(text("SELECT 1 FROM academic_years LIMIT 1"))
        print("✓ Database tables exist\n")

        # ── 1. Academic Years ─────────────────────────────────────────────
        print("📅 Creating academic years...")
        academic_years = [
            {"label": "2023-24", "start_date": "2023-06-01", "end_date": "2024-04-30",
             "status": "closed", "is_current": False, "is_upcoming": False},
            {"label": "2024-25", "start_date": "2024-06-01", "end_date": "2025-04-30",
             "status": "active", "is_current": True,  "is_upcoming": False},
            {"label": "2025-26", "start_date": "2025-06-01", "end_date": "2026-04-30",
             "status": "draft",  "is_current": False, "is_upcoming": True},
        ]

        existing_years = session.execute(text("SELECT COUNT(*) FROM academic_years")).scalar()
        if existing_years == 0:
            for ay in academic_years:
                session.execute(text("""
                    INSERT INTO academic_years
                        (label, start_date, end_date, status, is_current, is_upcoming)
                    VALUES
                        (:label, :start_date, :end_date,
                         CAST(:status AS yearsstatusenum), :is_current, :is_upcoming)
                """), ay)
            session.commit()
            print(f"✓ Academic years created: {len(academic_years)}")
        else:
            print(f"✓ Academic years already exist: {existing_years}")

        # Resolve current year id (for FK columns below)
        current_year_id = session.execute(text("""
            SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1
        """)).scalar()
        if not current_year_id:
            current_year_id = session.execute(text(
                "SELECT id FROM academic_years ORDER BY id LIMIT 1"
            )).scalar()

        # ── 2. Classes ────────────────────────────────────────────────────
        print("📚 Creating classes...")
        class_names = ["Nursery", "LKG", "UKG"] + [f"Grade {i}" for i in range(1, 11)]
        divisions = ["A", "B"]

        existing_classes = session.execute(text("SELECT COUNT(*) FROM classes")).scalar()
        if existing_classes == 0:
            for cname in class_names:
                for div in divisions:
                    session.execute(text("""
                        INSERT INTO classes
                            (name, division, academic_year_id, capacity, medium, promotion_status)
                        VALUES
                            (:name, :division, :ay_id, :capacity, 'English', 'not_started')
                    """), {
                        "name": cname,
                        "division": div,
                        "ay_id": current_year_id,
                        "capacity": 40,
                    })
            session.commit()
            print(f"✓ Classes created: {len(class_names) * len(divisions)}")
        else:
            print(f"✓ Classes already exist: {existing_classes}")

        # ── 3. Users (admin, teachers, sample student/parent) ─────────────
        print("👥 Creating users...")
        existing_users = session.execute(text("SELECT COUNT(*) FROM users")).scalar()

        if existing_users < 5:
            # NOTE: schema has no created_at on users; uses single `name` column.
            user_rows = []

            # Admin
            user_rows.append({
                "name": "Admin User",
                "email": "admin@iqra.local",
                "password_hash": hash_password("admin123"),
                "role": "admin",
                "is_active": True,
            })

            # Teachers
            for i in range(20):
                user_rows.append({
                    "name": f"Teacher Patel {i + 1}",
                    "email": f"teacher{i + 1}@iqra.local",
                    "password_hash": hash_password("teacher123"),
                    "role": "teacher",
                    "is_active": True,
                })

            # Sample student user
            user_rows.append({
                "name": "Gaurav Joshi",
                "email": "gaurav.joshi@iqra.local",
                "password_hash": hash_password("student123"),
                "role": "student",
                "is_active": True,
            })

            # Sample parent user
            user_rows.append({
                "name": "Rajesh Patel",
                "email": "rajesh.patel@iqra.local",
                "password_hash": hash_password("parent123"),
                "role": "parent",
                "is_active": True,
            })

            for u in user_rows:
                session.execute(text("""
                    INSERT INTO users (name, email, password_hash, role, is_active)
                    VALUES (:name, :email, :password_hash, :role, :is_active)
                    ON CONFLICT (email) DO NOTHING
                """), u)
            session.commit()
            print(f"✓ Users created/updated ({len(user_rows)} attempted)")
        else:
            print(f"✓ Users already exist: {existing_users}")

        # ── 4. Students (sample) ──────────────────────────────────────────
        print("🎓 Creating students...")
        existing_students = session.execute(text("SELECT COUNT(*) FROM students")).scalar()

        if existing_students < 10:
            classes = session.execute(text("SELECT id FROM classes LIMIT 5")).scalars().all()
            student_user_id = session.execute(text(
                "SELECT id FROM users WHERE email = 'gaurav.joshi@iqra.local'"
            )).scalar()
            parent_user_id = session.execute(text(
                "SELECT id FROM users WHERE email = 'rajesh.patel@iqra.local'"
            )).scalar()

            if classes:
                counter = 0
                for class_id in classes:
                    for i in range(5):
                        counter += 1
                        student_id_str = f"STU-{class_id:03d}-{i + 1:03d}"
                        gr_number = f"GR-{class_id:03d}-{i + 1:03d}"

                        # Pick Gujarati names cyclically
                        gu_first = gujarati_first_names[counter % len(gujarati_first_names)]
                        gu_last  = gujarati_last_names[counter % len(gujarati_last_names)]

                        session.execute(text("""
                            INSERT INTO students (
                                student_id, gr_number,
                                name_en, name_gu, dob, gender,
                                class_id, roll_number,
                                father_name, mother_name, contact, address,
                                category, aadhar_last4,
                                admission_date, academic_year_id,
                                student_user_id, parent_user_id,
                                status, photo_path
                            ) VALUES (
                                :student_id, :gr_number,
                                :name_en, :name_gu, :dob,
                                CAST(:gender AS genderenum),
                                :class_id, :roll_number,
                                :father_name, :mother_name, :contact, :address,
                                :category, :aadhar_last4,
                                :admission_date, :ay_id,
                                :student_user_id, :parent_user_id,
                                CAST(:status AS studentstatusenum), NULL
                            )
                        """), {
                            "student_id":      student_id_str,
                            "gr_number":       gr_number,
                            "name_en":         f"Student {fake.last_name()}",
                            "name_gu":         f"{gu_first} {gu_last}",
                            "dob":             "2012-06-15",
                            "gender":          "M" if i % 2 == 0 else "F",
                            "class_id":        class_id,
                            "roll_number":     i + 1,
                            "father_name":     fake.name_male(),
                            "mother_name":     fake.name_female(),
                            "contact":         f"9{fake.numerify('#########')}",
                            "address":         fake.address().replace("\n", ", "),
                            "category":        "GEN",
                            "aadhar_last4":    fake.numerify("####"),
                            "admission_date":  "2024-06-01",
                            "ay_id":           current_year_id,
                            "student_user_id": student_user_id,  # demo: same user reused
                            "parent_user_id":  parent_user_id,
                            "status":          "Active",
                        })
                session.commit()
                print(f"✓ Students created: {counter}")
            else:
                print("⚠️  No classes found — skipping students")
        else:
            print(f"✓ Students already exist: {existing_students}")

        # ── 5. Subjects ───────────────────────────────────────────────────
        print("📖 Creating subjects...")
        existing_subjects = session.execute(text("SELECT COUNT(*) FROM subjects")).scalar()

        if existing_subjects == 0:
            subject_names = [
                "English", "Gujarati", "Maths", "Science",
                "Social Studies", "Physical Education",
            ]
            # Create one set of subjects per class
            class_ids = session.execute(text("SELECT id FROM classes")).scalars().all()
            for cid in class_ids:
                for s in subject_names:
                    session.execute(text("""
                        INSERT INTO subjects (
                            name, class_id, max_theory, max_practical,
                            subject_type, is_active, code,
                            is_exam_eligible, passing_marks
                        ) VALUES (
                            :name, :class_id, 80, 20,
                            'core', TRUE, :code,
                            TRUE, 33
                        )
                    """), {
                        "name":     s,
                        "class_id": cid,
                        "code":     s[:3].upper(),
                    })
            session.commit()
            print(f"✓ Subjects created for {len(class_ids)} classes")
        else:
            print(f"✓ Subjects already exist: {existing_subjects}")
        
        # 5. Enrollments
        print("📘 Creating enrollments...")

        existing_enrollments = session.execute(
            text("SELECT COUNT(*) FROM enrollments")
        ).scalar()

        if existing_enrollments == 0:
            active_year_id = session.execute(
                text("SELECT id FROM academic_years WHERE status='active' LIMIT 1")
            ).scalar()

            students = session.execute(text("""
                    SELECT id AS student_id, class_id FROM students
                """)).fetchall()

            for student in students:

                session.execute(text("""

                    INSERT INTO enrollments (student_id, class_id, academic_year_id, status)

                    VALUES (:student_id, :class_id, :year_id, 'active')

                """), {

                    "student_id": student.student_id,   # ✅ FIXED

                    "class_id": student.class_id,

                    "year_id": active_year_id

                })
                session.commit()
                print(f"✓ Enrollments created: {len(students)}")
            else:
                print(f"✓ Enrollments already exist: {existing_enrollments}")




        # ── 6. Exams ──────────────────────────────────────────────────────
        print("📝 Creating exams...")
        existing_exams = session.execute(text("SELECT COUNT(*) FROM exams")).scalar()

        if existing_exams == 0:
            exam_specs = [
                ("Unit Test 1",  "2024-08-15", 10.0),
                ("Unit Test 2",  "2024-10-15", 10.0),
                ("Half Yearly",  "2024-12-10", 30.0),
                ("Annual",       "2025-03-20", 40.0),
                ("Practical",    "2025-03-25", 10.0),
            ]
            class_ids = session.execute(text("SELECT id FROM classes")).scalars().all()
            for cid in class_ids:
                for name, edate, weight in exam_specs:
                    session.execute(text("""
                        INSERT INTO exams (name, class_id, exam_date,
                                           academic_year_id, weightage)
                        VALUES (:name, :class_id, :exam_date, :ay_id, :weightage)
                    """), {
                        "name":      name,
                        "class_id":  cid,
                        "exam_date": edate,
                        "ay_id":     current_year_id,
                        "weightage": weight,
                    })
            session.commit()
            print(f"✓ Exams created: {len(exam_specs)} per {len(class_ids)} classes")
        else:
            print(f"✓ Exams already exist: {existing_exams}")

                # ── 7. Marks ──────────────────────────────────────────────────────
        print("📊 Creating marks...")

        existing_marks = session.execute(
            text("SELECT COUNT(*) FROM marks")
        ).scalar()

        if existing_marks == 0:
            # Only take students enrolled in current year
            students = session.execute(text("""
                SELECT e.student_id, e.class_id
                FROM enrollments e
                WHERE e.academic_year_id = :ay_id
            """), {"ay_id": current_year_id}).fetchall()

            total_marks = 0

            for student in students:
                # Get exams for that student's class
                exams = session.execute(text("""
                    SELECT id FROM exams
                    WHERE class_id = :class_id AND academic_year_id = :ay_id
                """), {
                    "class_id": student.class_id,
                    "ay_id": current_year_id
                }).scalars().all()

                # Get subjects for that class
                subjects = session.execute(text("""
                    SELECT id FROM subjects
                    WHERE class_id = :class_id
                """), {"class_id": student.class_id}).scalars().all()

                for exam_id in exams:
                    for subject_id in subjects:
                        theory = fake.random_int(40, 80)
                        practical = fake.random_int(10, 20)

                        session.execute(text("""
                            INSERT INTO marks (
                                student_id, exam_id, subject_id,
                                theory_marks, practical_marks
                            )
                            VALUES (
                                :student_id, :exam_id, :subject_id,
                                :theory, :practical
                            )
                        """), {
                            "student_id": student.student_id,
                            "exam_id": exam_id,
                            "subject_id": subject_id,
                            "theory": theory,
                            "practical": practical
                        })

                        total_marks += 1

            session.commit()
            print(f"✓ Marks created: {total_marks}")
        else:
            print(f"✓ Marks already exist: {existing_marks}")

        print("\n" + "=" * 70)
        print("  ✅ SEEDING COMPLETE")
        print("=" * 70 + "\n")

        session.close()
        engine.dispose()
        return 0

    except Exception as e:
        session.rollback()
        print(f"\n❌ Error during seeding: {e}")
        session.close()
        engine.dispose()
        return 1


if __name__ == "__main__":
    sys.exit(seed_data())