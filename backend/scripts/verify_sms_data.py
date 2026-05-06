#!/usr/bin/env python3
"""
verify_sms_data.py — SMS Data Integrity Verification

Validates seeded data for referential integrity, consistency, and completeness.
Schema-aligned: no first_name/last_name/user_id/subject_assignments references.
"""

import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sms_user:sms_pass@localhost:5432/school_sms",
)

engine = create_engine(DATABASE_URL, echo=False)
Session = sessionmaker(bind=engine)
session = Session()


# ── Helpers ───────────────────────────────────────────────────────────────
def print_header(title: str) -> None:
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}\n")


def count_records(table_name: str) -> int:
    return session.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar() or 0


# ── 1. Foreign-key integrity ──────────────────────────────────────────────
def check_foreign_keys() -> bool:
    print_header("FOREIGN KEY INTEGRITY CHECK")

    checks = [
        ("students.class_id → classes.id",
         "SELECT COUNT(*) FROM students s "
         "WHERE s.class_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = s.class_id)"),

        ("students.academic_year_id → academic_years.id",
         "SELECT COUNT(*) FROM students s "
         "WHERE NOT EXISTS (SELECT 1 FROM academic_years ay WHERE ay.id = s.academic_year_id)"),

        ("students.student_user_id → users.id",
         "SELECT COUNT(*) FROM students s "
         "WHERE s.student_user_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.student_user_id)"),

        ("students.parent_user_id → users.id",
         "SELECT COUNT(*) FROM students s "
         "WHERE s.parent_user_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.parent_user_id)"),

        ("enrollments.student_id → students.id",
         "SELECT COUNT(*) FROM enrollments e "
         "WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.id = e.student_id)"),

        ("enrollments.academic_year_id → academic_years.id",
         "SELECT COUNT(*) FROM enrollments e "
         "WHERE NOT EXISTS (SELECT 1 FROM academic_years ay WHERE ay.id = e.academic_year_id)"),

        ("enrollments.class_id → classes.id",
         "SELECT COUNT(*) FROM enrollments e "
         "WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = e.class_id)"),

        ("marks.student_id → students.id",
         "SELECT COUNT(*) FROM marks m "
         "WHERE m.student_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = m.student_id)"),

        ("marks.exam_id → exams.id",
         "SELECT COUNT(*) FROM marks m "
         "WHERE m.exam_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM exams e WHERE e.id = m.exam_id)"),

        ("marks.subject_id → subjects.id",
         "SELECT COUNT(*) FROM marks m "
         "WHERE m.subject_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM subjects s WHERE s.id = m.subject_id)"),

        ("attendance.student_id → students.id",
         "SELECT COUNT(*) FROM attendance a "
         "WHERE a.student_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = a.student_id)"),

        ("attendance.class_id → classes.id",
         "SELECT COUNT(*) FROM attendance a "
         "WHERE a.class_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = a.class_id)"),

        ("teacher_class_assignments.teacher_id → users.id",
         "SELECT COUNT(*) FROM teacher_class_assignments tca "
         "WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = tca.teacher_id)"),

        ("teacher_class_assignments.class_id → classes.id",
         "SELECT COUNT(*) FROM teacher_class_assignments tca "
         "WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = tca.class_id)"),

        ("student_fees.student_id → students.id",
         "SELECT COUNT(*) FROM student_fees sf "
         "WHERE sf.student_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = sf.student_id)"),

        ("student_fees.fee_structure_id → fee_structures.id",
         "SELECT COUNT(*) FROM student_fees sf "
         "WHERE sf.fee_structure_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM fee_structures fs WHERE fs.id = sf.fee_structure_id)"),

        ("fee_payments.student_fee_id → student_fees.id",
         "SELECT COUNT(*) FROM fee_payments fp "
         "WHERE fp.student_fee_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM student_fees sf WHERE sf.id = fp.student_fee_id)"),
    ]

    all_valid = True
    for relation, query in checks:
        try:
            orphans = session.execute(text(query)).scalar() or 0
            status = "✓ OK" if orphans == 0 else f"❌ {orphans} orphans"
            print(f"  {relation:<55} {status}")
            if orphans:
                all_valid = False
        except Exception as e:
            print(f"  {relation:<55} ⚠️  Error: {str(e)[:40]}")
            all_valid = False

    return all_valid


# ── 2. Logical consistency ────────────────────────────────────────────────
def check_data_consistency():
    print_header("DATA CONSISTENCY CHECK")
    issues = []

    # 2a. Active-year enrollments must reference active students
    try:
        active_ay = session.execute(
            text("SELECT id FROM academic_years WHERE status = 'active' LIMIT 1")
        ).scalar()

        if active_ay:
            orphan = session.execute(text("""
                SELECT COUNT(*) FROM enrollments e
                WHERE e.academic_year_id = :ay
                  AND NOT EXISTS (
                      SELECT 1 FROM students s
                      WHERE s.id = e.student_id AND s.status = 'Active'
                  )
            """), {"ay": active_ay}).scalar() or 0

            if orphan:
                issues.append(f"  ❌ {orphan} enrollments for non-Active students in active year")
            else:
                print("  ✓ All active-year enrollments link to Active students")
        else:
            print("  ⚠️  No active academic year found")
    except Exception as e:
        print(f"  ⚠️  Could not verify active enrollments: {e}")

    # 2b. Marks belong to students enrolled in the exam's academic year
    try:
        bad_marks = session.execute(text("""
            SELECT COUNT(*) FROM marks m
            JOIN exams ex ON ex.id = m.exam_id
            WHERE NOT EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.student_id = m.student_id
                  AND e.academic_year_id = ex.academic_year_id
            )
        """)).scalar() or 0

        if bad_marks:
            issues.append(f"  ❌ {bad_marks} marks for students not enrolled in the exam's year")
        else:
            print("  ✓ All marks correspond to enrolled students for the exam year")
    except Exception as e:
        print(f"  ⚠️  Could not verify marks/enrollments: {e}")

    # 2c. Teacher assignments → only users with role='teacher'
    try:
        bad_teachers = session.execute(text("""
            SELECT COUNT(*) FROM teacher_class_assignments tca
            JOIN users u ON u.id = tca.teacher_id
            WHERE u.role <> 'teacher'
        """)).scalar() or 0

        if bad_teachers:
            issues.append(f"  ❌ {bad_teachers} class assignments to non-teacher users")
        else:
            print("  ✓ All class assignments map to users with role='teacher'")
    except Exception as e:
        print(f"  ⚠️  Could not verify teacher roles: {e}")

    # 2d. student_fees.net_amount must be ≥ 0 and concession ≤ structure amount
    try:
        bad_fees = session.execute(text("""
            SELECT COUNT(*) FROM student_fees sf
            LEFT JOIN fee_structures fs ON fs.id = sf.fee_structure_id
            WHERE sf.net_amount < 0
               OR (fs.amount IS NOT NULL AND COALESCE(sf.concession, 0) > fs.amount)
        """)).scalar() or 0

        if bad_fees:
            issues.append(f"  ❌ {bad_fees} student_fees rows with invalid net_amount/concession")
        else:
            print("  ✓ All student_fees rows have valid amounts")
    except Exception as e:
        print(f"  ⚠️  Could not verify fee amounts: {e}")

    return len(issues) == 0, issues


# ── 3. Record counts ──────────────────────────────────────────────────────
def check_record_counts():
    print_header("RECORD COUNTS")

    tables = [
        "academic_years", "classes", "users", "students", "subjects",
        "exams", "exam_subject_configs", "marks", "attendance", "enrollments",
        "fee_heads", "fee_structures", "student_fees", "fee_payments",
        "teacher_class_assignments", "report_cards",
        "academic_calendar", "audit_logs", "token_blocklist",
    ]

    total = 0
    for table in tables:
        try:
            count = count_records(table)
            print(f"  {table:<35} {count:>8} records")
            total += count
        except Exception as e:
            print(f"  {table:<35} Error: {str(e)[:40]}")

    print(f"\n  {'TOTAL':<35} {total:>8} records")


# ── 4. Test credentials ───────────────────────────────────────────────────
def check_test_credentials() -> bool:
    print_header("TEST CREDENTIALS VERIFICATION")

    test_users = [
        ("admin@iqra.local",        "admin"),
        ("teacher1@iqra.local",     "teacher"),
        ("gaurav.joshi@iqra.local", "student"),
        ("rajesh.patel@iqra.local", "parent"),
    ]

    all_present = True
    for email, expected_role in test_users:
        row = session.execute(
            text("SELECT id, role, is_active FROM users WHERE email = :email"),
            {"email": email},
        ).first()

        if row:
            id_, role, active = row
            badge = "✓" if role == expected_role else "⚠️"
            print(f"  {badge} {email:<32} role={role:<8} active={active}")
            if role != expected_role:
                all_present = False
        else:
            print(f"  ❌ {email:<32} NOT FOUND")
            all_present = False

    return all_present


# ── 5. Summary ────────────────────────────────────────────────────────────
def generate_summary() -> int:
    fk_valid = check_foreign_keys()
    consistency_valid, consistency_issues = check_data_consistency()
    check_record_counts()
    creds_valid = check_test_credentials()

    print_header("VERIFICATION SUMMARY")

    if fk_valid and consistency_valid and creds_valid:
        print("  ✅ ALL CHECKS PASSED — Data is ready for testing!")
        return 0

    print("  ⚠️  SOME ISSUES DETECTED:")
    if not fk_valid:           print("     • Foreign-key orphans")
    if not consistency_valid:  print("     • Logical inconsistencies")
    if not creds_valid:        print("     • Missing/mis-roled test users")
    for issue in consistency_issues:
        print(issue)
    return 1


if __name__ == "__main__":
    try:
        print("\n🔍 SMS Data Verification Tool")
        host = DATABASE_URL.split("@")[1] if "@" in DATABASE_URL else "unknown"
        print(f"   Database: {host}")
        print(f"   Time:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        code = generate_summary()
        session.close()
        sys.exit(code)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        session.close()
        sys.exit(1)