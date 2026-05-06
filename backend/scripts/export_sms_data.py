#!/usr/bin/env python3
"""
export_sms_data.py — SMS Data Export & Reporting

Generates CSV/JSON exports for testing, analytics, and UI verification.
Schema-aligned: uses name_en/name_gu, dob, contact, father_name (text),
attendance status codes 'P'/'A'/'L', fee_payments.amount_paid, etc.
"""

import os
import json
import csv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sms_user:sms_pass@localhost:5432/school_sms",
)

engine = create_engine(DATABASE_URL, echo=False)
Session = sessionmaker(bind=engine)
session = Session()

# Allow override; default to CWD/exports for cross-platform safety.
EXPORT_DIR = os.getenv("EXPORT_DIR", os.path.join(os.getcwd(), "exports"))
os.makedirs(EXPORT_DIR, exist_ok=True)


def _write_csv(filename: str, header: list, rows) -> str:
    path = os.path.join(EXPORT_DIR, filename)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow(r)
    return path


# ── 1. Attendance report ──────────────────────────────────────────────────
def export_attendance_report():
    print("📋 Exporting attendance report...")
    query = text("""
        SELECT
            c.name              AS class,
            c.division          AS division,
            COUNT(DISTINCT a.student_id)                                       AS total_students,
            SUM(CASE WHEN a.status = 'P' THEN 1 ELSE 0 END)                    AS present_days,
            SUM(CASE WHEN a.status = 'A' THEN 1 ELSE 0 END)                    AS absent_days,
            SUM(CASE WHEN a.status = 'L' THEN 1 ELSE 0 END)                    AS late_days,
            ROUND(
                100.0 * SUM(CASE WHEN a.status = 'P' THEN 1 ELSE 0 END)
                      / NULLIF(COUNT(*), 0), 2
            ) AS attendance_percentage
        FROM attendance a
        JOIN classes  c ON c.id = a.class_id
        GROUP BY c.id, c.name, c.division
        ORDER BY c.name, c.division
    """)
    rows = session.execute(query).fetchall()
    path = _write_csv(
        "attendance_report.csv",
        ["Class", "Division", "Total Students", "Present", "Absent", "Late", "Attendance %"],
        rows,
    )
    print(f"   ✓ Saved to {path}  ({len(rows)} rows)")


# ── 2. Marks summary ──────────────────────────────────────────────────────
def export_marks_summary():
    print("📊 Exporting marks summary...")
    query = text("""
        SELECT
            s.gr_number,
            s.name_en                                                  AS student_name,
            s.name_gu                                                  AS student_name_gu,
            c.name || ' ' || COALESCE(c.division, '')                  AS class,
            ex.name                                                    AS exam,
            subj.name                                                  AS subject,
            m.theory_marks                                             AS theory,
            m.practical_marks                                          AS practical,
            ROUND(COALESCE(m.theory_marks, 0)
                + COALESCE(m.practical_marks, 0), 2)                   AS total_obtained,
            (COALESCE(subj.max_theory, 0)
                + COALESCE(subj.max_practical, 0))                     AS total_max,
            CASE
              WHEN (COALESCE(subj.max_theory, 0) + COALESCE(subj.max_practical, 0)) = 0 THEN NULL
              ELSE ROUND(
                100.0 * (COALESCE(m.theory_marks, 0) + COALESCE(m.practical_marks, 0))
                      / (COALESCE(subj.max_theory, 0) + COALESCE(subj.max_practical, 0)), 2
              )
            END                                                        AS percentage,
            m.is_absent
        FROM marks m
        JOIN students s   ON s.id    = m.student_id
        JOIN classes  c   ON c.id    = s.class_id
        JOIN exams    ex  ON ex.id   = m.exam_id
        JOIN subjects subj ON subj.id = m.subject_id
        ORDER BY c.name, s.gr_number, ex.name, subj.name
        LIMIT 5000
    """)
    rows = session.execute(query).fetchall()
    path = _write_csv(
        "marks_summary.csv",
        ["GR No", "Student (EN)", "Student (GU)", "Class", "Exam", "Subject",
         "Theory", "Practical", "Total Obtained", "Total Max", "Percentage", "Absent"],
        rows,
    )
    print(f"   ✓ Saved to {path}  ({len(rows)} rows)")


# ── 3. Fee summary ────────────────────────────────────────────────────────
def export_fee_summary():
    print("💰 Exporting fee summary...")
    query = text("""
        SELECT
            s.gr_number,
            s.name_en                                                  AS student_name,
            c.name || ' ' || COALESCE(c.division, '')                  AS class,
            fh.name                                                    AS fee_head,
            sf.net_amount                                              AS fee_amount,
            COALESCE(SUM(fp.amount_paid), 0)                           AS paid_amount,
            sf.net_amount - COALESCE(SUM(fp.amount_paid), 0)           AS remaining_due,
            sf.invoice_type
        FROM student_fees sf
        JOIN students        s  ON s.id  = sf.student_id
        JOIN classes         c  ON c.id  = s.class_id
        JOIN fee_structures  fs ON fs.id = sf.fee_structure_id
        JOIN fee_heads       fh ON fh.id = fs.fee_head_id
        LEFT JOIN fee_payments fp ON fp.student_fee_id = sf.id
        GROUP BY s.id, s.gr_number, s.name_en, c.id, c.name, c.division,
                 fh.id, fh.name, sf.net_amount, sf.invoice_type
        ORDER BY c.name, s.gr_number, fh.name
        LIMIT 5000
    """)
    rows = session.execute(query).fetchall()
    path = _write_csv(
        "fee_summary.csv",
        ["GR No", "Student", "Class", "Fee Head", "Fee Amount",
         "Paid", "Remaining Due", "Invoice Type"],
        rows,
    )
    print(f"   ✓ Saved to {path}  ({len(rows)} rows)")


# ── 4. Student roster ─────────────────────────────────────────────────────
def export_student_roster():
    print("👥 Exporting student roster...")
    query = text("""
        SELECT
            s.student_id,
            s.gr_number,
            s.name_en,
            s.name_gu,
            c.name || ' ' || COALESCE(c.division, '')   AS class,
            s.dob,
            s.gender,
            s.contact,
            s.address,
            s.father_name,
            s.mother_name,
            s.category,
            s.aadhar_last4,
            s.admission_date,
            ay.label                                    AS academic_year,
            su.email                                    AS student_login_email,
            pu.email                                    AS parent_login_email,
            s.status
        FROM students        s
        JOIN classes         c  ON c.id  = s.class_id
        JOIN academic_years  ay ON ay.id = s.academic_year_id
        LEFT JOIN users      su ON su.id = s.student_user_id
        LEFT JOIN users      pu ON pu.id = s.parent_user_id
        ORDER BY c.name, c.division, s.roll_number, s.gr_number
    """)
    rows = session.execute(query).fetchall()
    path = _write_csv(
        "student_roster.csv",
        ["Student ID", "GR No", "Name (EN)", "Name (GU)", "Class",
         "DOB", "Gender", "Contact", "Address",
         "Father", "Mother", "Category", "Aadhar (last4)",
         "Admission Date", "Academic Year",
         "Student Email", "Parent Email", "Status"],
        rows,
    )
    print(f"   ✓ Saved to {path}  ({len(rows)} rows)")


# ── 5. Class strength ─────────────────────────────────────────────────────
def export_class_strength():
    print("📚 Exporting class strength...")
    query = text("""
        SELECT
            c.name                                                AS class,
            c.division,
            ay.label                                              AS academic_year,
            COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'Active') AS active_students,
            COUNT(DISTINCT tca.teacher_id)                        AS assigned_teachers,
            COUNT(DISTINCT subj.id)                               AS subject_count,
            STRING_AGG(DISTINCT subj.name, ', ' ORDER BY subj.name) AS subjects
        FROM classes c
        LEFT JOIN academic_years            ay   ON ay.id = c.academic_year_id
        LEFT JOIN students                  s    ON s.class_id = c.id
        LEFT JOIN teacher_class_assignments tca  ON tca.class_id = c.id
        LEFT JOIN subjects                  subj ON subj.class_id = c.id AND subj.is_active = TRUE
        GROUP BY c.id, c.name, c.division, ay.label
        ORDER BY c.name, c.division
    """)
    rows = session.execute(query).fetchall()
    path = _write_csv(
        "class_strength.csv",
        ["Class", "Division", "Academic Year",
         "Active Students", "Teachers", "Subject Count", "Subjects"],
        rows,
    )
    print(f"   ✓ Saved to {path}  ({len(rows)} rows)")


# ── 6. Dashboard JSON ─────────────────────────────────────────────────────
def export_dashboard_json():
    print("📈 Exporting dashboard metrics...")

    counts = {
        "students":     session.execute(text("SELECT COUNT(*) FROM students")).scalar() or 0,
        "teachers":     session.execute(text("SELECT COUNT(*) FROM users WHERE role='teacher'")).scalar() or 0,
        "admins":       session.execute(text("SELECT COUNT(*) FROM users WHERE role='admin'")).scalar() or 0,
        "parents":      session.execute(text("SELECT COUNT(*) FROM users WHERE role='parent'")).scalar() or 0,
        "classes":      session.execute(text("SELECT COUNT(*) FROM classes")).scalar() or 0,
        "subjects":     session.execute(text("SELECT COUNT(*) FROM subjects")).scalar() or 0,
        "exams":        session.execute(text("SELECT COUNT(*) FROM exams")).scalar() or 0,
        "marks":        session.execute(text("SELECT COUNT(*) FROM marks")).scalar() or 0,
        "attendance":   session.execute(text("SELECT COUNT(*) FROM attendance")).scalar() or 0,
        "enrollments":  session.execute(text("SELECT COUNT(*) FROM enrollments")).scalar() or 0,
    }

    avg_attendance = session.execute(text("""
        SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'P')
                  / NULLIF(COUNT(*), 0), 2
        ) FROM attendance
    """)).scalar()

    total_due  = session.execute(text(
        "SELECT COALESCE(SUM(net_amount), 0) FROM student_fees"
    )).scalar() or 0
    total_paid = session.execute(text(
        "SELECT COALESCE(SUM(amount_paid), 0) FROM fee_payments"
    )).scalar() or 0

    dashboard = {
        "record_counts": counts,
        "average_attendance_percentage": float(avg_attendance) if avg_attendance is not None else None,
        "fee_summary": {
            "total_due":             float(total_due),
            "total_paid":            float(total_paid),
            "collection_percentage": round(100.0 * float(total_paid) / float(total_due), 2)
                                     if float(total_due) > 0 else 0.0,
        },
        "academic_year": session.execute(text("""
            SELECT label FROM academic_years WHERE is_current = TRUE LIMIT 1
        """)).scalar(),
    }

    path = os.path.join(EXPORT_DIR, "dashboard_metrics.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, indent=2, default=str, ensure_ascii=False)
    print(f"   ✓ Saved to {path}")


# ── Main ──────────────────────────────────────────────────────────────────
def main():
    print("\n" + "=" * 70)
    print("  SMS DATA EXPORT & REPORTING TOOL")
    print("=" * 70)
    print(f"  📁 Output dir: {EXPORT_DIR}\n")

    try:
        export_attendance_report()
        export_marks_summary()
        export_fee_summary()
        export_student_roster()
        export_class_strength()
        export_dashboard_json()

        print("\n" + "=" * 70)
        print("  ✅ All exports complete!")
        print(f"  📁 Files saved to: {EXPORT_DIR}")
        print("=" * 70 + "\n")

    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    main()