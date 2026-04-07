"""
checklist_runner.py — Visual Checklist Report Generator
Run after pytest to get a human-readable HTML checklist with pass/fail status.

Usage:
    python checklist_runner.py                    # reads reports/report.json
    python checklist_runner.py --open             # opens in browser after generating
"""

import json
import sys
import os
import argparse
from datetime import datetime
from pathlib import Path


CHECKLIST = {
    "🎓 Student Management": {
        "Basic CRUD": [
            ("Add student with all fields filled — saves correctly",          "test_students.py::TestStudentCRUD::test_add_student_all_fields"),
            ("Add student with only required fields — saves correctly",        "test_students.py::TestStudentCRUD::test_add_student_only_required_fields"),
            ("Add student with Gujarati name (ગુજરાતી)",                     "test_students.py::TestStudentCRUD::test_add_student_gujarati_name"),
            ("Add two students same name — both save",                        "test_students.py::TestStudentCRUD::test_add_two_students_same_name"),
            ("Add 10+ students to same class — all appear",                   "test_students.py::TestStudentCRUD::test_add_10_plus_students_same_class"),
            ("Edit student — change class — saves correctly",                 "test_students.py::TestStudentCRUD::test_edit_student_change_class"),
            ("Edit student — contact validation still works",                  "test_students.py::TestStudentCRUD::test_edit_student_contact_validation_still_works"),
            ("Remove student — disappears from list",                         "test_students.py::TestStudentCRUD::test_remove_student"),
            ("Removed student NOT in fee defaulters",                         "test_students.py::TestStudentCRUD::test_removed_student_not_in_defaulters"),
            ("Removed student NOT in attendance roster",                      "test_students.py::TestStudentCRUD::test_removed_student_not_in_attendance_roster"),
            ("Removed student NOT in marks grid",                             "test_students.py::TestStudentCRUD::test_removed_student_not_in_marks_grid"),
            ("TC still works for removed student",                            "test_students.py::TestStudentCRUD::test_tc_still_works_for_removed_student"),
        ],
        "Validation": [
            ("Contact starting with 0 — rejected",                           "test_students.py::TestStudentValidation::test_invalid_contact_number[0123456789-starts with 0]"),
            ("Contact 9 digits — rejected",                                   "test_students.py::TestStudentValidation::test_invalid_contact_number[123456789-9 digits]"),
            ("Contact 11 digits — rejected",                                  "test_students.py::TestStudentValidation::test_invalid_contact_number[12345678901-11 digits]"),
            ("Roll number 0 — rejected",                                      "test_students.py::TestStudentValidation::test_invalid_roll_number[0-zero]"),
            ("Roll number -1 — rejected",                                     "test_students.py::TestStudentValidation::test_invalid_roll_number[-1-negative]"),
            ("Future date of birth — rejected",                               "test_students.py::TestStudentValidation::test_future_date_of_birth"),
            ("Today's DOB — accepted (edge case)",                            "test_students.py::TestStudentValidation::test_today_date_of_birth"),
            ("Same class + same roll — prevented or warned",                  "test_students.py::TestStudentValidation::test_same_class_same_roll_number_prevented"),
            ("Name 50+ chars — no layout break",                              "test_students.py::TestStudentValidation::test_student_very_long_name"),
            ("No GR number — works fine",                                     "test_students.py::TestStudentValidation::test_no_gr_number"),
            ("No roll number — appears with '—'",                            "test_students.py::TestStudentValidation::test_no_roll_number"),
        ],
        "Search & Filter": [
            ("Search by partial name ('rah' finds 'Rahul')",                 "test_students.py::TestStudentSearchFilter::test_search_by_partial_name"),
            ("Search by contact number",                                      "test_students.py::TestStudentSearchFilter::test_search_by_contact_number"),
            ("Search by GR number",                                           "test_students.py::TestStudentSearchFilter::test_search_by_gr_number"),
            ("Search with ALL CAPS",                                          "test_students.py::TestStudentSearchFilter::test_search_case_insensitive"),
            ("Filter by class — only that class shown",                       "test_students.py::TestStudentSearchFilter::test_filter_by_class"),
            ("Filter class + search — both apply",                            "test_students.py::TestStudentSearchFilter::test_filter_class_plus_search"),
        ],
    },
    "💰 Fee Structure": {
        "Setup": [
            ("Load GSEB fee heads — appear",                                  "test_fees.py::TestFeeStructure::test_load_gseb_fee_heads"),
            ("Load GSEB heads twice — no duplicates",                         "test_fees.py::TestFeeStructure::test_load_gseb_heads_twice_no_duplicates"),
            ("Fee amount = 0 — rejected",                                     "test_fees.py::TestFeeStructure::test_add_fee_amount_zero_rejected"),
            ("Fee negative amount — rejected",                                 "test_fees.py::TestFeeStructure::test_add_fee_negative_amount_rejected"),
            ("Fee ₹999999 — saves correctly",                                 "test_fees.py::TestFeeStructure::test_add_fee_large_amount"),
            ("Remove fee — disappears from table",                            "test_fees.py::TestFeeStructure::test_remove_fee_from_structure"),
            ("Assign fees twice — no duplicate student_fees",                 "test_fees.py::TestFeeStructure::test_assign_fees_to_class_no_duplicates"),
            ("Assign fees to class with 0 students — handles gracefully",     "test_fees.py::TestFeeStructure::test_assign_fees_class_zero_students"),
        ],
        "Payments": [
            ("Payment = exact balance — balance becomes 0",                   "test_fees.py::TestPayments::test_payment_exact_balance_zeroes_out"),
            ("Payment = 0 — rejected",                                        "test_fees.py::TestPayments::test_payment_zero_rejected"),
            ("Payment negative — rejected",                                   "test_fees.py::TestPayments::test_payment_negative_rejected"),
            ("Two payments same fee head — both in history",                  "test_fees.py::TestPayments::test_two_payments_same_fee_head"),
            ("Cash payment — receipt generated",                              "test_fees.py::TestPayments::test_receipt_generated_per_mode[Cash]"),
            ("UPI payment — receipt generated",                               "test_fees.py::TestPayments::test_receipt_generated_per_mode[UPI]"),
            ("Receipt numbers sequential and unique",                         "test_fees.py::TestPayments::test_receipt_numbers_sequential_unique"),
            ("Overpayment — documented behavior",                             "test_fees.py::TestPayments::test_overpayment_behavior"),
        ],
        "Defaulters": [
            ("Fully paid — NOT in defaulters",                               "test_fees.py::TestDefaulters::test_fully_paid_student_not_in_defaulters"),
            ("Partial payment — in defaulters with correct balance",          "test_fees.py::TestDefaulters::test_partial_payment_appears_in_defaulters"),
            ("0 fees assigned — NOT in defaulters",                          "test_fees.py::TestDefaulters::test_zero_fees_student_not_in_defaulters"),
            ("Filter defaulters by class",                                    "test_fees.py::TestDefaulters::test_filter_defaulters_by_class"),
            ("₹0.01 balance — still in defaulters",                          "test_fees.py::TestDefaulters::test_tiny_balance_still_in_defaulters"),
        ],
    },
    "📝 Marks Entry": {
        "Grid": [
            ("Load GSEB subjects Std 1 — 5 subjects",                        "test_marks.py::TestMarksGrid::test_load_gseb_subjects_std1"),
            ("Load GSEB subjects Std 10 — 7 subjects + practical",           "test_marks.py::TestMarksGrid::test_load_gseb_subjects_std10"),
            ("Load subjects twice — no duplicates",                           "test_marks.py::TestMarksGrid::test_load_subjects_twice_no_duplicates"),
            ("Marks = 0 — saves (valid, not absent)",                         "test_marks.py::TestMarksGrid::test_marks_entry_zero"),
            ("Marks = 100 (max) — saves correctly",                           "test_marks.py::TestMarksGrid::test_marks_entry_max"),
            ("Marks > max (101) — rejected",                                  "test_marks.py::TestMarksGrid::test_marks_entry_exceeds_max_rejected"),
            ("Decimal marks (45.5) — saves",                                  "test_marks.py::TestMarksGrid::test_marks_entry_decimal"),
            ("Mark absent — is_absent=True saved",                            "test_marks.py::TestMarksGrid::test_mark_student_absent"),
            ("Marks persist after save",                                      "test_marks.py::TestMarksGrid::test_marks_persist_after_save"),
            ("Edit marks — updates, not duplicates",                          "test_marks.py::TestMarksGrid::test_marks_update_correctly"),
        ],
        "Grades": [
            ("95/100 → A1, GP 10.0",  "test_marks.py::TestGradeCalculation::test_grade_thresholds[95-100-A1-10.0]"),
            ("85/100 → A2, GP 9.0",   "test_marks.py::TestGradeCalculation::test_grade_thresholds[85-100-A2-9.0]"),
            ("75/100 → B1, GP 8.0",   "test_marks.py::TestGradeCalculation::test_grade_thresholds[75-100-B1-8.0]"),
            ("65/100 → B2, GP 7.0",   "test_marks.py::TestGradeCalculation::test_grade_thresholds[65-100-B2-7.0]"),
            ("55/100 → C1, GP 6.0",   "test_marks.py::TestGradeCalculation::test_grade_thresholds[55-100-C1-6.0]"),
            ("45/100 → C2, GP 5.0",   "test_marks.py::TestGradeCalculation::test_grade_thresholds[45-100-C2-5.0]"),
            ("35/100 → D, GP 4.0",    "test_marks.py::TestGradeCalculation::test_grade_thresholds[35-100-D-4.0]"),
            ("33/100 → D (passing threshold)", "test_marks.py::TestGradeCalculation::test_grade_thresholds[33-100-D-4.0]"),
            ("32/100 → E (just below)",        "test_marks.py::TestGradeCalculation::test_grade_thresholds[32-100-E-0.0]"),
            ("30/100 → E (fail)",              "test_marks.py::TestGradeCalculation::test_grade_thresholds[30-100-E-0.0]"),
            ("Absent in 1 subject → FAIL",     "test_marks.py::TestGradeCalculation::test_absent_subject_causes_fail"),
            ("Pass all subjects → PASS",       "test_marks.py::TestGradeCalculation::test_pass_all_subjects"),
            ("Fail 1 subject → FAIL",          "test_marks.py::TestGradeCalculation::test_fail_one_subject_fails_overall"),
            ("Top scorer = Rank 1",            "test_marks.py::TestGradeCalculation::test_class_rank_top_scorer_is_rank1"),
            ("Same % → same or consecutive rank", "test_marks.py::TestGradeCalculation::test_same_percentage_same_rank"),
        ],
        "Results & PDF": [
            ("Marksheet PDF generates",                                       "test_marks.py::TestResultsPDF::test_marksheet_pdf_generates"),
            ("Bulk class PDF generates",                                      "test_marks.py::TestResultsPDF::test_bulk_class_pdf_generates"),
            ("Results sorted by rank",                                        "test_marks.py::TestResultsPDF::test_results_sorted_by_rank"),
            ("Empty class — results page not crash",                          "test_marks.py::TestResultsPDF::test_results_page_empty_class"),
        ],
    },
    "📅 Attendance": {
        "Daily Marking": [
            ("Roster shows only ACTIVE students",                             "test_attendance.py::TestDailyAttendance::test_roster_shows_only_active_students"),
            ("Removed student NOT on roster",                                 "test_attendance.py::TestDailyAttendance::test_removed_student_not_on_roster"),
            ("Mark all Present",                                              "test_attendance.py::TestDailyAttendance::test_mark_all_present"),
            ("Mark all Absent",                                               "test_attendance.py::TestDailyAttendance::test_mark_all_absent"),
            ("Mix P/A/L/OL saves correctly",                                 "test_attendance.py::TestDailyAttendance::test_mixed_status_palt"),
            ("Save for past date (backdating)",                               "test_attendance.py::TestDailyAttendance::test_save_attendance_past_date"),
            ("Save for future date — documented",                             "test_attendance.py::TestDailyAttendance::test_save_attendance_future_date"),
            ("Revisit same date — pre-filled",                                "test_attendance.py::TestDailyAttendance::test_attendance_prefilled_on_revisit"),
            ("Update attendance — no duplicate",                              "test_attendance.py::TestDailyAttendance::test_update_attendance_no_duplicates"),
            ("Empty class — empty state, not error",                          "test_attendance.py::TestDailyAttendance::test_empty_class_shows_empty_state"),
        ],
        "Monthly Summary": [
            ("No attendance — shows 0",                                       "test_attendance.py::TestMonthlySummary::test_no_attendance_shows_zero"),
            ("100% attendance correct",                                       "test_attendance.py::TestMonthlySummary::test_100_percent_attendance"),
            ("75% exactly — NOT highlighted",                                 "test_attendance.py::TestMonthlySummary::test_75_percent_boundary_not_highlighted"),
            ("Below 75% — highlighted red",                                   "test_attendance.py::TestMonthlySummary::test_below_75_percent_highlighted"),
            ("Sundays excluded from working days",                            "test_attendance.py::TestMonthlySummary::test_sundays_excluded_from_working_days"),
            ("February calculated correctly",                                 "test_attendance.py::TestMonthlySummary::test_february_calculated_correctly"),
        ],
    },
    "📊 Reports": {
        "PDFs": [
            ("Fee defaulter report — with defaulters",                        "test_reports_tc_system.py::TestReportPDFs::test_fee_defaulter_report_with_defaulters"),
            ("Fee defaulter report — empty",                                  "test_reports_tc_system.py::TestReportPDFs::test_fee_defaulter_report_no_defaulters"),
            ("Fee defaulter report — school name in header",                  "test_reports_tc_system.py::TestReportPDFs::test_fee_defaulter_report_school_name"),
            ("Attendance report — with data",                                 "test_reports_tc_system.py::TestReportPDFs::test_attendance_report_with_data"),
            ("Attendance report — empty class (no crash)",                    "test_reports_tc_system.py::TestReportPDFs::test_attendance_report_empty_class"),
            ("Class result report PDF (landscape)",                           "test_reports_tc_system.py::TestReportPDFs::test_class_result_report_pdf"),
            ("Class result — no marks (no crash)",                            "test_reports_tc_system.py::TestReportPDFs::test_class_result_report_no_marks"),
        ],
    },
    "📄 Transfer Certificate": {
        "TC": [
            ("TC for active student — correct details",                       "test_reports_tc_system.py::TestTransferCertificate::test_tc_active_student"),
            ("TC for already-issued student — still works",                   "test_reports_tc_system.py::TestTransferCertificate::test_tc_already_issued_student"),
            ("TC shows correct class and year",                               "test_reports_tc_system.py::TestTransferCertificate::test_tc_shows_correct_class_and_year"),
            ("TC number unique per student",                                  "test_reports_tc_system.py::TestTransferCertificate::test_tc_number_unique"),
            ("TC issue date = today",                                         "test_reports_tc_system.py::TestTransferCertificate::test_tc_issue_date_is_today"),
            ("TC no GR number → shows '—', not crash",                       "test_reports_tc_system.py::TestTransferCertificate::test_tc_no_gr_number_shows_dash"),
            ("TC for removed student — still works",                          "test_reports_tc_system.py::TestTransferCertificate::test_tc_removed_student_still_works"),
        ],
    },
    "📚 Year-End": {
        "Management": [
            ("Create new academic year — becomes current",                    "test_reports_tc_system.py::TestYearEnd::test_create_new_academic_year"),
            ("Only one current year at a time",                               "test_reports_tc_system.py::TestYearEnd::test_old_year_not_current_after_new_one"),
            ("Classes auto-created for new year",                             "test_reports_tc_system.py::TestYearEnd::test_classes_auto_created_for_new_year"),
            ("Add class+division — appears in list",                          "test_reports_tc_system.py::TestYearEnd::test_add_class_division"),
            ("Duplicate class+division prevented",                            "test_reports_tc_system.py::TestYearEnd::test_add_duplicate_class_division_prevented"),
            ("Promote Std 1 → Std 2",                                        "test_reports_tc_system.py::TestYearEnd::test_promote_class1_to_class2"),
            ("Promote Std 10 → error",                                        "test_reports_tc_system.py::TestYearEnd::test_promote_class10_shows_error"),
            ("Promote empty class → 0 promoted, not crash",                  "test_reports_tc_system.py::TestYearEnd::test_promote_empty_class_shows_zero"),
        ],
    },
    "🔧 System": {
        "Integration": [
            ("Full lifecycle: add→fee→attendance→marks linked",              "test_reports_tc_system.py::TestSystemIntegration::test_full_student_lifecycle"),
            ("/docs endpoint available",                                      "test_reports_tc_system.py::TestSystemIntegration::test_api_docs_endpoint"),
            ("OpenAPI schema has all endpoints",                              "test_reports_tc_system.py::TestSystemIntegration::test_openapi_schema"),
            ("No 500 errors on common endpoints",                             "test_reports_tc_system.py::TestSystemIntegration::test_no_500_errors_on_common_endpoints"),
        ],
        "UI Navigation": [
            ("Dashboard loads",                                               "test_reports_tc_system.py::TestSystemUI::test_dashboard_loads"),
            ("Browser back button works",                                     "test_reports_tc_system.py::TestSystemUI::test_browser_back_button"),
            ("Direct URL access works",                                       "test_reports_tc_system.py::TestSystemUI::test_direct_url_access"),
            ("Page refresh stays on same route",                              "test_reports_tc_system.py::TestSystemUI::test_page_refresh_stays_on_same_page"),
            ("Dashboard student count updates",                               "test_reports_tc_system.py::TestSystemUI::test_dashboard_student_count_updates"),
        ],
    },
}


def load_results(report_path="reports/report.json"):
    """Load pytest JSON report and build a lookup of test_id → status."""
    if not Path(report_path).exists():
        return {}, None
    with open(report_path) as f:
        data = json.load(f)
    lookup = {}
    for t in data.get("tests", []):
        node = t["nodeid"]
        # Normalize: strip path prefix
        key = node.split("::", 1)[-1] if "::" in node else node
        full_key = node.replace("tests/", "")
        lookup[full_key] = t["outcome"]
        lookup[key] = t["outcome"]
    summary = data.get("summary", {})
    return lookup, summary


def status_icon(outcome):
    return {"passed": "✅", "failed": "❌", "error": "💥", "skipped": "⏭️"}.get(outcome, "⬜")


def status_class(outcome):
    return {"passed": "pass", "failed": "fail", "error": "error", "skipped": "skip"}.get(outcome, "pending")


def generate_html(results, summary):
    now = datetime.now().strftime("%d %b %Y %H:%M:%S")
    total = sum(summary.values()) if summary else 0
    passed = summary.get("passed", 0) if summary else 0
    failed = summary.get("failed", 0) if summary else 0
    skipped = summary.get("skipped", 0) if summary else 0
    pct = round(passed / total * 100) if total else 0

    rows = []
    for section, subsections in CHECKLIST.items():
        rows.append(f'<tr class="section-header"><td colspan="3">{section}</td></tr>')
        for subsection, items in subsections.items():
            rows.append(f'<tr class="subsection-header"><td colspan="3">&nbsp;&nbsp;&nbsp;{subsection}</td></tr>')
            for label, test_id in items:
                # Try matching by full or partial test id
                outcome = None
                for k, v in results.items():
                    if test_id.split("::")[-1] in k or test_id in k:
                        outcome = v
                        break
                icon = status_icon(outcome)
                cls = status_class(outcome)
                rows.append(f'''
                <tr class="test-row {cls}">
                    <td class="icon">{icon}</td>
                    <td class="label">{label}</td>
                    <td class="status">{(outcome or "pending").upper()}</td>
                </tr>''')

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SMS Test Checklist Report</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #1a1a2e; }}
  .header {{ background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 32px 40px; }}
  .header h1 {{ font-size: 28px; font-weight: 700; margin-bottom: 8px; }}
  .header .meta {{ opacity: 0.7; font-size: 14px; }}
  .summary {{ display: flex; gap: 16px; padding: 24px 40px; flex-wrap: wrap; }}
  .stat {{ background: white; border-radius: 12px; padding: 20px 28px; flex: 1; min-width: 140px;
           box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }}
  .stat .num {{ font-size: 36px; font-weight: 800; }}
  .stat .lbl {{ font-size: 13px; color: #666; margin-top: 4px; }}
  .num.green {{ color: #22c55e; }} .num.red {{ color: #ef4444; }}
  .num.yellow {{ color: #f59e0b; }} .num.blue {{ color: #3b82f6; }}
  .container {{ padding: 0 40px 40px; }}
  table {{ width: 100%; border-collapse: collapse; background: white;
           border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
  .section-header td {{ background: #1a1a2e; color: white; padding: 14px 20px;
                         font-size: 16px; font-weight: 700; letter-spacing: 0.3px; }}
  .subsection-header td {{ background: #f8fafc; color: #475569; padding: 10px 20px;
                            font-size: 13px; font-weight: 600; text-transform: uppercase;
                            letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }}
  .test-row td {{ padding: 11px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }}
  .test-row:hover td {{ background: #f8fafc; }}
  .icon {{ width: 40px; text-align: center; font-size: 16px; }}
  .status {{ width: 100px; text-align: center; font-weight: 600; font-size: 12px;
             border-radius: 20px; padding: 3px 0; }}
  .test-row.pass .status {{ background: #dcfce7; color: #16a34a; }}
  .test-row.fail .status {{ background: #fee2e2; color: #dc2626; }}
  .test-row.error .status {{ background: #fff7ed; color: #ea580c; }}
  .test-row.skip .status {{ background: #f1f5f9; color: #64748b; }}
  .test-row.pending .status {{ background: #f1f5f9; color: #94a3b8; }}
  .progress-bar {{ height: 8px; background: #e2e8f0; border-radius: 4px; margin: 8px 0; overflow: hidden; }}
  .progress-fill {{ height: 100%; background: #22c55e; border-radius: 4px; width: {pct}%; }}
  .footer {{ text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }}
</style>
</head>
<body>
<div class="header">
  <h1>🏫 SMS Test Checklist Report</h1>
  <div class="meta">Generated: {now}</div>
  <div class="progress-bar" style="margin-top:16px; width:400px">
    <div class="progress-fill"></div>
  </div>
  <div class="meta" style="margin-top:4px">{pct}% passed ({passed}/{total})</div>
</div>
<div class="summary">
  <div class="stat"><div class="num blue">{total}</div><div class="lbl">Total Tests</div></div>
  <div class="stat"><div class="num green">{passed}</div><div class="lbl">Passed ✅</div></div>
  <div class="stat"><div class="num red">{failed}</div><div class="lbl">Failed ❌</div></div>
  <div class="stat"><div class="num yellow">{skipped}</div><div class="lbl">Skipped ⏭️</div></div>
</div>
<div class="container">
  <table>
    {''.join(rows)}
  </table>
</div>
<div class="footer">SMS Automated Test Suite · {now}</div>
</body>
</html>"""
    return html


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate SMS test checklist HTML report")
    parser.add_argument("--report", default="reports/report.json", help="Path to pytest JSON report")
    parser.add_argument("--output", default="reports/checklist.html", help="Output HTML path")
    parser.add_argument("--open", action="store_true", help="Open in browser after generating")
    args = parser.parse_args()

    results, summary = load_results(args.report)
    if not results:
        print(f"⚠️  No test report found at '{args.report}'. Run pytest first.")
        print("    Generating blank checklist (all PENDING)...")
        summary = {}

    html = generate_html(results, summary or {})
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ Checklist report saved to: {args.output}")

    if args.open:
        import webbrowser
        webbrowser.open(f"file://{Path(args.output).resolve()}")
