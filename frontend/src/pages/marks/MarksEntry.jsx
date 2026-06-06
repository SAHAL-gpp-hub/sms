// MarksEntry.jsx — Full rebuild with Subject Manager + per-exam custom marks
// Fully responsive across all device sizes (logic unchanged)
import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { marksAPI, setupAPI, extractError, openSignedPdf } from '../../services/api'
import {
  PageHeader, FilterRow, Select, EmptyState,
  TableSkeleton, TabBar, InlineBanner, ConfirmModal, ReadonlyBanner, ScreenState,
} from '../../components/UI'
import OnboardingEmptyState from '../../components/OnboardingEmptyState'
import { useAcademicYear } from '../../contexts/academicYearContext'
import { useRoleContext } from '../../hooks/useRoleContext'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const EXAM_TYPES = [
  'Unit Test 1',
  'Unit Test 2',
  'Unit Test 3',
  'Unit Test 4',
  'Class Test',
  'Monthly Test',
  'Mid-Term',
  'Half-Yearly',
  'Preliminary',
  'Annual',
  'Practical',
]
const SUBJECT_TYPES = ['Theory', 'Practical', 'Theory+Practical']
const MARKS_ROW_HEIGHT = 52
const MARKS_ROW_OVERSCAN = 6

const GRADE_COLORS = {
  A1: { bg: '#dcfce7', color: '#15803d' },
  A2: { bg: '#d1fae5', color: '#065f46' },
  B1: { bg: '#dbeafe', color: '#1d4ed8' },
  B2: { bg: '#e0e7ff', color: '#4338ca' },
  C1: { bg: '#fef3c7', color: '#d97706' },
  C2: { bg: '#ffedd5', color: '#c2410c' },
  D:  { bg: '#fee2e2', color: '#b91c1c' },
  E:  { bg: '#fecdd3', color: '#9f1239' },
  AB: { bg: '#f1f5f9', color: '#64748b' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Responsive CSS — injected once
// ─────────────────────────────────────────────────────────────────────────────
const RESPONSIVE_CSS = `
  /* ───── Base layout helpers ───── */
  .me-root { width: 100%; }

  .me-control-panel {
    background: var(--surface-0);
    border: 1px solid var(--border-default);
    border-radius: 12px;
    padding: 14px;
    margin-bottom: 16px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }
  .me-control-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .me-control-title h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    color: var(--text-primary);
  }
  .me-control-title span {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .me-context-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 14px;
  }
  .me-stat-card {
    min-width: 0;
    border: 1px solid var(--border-default);
    background: var(--surface-0);
    border-radius: 10px;
    padding: 11px 12px;
  }
  .me-stat-label {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-tertiary);
    margin-bottom: 4px;
  }
  .me-stat-value {
    font-size: 17px;
    line-height: 1.2;
    font-weight: 800;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .me-stat-note {
    margin-top: 3px;
    font-size: 11.5px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ───── Add-Subject form grid ───── */
  .me-add-grid {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) 90px 90px 160px auto;
    gap: 10px;
    align-items: flex-end;
  }

  /* ───── New-exam form ───── */
  .me-newexam-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  .me-newexam-type { flex: 1; min-width: 160px; }
  .me-newexam-date { width: 160px; }

  /* ───── Filter row exam group ───── */
  .me-exam-group {
    flex: 2;
    min-width: 200px;
    display: flex;
    gap: 8px;
  }

  /* ───── Quick-set toolbar ───── */
  .me-quickset {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--gray-50);
    border: 1px solid var(--border-default);
    border-radius: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  /* ───── Tab bar wrapper — scroll on mobile ───── */
  .me-tab-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 10px;
  }
  .me-tab-wrapper > :first-child {
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* ───── Action button group ───── */
  .me-action-group {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  /* ───── Marks-entry grid table outer scroll ───── */
  .me-grid-scroll {
    overflow: auto;
    max-height: min(68vh, 720px);
    -webkit-overflow-scrolling: touch;
  }
  .me-mobile-card-list { display: none; }

  /* ───── Help/info bar above grid ───── */
  .me-info-bar {
    padding: 12px 16px;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-subtle);
    font-size: 12px;
    color: var(--text-secondary);
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .me-info-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 28px;
    padding: 4px 9px;
    border: 1px solid var(--border-default);
    border-radius: 999px;
    background: var(--surface-0);
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-secondary);
    white-space: nowrap;
  }
  .me-info-chip strong {
    color: var(--text-primary);
  }
  .me-info-chip.success {
    border-color: var(--success-100);
    background: var(--success-50);
    color: var(--success-700);
  }
  .me-info-chip.warning {
    border-color: var(--warning-100);
    background: var(--warning-50);
    color: var(--warning-600);
  }
  .me-info-chip.brand {
    border-color: var(--brand-200);
    background: var(--brand-50);
    color: var(--brand-700);
  }

  .me-subject-focus {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    font-weight: 700;
    color: var(--text-secondary);
  }
  .me-subject-focus .input {
    height: 32px;
    min-height: 32px;
    font-size: 12px;
    padding: 4px 28px 4px 9px;
  }

  .me-entry-table {
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-0);
  }
  .me-marks-table {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 12.5px;
    min-width: 100%;
  }
  .me-marks-table th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--gray-50);
    border-bottom: 1px solid var(--border-default);
  }
  .me-marks-table tbody tr:hover td {
    background: #f8fbff;
  }
  .me-sticky-student {
    position: sticky;
    left: 0;
    z-index: 3;
    box-shadow: 2px 0 6px rgba(15, 23, 42, 0.06);
  }
  .me-sticky-roll {
    position: sticky;
    left: 190px;
    z-index: 3;
    box-shadow: 2px 0 6px rgba(15, 23, 42, 0.04);
  }
  .me-student-name-cell {
    min-width: 190px;
    max-width: 220px;
    padding: 9px 14px;
    font-weight: 700;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .me-roll-cell {
    width: 58px;
    padding: 9px 10px;
    text-align: center;
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--border-subtle);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .me-subject-head {
    padding: 9px 10px;
    font-weight: 800;
    font-size: 11px;
    color: var(--text-secondary);
    text-align: center;
    min-width: 132px;
    white-space: nowrap;
  }
  .me-subject-head.has-practical { min-width: 184px; }
  .me-subject-head.custom {
    background: var(--brand-50);
    color: var(--brand-700);
  }
  .me-subject-name {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }
  .me-subject-max {
    font-size: 10px;
    font-weight: 700;
    margin-top: 2px;
    color: var(--text-tertiary);
  }
  .me-subject-head.custom .me-subject-max {
    color: var(--brand-600);
  }
  .me-cell {
    padding: 7px 8px;
    border-bottom: 1px solid var(--border-subtle);
    text-align: center;
  }
  .me-mark-controls {
    display: grid;
    grid-template-columns: repeat(2, 56px) 38px;
    justify-content: center;
    align-items: end;
    gap: 6px;
  }
  .me-mark-controls.no-practical {
    grid-template-columns: 64px 38px;
  }
  .me-mark-input {
    width: 100%;
    height: 34px;
    padding: 5px 4px;
    border: 1.5px solid var(--border-default);
    border-radius: 7px;
    font-size: 12.5px;
    text-align: center;
    outline: none;
    font-family: var(--font-mono);
    background: var(--surface-0);
    color: var(--text-primary);
    transition: border-color 0.12s, box-shadow 0.12s, background 0.12s;
  }
  .me-mark-input:focus {
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
  }
  .me-mark-input:disabled {
    background: var(--gray-100);
    color: var(--text-tertiary);
    cursor: not-allowed;
  }
  .me-mark-input.is-invalid {
    border-color: var(--danger-500);
    background: var(--danger-50);
  }
  .me-absent-toggle {
    display: grid;
    justify-items: center;
    gap: 2px;
    cursor: pointer;
    color: var(--danger-600);
    font-size: 9.5px;
    font-weight: 800;
  }
  .me-absent-toggle input {
    width: 15px;
    height: 15px;
    accent-color: var(--danger-500);
  }
  .me-absent-toggle.disabled {
    color: var(--text-tertiary);
    cursor: not-allowed;
  }

  /* ───── Footer of grid ───── */
  .me-grid-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* ───── Subject-manager toolbar ───── */
  .me-subj-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ════════════════════════════════════════════════════════════════════
     TABLET (≤ 900px)
     ════════════════════════════════════════════════════════════════════ */
  @media (max-width: 900px) {
    .me-context-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .me-add-grid {
      grid-template-columns: 1fr 1fr;
    }
    .me-add-grid > :first-child { grid-column: 1 / -1; }
    .me-add-grid > :last-child  { grid-column: 1 / -1; }

    .me-newexam-date { width: 100%; }

    .me-info-bar { gap: 10px; padding: 10px 14px; }
  }

  /* ════════════════════════════════════════════════════════════════════
     MOBILE (≤ 640px)
     ════════════════════════════════════════════════════════════════════ */
  @media (max-width: 640px) {
    .me-control-title {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
    .me-context-strip {
      grid-template-columns: 1fr;
    }
    .me-add-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .me-add-grid > * { grid-column: 1 / -1 !important; }

    .me-exam-group {
      flex-direction: column;
      width: 100%;
    }
    .me-exam-group > * { width: 100%; }

    .me-newexam-row { flex-direction: column; align-items: stretch; }
    .me-newexam-type, .me-newexam-date { width: 100%; min-width: 0; }
    .me-newexam-row .btn { width: 100%; }

    .me-quickset {
      gap: 8px;
      padding: 10px 12px;
    }
    .me-quickset > span:first-child { width: 100%; }

    .me-action-group { width: 100%; }
    .me-action-group .btn,
    .me-action-group a { flex: 1; justify-content: center; }

    .me-tab-wrapper { flex-direction: column; align-items: stretch; }

    .me-info-bar {
      font-size: 11px;
      padding: 10px 12px;
      gap: 8px;
    }
    .me-subject-focus {
      width: 100%;
      margin-left: 0;
      justify-content: space-between;
    }
    .me-subject-focus .input {
      flex: 1;
      min-width: 0;
    }

    .me-grid-footer {
      flex-direction: column;
      align-items: stretch;
    }
    .me-grid-footer .btn { width: 100%; }

    .me-subj-toolbar { flex-direction: column; align-items: stretch; }
    .me-subj-toolbar > div:last-child {
      justify-content: space-between;
      width: 100%;
    }

    /* Make data tables scroll horizontally on mobile */
    .data-table { font-size: 12px; }
    .data-table th, .data-table td { padding: 8px 10px; }

    /* Hide some table cols on extreme small screens */
    .me-hide-mobile { display: none; }
  }

  @media (max-width: 768px) {
    .me-entry-table { display: none; }
    .me-mobile-card-list {
      display: grid;
      gap: 12px;
      padding: 12px;
    }
    .me-student-mark-card {
      border: 1px solid var(--border-default);
      border-radius: 10px;
      background: var(--surface-0);
      overflow: hidden;
    }
    .me-student-mark-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px;
      background: var(--gray-50);
      border-bottom: 1px solid var(--border-subtle);
    }
    .me-subject-mark-row {
      display: grid;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .me-subject-mark-row:last-child { border-bottom: 0; }
    .me-mobile-mark-inputs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
      gap: 8px;
      align-items: end;
    }
    .me-mobile-mark-inputs input[type="number"] {
      width: 100%;
      min-height: 44px;
      text-align: center;
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     EXTRA SMALL (≤ 420px)
     ════════════════════════════════════════════════════════════════════ */
  @media (max-width: 420px) {
    .me-info-bar > span { font-size: 10.5px; }
    .data-table { font-size: 11.5px; }
  }
`

// Inject CSS once
if (typeof document !== 'undefined' && !document.getElementById('me-responsive-css')) {
  const styleEl = document.createElement('style')
  styleEl.id = 'me-responsive-css'
  styleEl.textContent = RESPONSIVE_CSS
  document.head.appendChild(styleEl)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function GradeBadge({ grade }) {
  const s = GRADE_COLORS[grade] || { bg: 'var(--gray-100)', color: 'var(--gray-600)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '32px', height: '20px',
      fontSize: '11px', fontWeight: 800,
      background: s.bg, color: s.color,
      borderRadius: '5px',
    }}>
      {grade}
    </span>
  )
}

function isMarkInvalid(value, max) {
  if (value === '' || value === undefined || value === null || Number(max) <= 0) return false
  const numeric = Number(value)
  return Number.isNaN(numeric) || numeric < 0 || numeric > Number(max)
}

function useIsCompactMarksLayout() {
  const [isCompact, setIsCompact] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 820px)').matches
      : false
  ))

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)')
    const handleChange = () => setIsCompact(media.matches)
    handleChange()
    media.addEventListener?.('change', handleChange)
    return () => media.removeEventListener?.('change', handleChange)
  }, [])

  return isCompact
}

function EntryStat({ label, value, note }) {
  return (
    <div className="me-stat-card">
      <div className="me-stat-label">{label}</div>
      <div className="me-stat-value" title={String(value)}>{value}</div>
      {note && <div className="me-stat-note" title={note}>{note}</div>}
    </div>
  )
}

const StudentMarksCard = memo(function StudentMarksCard({ student, subjects, marks, onChange, canEditSubject }) {
  return (
    <article className="me-student-mark-card">
      <div className="me-student-mark-header">
        <div>
          <div style={{ fontWeight: 850, color: 'var(--text-primary)' }}>{student.student_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Roll {student.roll_number || '-'}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-700)', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: 999, padding: '3px 8px' }}>
          {subjects.length} subject{subjects.length === 1 ? '' : 's'}
        </span>
      </div>
      {subjects.map(subject => {
        const current = marks?.[subject.id] || {}
        const locked = current.is_locked || !canEditSubject(subject.id)
        return (
          <div key={subject.id} className="me-subject-mark-row">
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                {subject.name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Theory /{subject.max_theory}{subject.max_practical > 0 ? ` · Practical /${subject.max_practical}` : ''}
              </div>
            </div>
            <div className="me-mobile-mark-inputs">
              <label>
                <span className="label" style={{ fontSize: 11 }}>Theory</span>
                <input
                  className={`input me-mark-input ${isMarkInvalid(current.theory, subject.max_theory) ? 'is-invalid' : ''}`}
                  type="number"
                  min="0"
                  max={subject.max_theory}
                  value={current.theory ?? ''}
                  onChange={event => onChange(student.student_id, subject.id, 'theory', event.target.value)}
                  disabled={locked || current.is_absent}
                  placeholder={`/${subject.max_theory}`}
                />
              </label>
              {subject.max_practical > 0 ? (
                <label>
                  <span className="label" style={{ fontSize: 11 }}>Practical</span>
                  <input
                    className={`input me-mark-input ${isMarkInvalid(current.practical, subject.max_practical) ? 'is-invalid' : ''}`}
                    type="number"
                    min="0"
                    max={subject.max_practical}
                    value={current.practical ?? ''}
                    onChange={event => onChange(student.student_id, subject.id, 'practical', event.target.value)}
                    disabled={locked || current.is_absent}
                    placeholder={`/${subject.max_practical}`}
                  />
                </label>
              ) : (
                <div />
              )}
              <label className={`me-absent-toggle ${locked ? 'disabled' : ''}`} style={{ alignSelf: 'end', minHeight: 44 }}>
                Abs
                <input
                  type="checkbox"
                  checked={current.is_absent || false}
                  onChange={event => onChange(student.student_id, subject.id, 'is_absent', event.target.checked)}
                  disabled={locked}
                />
              </label>
            </div>
          </div>
        )
      })}
    </article>
  )
})

const MarksGridRow = memo(function MarksGridRow({
  student,
  subjects,
  marks,
  rowIndex,
  onChange,
  canEditSubject,
}) {
  const rowBackground = rowIndex % 2 === 0 ? 'var(--surface-0)' : 'var(--gray-25)'
  return (
    <tr style={{ background: rowBackground, height: MARKS_ROW_HEIGHT }}>
      <td className="me-sticky-student me-student-name-cell" style={{ background: rowBackground }}>
        {student.student_name}
      </td>
      <td className="me-sticky-roll me-roll-cell" style={{ background: rowBackground }}>
        {student.roll_number || '-'}
      </td>
      {subjects.map(sub => {
        const current = marks?.[sub.id] || {}
        const locked = current.is_locked || !canEditSubject(sub.id)
        return (
          <td key={sub.id} className="me-cell" style={{ background: sub.has_custom_config && rowIndex % 2 === 0 ? '#fafbff' : undefined }}>
            <div className={`me-mark-controls ${sub.max_practical > 0 ? '' : 'no-practical'}`}>
              <input
                type="number"
                min="0"
                max={sub.max_theory}
                value={current.theory ?? ''}
                onChange={event => onChange(student.student_id, sub.id, 'theory', event.target.value)}
                disabled={locked || current.is_absent}
                placeholder={`/${sub.max_theory}`}
                className={`me-mark-input ${isMarkInvalid(current.theory, sub.max_theory) ? 'is-invalid' : ''}`}
              />
              {sub.max_practical > 0 && (
                <input
                  type="number"
                  min="0"
                  max={sub.max_practical}
                  value={current.practical ?? ''}
                  onChange={event => onChange(student.student_id, sub.id, 'practical', event.target.value)}
                  disabled={locked || current.is_absent}
                  placeholder={`P/${sub.max_practical}`}
                  className={`me-mark-input ${isMarkInvalid(current.practical, sub.max_practical) ? 'is-invalid' : ''}`}
                />
              )}
              <label className={`me-absent-toggle ${locked ? 'disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={current.is_absent || false}
                  onChange={event => onChange(student.student_id, sub.id, 'is_absent', event.target.checked)}
                  disabled={locked}
                />
                <span>
                  {current.is_locked ? 'Locked' : !canEditSubject(sub.id) ? 'View' : 'Abs'}
                </span>
              </label>
            </div>
          </td>
        )
      })}
    </tr>
  )
})

// ── Subject Manager ───────────────────────────────────────────────────────────
function SubjectManager({ classId, onSubjectsChanged }) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [seedingSubjects, setSeedingSubjects] = useState(false)

  const [newForm, setNewForm] = useState({
    name: '', max_theory: '100', max_practical: '0', subject_type: 'Theory',
  })
  const [addingSubject, setAddingSubject] = useState(false)

  const fetchSubjects = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    try {
      const r = await marksAPI.getSubjects(classId, showInactive)
      setSubjects(r.data)
    } catch {
      toast.error('Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }, [classId, showInactive])

  useEffect(() => { fetchSubjects() }, [fetchSubjects])

  const handleSeedSubjects = async () => {
    setSeedingSubjects(true)
    try {
      const r = await marksAPI.seedSubjects(classId)
      toast.success(r.data.message || 'GSEB subjects loaded')
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSeedingSubjects(false)
    }
  }

  const handleAddSubject = async () => {
    if (!newForm.name.trim()) { toast.error('Subject name is required'); return }
    const maxT = parseInt(newForm.max_theory)
    const maxP = parseInt(newForm.max_practical || '0')
    if (!maxT || maxT <= 0) { toast.error('Max theory marks must be > 0'); return }
    if (maxP < 0) { toast.error('Max practical marks cannot be negative'); return }

    setAddingSubject(true)
    try {
      await marksAPI.createSubject({
        name: newForm.name.trim(),
        class_id: parseInt(classId),
        max_theory: maxT,
        max_practical: maxP,
        subject_type: newForm.subject_type,
      })
      toast.success(`Subject "${newForm.name.trim()}" added`)
      setNewForm({ name: '', max_theory: '100', max_practical: '0', subject_type: 'Theory' })
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setAddingSubject(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    if (!editTarget.name?.trim()) { toast.error('Subject name is required'); return }
    const maxT = parseInt(editTarget.max_theory)
    const maxP = parseInt(editTarget.max_practical || '0')
    if (!maxT || maxT <= 0) { toast.error('Max theory marks must be > 0'); return }

    setSaving(true)
    try {
      await marksAPI.updateSubject(editTarget.id, {
        name:          editTarget.name.trim(),
        max_theory:    maxT,
        max_practical: maxP,
        subject_type:  editTarget.subject_type,
      })
      toast.success('Subject updated')
      setEditTarget(null)
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (subject) => {
    try {
      await marksAPI.updateSubject(subject.id, { is_active: !subject.is_active })
      toast.success(subject.is_active ? 'Subject hidden from grids' : 'Subject restored')
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const r = await marksAPI.deleteSubject(deleteTarget.id)
      if (r.data.soft) {
        toast('Subject has mark history — hidden instead of deleted', { icon: 'ℹ️' })
      } else {
        toast.success(`"${deleteTarget.name}" deleted`)
      }
      setDeleteTarget(null)
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setDeleting(false)
    }
  }

  const activeSubjects   = subjects.filter(s => s.is_active)
  const inactiveSubjects = subjects.filter(s => !s.is_active)

  return (
    <div>
      {/* Toolbar */}
      <div className="me-subj-toolbar">
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {activeSubjects.length} active subject{activeSubjects.length !== 1 ? 's' : ''}
            {inactiveSubjects.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                ({inactiveSubjects.length} hidden)
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Add, edit or remove subjects for this class. Changes apply to all future exams.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {inactiveSubjects.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                style={{ accentColor: 'var(--brand-500)' }}
              />
              Show hidden
            </label>
          )}
          <button
            className="btn btn-secondary"
            onClick={handleSeedSubjects}
            disabled={seedingSubjects}
            style={{ fontSize: '12.5px' }}
          >
            {seedingSubjects
              ? <><span className="spinner" style={{ width: '12px', height: '12px' }} /> Loading…</>
              : 'Load GSEB Defaults'
            }
          </button>
        </div>
      </div>

      {/* Add subject form */}
      <div style={{
        background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand-700)', marginBottom: '12px' }}>
          Add New Subject
        </div>
        <div className="me-add-grid">
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Subject Name *</label>
            <input
              className="input"
              value={newForm.name}
              onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mathematics"
              onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
            />
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Max Theory</label>
            <input
              type="number"
              className="input"
              value={newForm.max_theory}
              onChange={e => setNewForm(f => ({ ...f, max_theory: e.target.value }))}
              min="1"
              style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Max Practical</label>
            <input
              type="number"
              className="input"
              value={newForm.max_practical}
              onChange={e => setNewForm(f => ({ ...f, max_practical: e.target.value }))}
              min="0"
              style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Type</label>
            <select
              className="input"
              value={newForm.subject_type}
              onChange={e => setNewForm(f => ({ ...f, subject_type: e.target.value }))}
            >
              {SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAddSubject}
            disabled={addingSubject}
            style={{ alignSelf: 'flex-end' }}
          >
            {addingSubject
              ? <span className="spinner" style={{ width: '13px', height: '13px' }} />
              : <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </>
            }
          </button>
        </div>
      </div>

      {/* Subjects table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <table className="data-table"><TableSkeleton rows={5} cols={5} /></table>
        ) : subjects.length === 0 ? (
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
            title="No subjects defined"
            description="Add subjects above or load GSEB defaults for this class"
          />
        ) : (
          <table className="data-table" style={{ minWidth: '720px' }}>
            <thead>
              <tr>
                <th>Subject Name</th>
                <th style={{ textAlign: 'center' }}>Default Max (T)</th>
                <th style={{ textAlign: 'center' }}>Default Max (P)</th>
                <th style={{ textAlign: 'center' }}>Type</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(subject => (
                <tr key={subject.id} style={{ opacity: subject.is_active ? 1 : 0.55 }}>
                  {editTarget?.id === subject.id ? (
                    <>
                      <td>
                        <input
                          className="input"
                          value={editTarget.name}
                          onChange={e => setEditTarget(t => ({ ...t, name: e.target.value }))}
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                          autoFocus
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input"
                          value={editTarget.max_theory}
                          onChange={e => setEditTarget(t => ({ ...t, max_theory: e.target.value }))}
                          style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '13px', width: '80px' }}
                          min="1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input"
                          value={editTarget.max_practical}
                          onChange={e => setEditTarget(t => ({ ...t, max_practical: e.target.value }))}
                          style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '13px', width: '80px' }}
                          min="0"
                        />
                      </td>
                      <td>
                        <select
                          className="input"
                          value={editTarget.subject_type}
                          onChange={e => setEditTarget(t => ({ ...t, subject_type: e.target.value }))}
                          style={{ padding: '6px 8px', fontSize: '13px' }}
                        >
                          {SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td />
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={handleSaveEdit}
                            disabled={saving}
                          >
                            {saving ? <span className="spinner" style={{ width: '11px', height: '11px' }} /> : 'Save'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditTarget(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: subject.is_active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {subject.name}
                          </span>
                          {!subject.is_active && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'var(--gray-200)', color: 'var(--gray-500)' }}>
                              HIDDEN
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {subject.max_theory}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: subject.max_practical > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: subject.max_practical > 0 ? 700 : 400 }}>
                        {subject.max_practical > 0 ? subject.max_practical : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                          background: subject.subject_type === 'Theory+Practical' ? 'var(--purple-100)' : 'var(--gray-100)',
                          color: subject.subject_type === 'Theory+Practical' ? 'var(--purple-600)' : 'var(--gray-600)',
                        }}>
                          {subject.subject_type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleActive(subject)}
                          style={{
                            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                            background: subject.is_active ? 'var(--success-100)' : 'var(--gray-100)',
                            color: subject.is_active ? 'var(--success-700)' : 'var(--gray-500)',
                            border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          }}
                          title={subject.is_active ? 'Click to hide from grids' : 'Click to restore'}
                        >
                          {subject.is_active ? 'Active' : 'Hidden'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setEditTarget({ ...subject })}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600,
                              color: 'var(--brand-600)', background: 'var(--brand-50)',
                              border: '1px solid var(--brand-100)', cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(subject)}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600,
                              color: 'var(--danger-600)', background: 'var(--danger-50)',
                              border: '1px solid var(--danger-100)', cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Subject"
        message={
          `Delete "${deleteTarget?.name}"? If marks have been recorded for this subject, it will be hidden instead of permanently deleted to preserve historical data.`
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}

// ── Exam Config Panel ─────────────────────────────────────────────────────────
function ExamConfigPanel({ examId, classId, onConfigSaved }) {
  const [subjects, setSubjects]       = useState([])
  const [configs, setConfigs]         = useState({})
  const [useCustom, setUseCustom]     = useState({})
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [applyAll, setApplyAll]       = useState('')

  useEffect(() => {
    if (!examId || !classId) return
    setLoading(true)
    Promise.all([
      marksAPI.getSubjects(classId),
      marksAPI.getExamConfigs(examId),
    ]).then(([subRes, cfgRes]) => {
      const subs = subRes.data
      setSubjects(subs)

      const cfgMap = {}
      const useMap = {}
      cfgRes.data.forEach(c => {
        cfgMap[c.subject_id] = { max_theory: c.max_theory, max_practical: c.max_practical }
        useMap[c.subject_id] = true
      })
      subs.forEach(s => {
        if (!cfgMap[s.id]) {
          cfgMap[s.id] = { max_theory: s.max_theory, max_practical: s.max_practical }
          useMap[s.id] = false
        }
      })
      setConfigs(cfgMap)
      setUseCustom(useMap)
    }).catch(() => {
      toast.error('Failed to load exam config')
    }).finally(() => setLoading(false))
  }, [examId, classId])

  const handleApplyAll = (val) => {
    const num = parseInt(val)
    if (!num || num <= 0) return
    const newCfg = { ...configs }
    const newUse = { ...useCustom }
    subjects.forEach(s => {
      newCfg[s.id] = { max_theory: num, max_practical: configs[s.id]?.max_practical ?? 0 }
      newUse[s.id] = true
    })
    setConfigs(newCfg)
    setUseCustom(newUse)
    setApplyAll('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const configsToSend = subjects
        .filter(s => useCustom[s.id])
        .map(s => ({
          subject_id:    s.id,
          max_theory:    parseInt(configs[s.id]?.max_theory) || s.max_theory,
          max_practical: parseInt(configs[s.id]?.max_practical) || 0,
        }))

      await marksAPI.setExamConfigs(examId, configsToSend)
      toast.success(
        configsToSend.length === 0
          ? 'Reverted to subject defaults for all subjects'
          : `Custom marks saved for ${configsToSend.length} subject${configsToSend.length !== 1 ? 's' : ''}`
      )
      onConfigSaved?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleClearAll = async () => {
    setSaving(true)
    try {
      await marksAPI.clearExamConfigs(examId)
      const newCfg = {}
      const newUse = {}
      subjects.forEach(s => {
        newCfg[s.id] = { max_theory: s.max_theory, max_practical: s.max_practical }
        newUse[s.id] = false
      })
      setConfigs(newCfg)
      setUseCustom(newUse)
      toast.success('Reverted to subject defaults')
      onConfigSaved?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const hasAnyCustom = subjects.some(s => useCustom[s.id])

  if (loading) {
    return (
      <div style={{ padding: '20px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="spinner" /> Loading exam configuration…
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <InlineBanner
        type="warning"
        title="No subjects defined for this class"
        message="Go to the Subjects tab to add subjects first."
      />
    )
  }

  return (
    <div>
      <InlineBanner
        type="info"
        title="Custom marks per exam"
        message="Override the default max marks for this specific exam. Example: set all subjects to 25 for Unit Tests, 50 for Half-Yearly. Leave unchecked to use the subject's default max marks."
      />

      <div className="me-quickset">
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Quick-set all theory to:
        </span>
        {[25, 50, 80, 100].map(val => (
          <button
            key={val}
            onClick={() => handleApplyAll(val)}
            style={{
              padding: '5px 12px', borderRadius: '7px',
              fontSize: '12.5px', fontWeight: 700,
              background: 'var(--surface-0)', color: 'var(--brand-700)',
              border: '1.5px solid var(--brand-200)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-50)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-0)' }}
          >
            {val} marks
          </button>
        ))}
        <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>or</span>
        <input
          type="number"
          className="input"
          value={applyAll}
          onChange={e => setApplyAll(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleApplyAll(applyAll)}
          placeholder="Custom…"
          min="1"
          style={{ width: '90px', padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
        />
        {applyAll && (
          <button
            onClick={() => handleApplyAll(applyAll)}
            className="btn btn-primary btn-sm"
          >
            Apply
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: '16px', overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: '720px' }}>
          <thead>
            <tr>
              <th>Subject</th>
              <th style={{ textAlign: 'center' }}>Default Max (T)</th>
              <th style={{ textAlign: 'center' }}>Default Max (P)</th>
              <th style={{ textAlign: 'center', width: '120px' }}>Override?</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Custom Max (T)</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Custom Max (P)</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map(s => {
              const isCustom = useCustom[s.id] || false
              const cfg = configs[s.id] || { max_theory: s.max_theory, max_practical: s.max_practical }
              return (
                <tr key={s.id} style={{ background: isCustom ? 'var(--brand-50)' : undefined }}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.name}
                    {isCustom && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'var(--brand-100)', color: 'var(--brand-700)' }}>
                        CUSTOM
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {s.max_theory}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {s.max_practical > 0 ? s.max_practical : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isCustom}
                        onChange={e => setUseCustom(u => ({ ...u, [s.id]: e.target.checked }))}
                        style={{ accentColor: 'var(--brand-500)', width: '15px', height: '15px' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: isCustom ? 'var(--brand-700)' : 'var(--text-tertiary)' }}>
                        {isCustom ? 'Yes' : 'No'}
                      </span>
                    </label>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input"
                      value={cfg.max_theory}
                      onChange={e => setConfigs(c => ({ ...c, [s.id]: { ...c[s.id], max_theory: e.target.value } }))}
                      disabled={!isCustom}
                      min="1"
                      style={{
                        width: '80px', padding: '6px 8px', textAlign: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: '13px',
                        background: isCustom ? 'var(--surface-0)' : 'var(--gray-100)',
                        color: isCustom ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input"
                      value={cfg.max_practical}
                      onChange={e => setConfigs(c => ({ ...c, [s.id]: { ...c[s.id], max_practical: e.target.value } }))}
                      disabled={!isCustom || s.max_practical === 0}
                      min="0"
                      style={{
                        width: '80px', padding: '6px 8px', textAlign: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: '13px',
                        background: (isCustom && s.max_practical > 0) ? 'var(--surface-0)' : 'var(--gray-100)',
                        color: (isCustom && s.max_practical > 0) ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</>
            : 'Save Exam Configuration'
          }
        </button>
        {hasAnyCustom && (
          <button
            className="btn btn-secondary"
            onClick={handleClearAll}
            disabled={saving}
          >
            Reset to Subject Defaults
          </button>
        )}
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {hasAnyCustom
            ? `${subjects.filter(s => useCustom[s.id]).length} subject${subjects.filter(s => useCustom[s.id]).length !== 1 ? 's' : ''} with custom marks`
            : 'Using subject defaults for all subjects'
          }
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MarksEntry page
// ─────────────────────────────────────────────────────────────────────────────
export default function MarksEntry() {
  const {
    selectedYearId: selectedYear,
    selectedYear: selectedYearMeta,
    years,
    isClosedYear,
    setSelectedYearId,
  } = useAcademicYear()
  const { user: authUser, isTeacher, subjectAssignments, classTeacherClassIds, subjectClassIds: marksClassIds } = useRoleContext()

  const [classes, setClasses]         = useState([])
  const [exams, setExams]             = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedExam, setSelectedExam]   = useState('')

  const [gridData, setGridData]       = useState(null)
  const [localMarks, setLocalMarks]   = useState({})
  const [dirty, setDirty]             = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [gridScrollTop, setGridScrollTop] = useState(0)
  const [gridViewportHeight, setGridViewportHeight] = useState(620)
  const marksGridRef = useRef(null)

  const [results, setResults]         = useState([])
  const [loadingResults, setLoadingResults] = useState(false)

  const [view, setView]               = useState('entry')
  const isCompactMarksLayout = useIsCompactMarksLayout()

  const [showNewExam, setShowNewExam] = useState(false)
  const [newExam, setNewExam]         = useState({ name: '', exam_date: '' })
  const [creatingExam, setCreatingExam] = useState(false)

  // ── draftKey ─────────────────────────────────────────────────────────────
  const draftKey = selectedExam && selectedClass ? `marks-draft:${selectedClass}:${selectedExam}` : null

  // ── Role/permission derived values — MUST be defined before loadGrid and
  //    handleMarkChange which reference canEditSubject in their dep arrays ───
  const teacherSubjectIds = useMemo(() => (
    subjectAssignments
      .filter(assignment => Number(assignment.class_id) === Number(selectedClass))
      .map(assignment => Number(assignment.subject_id))
  ), [selectedClass, subjectAssignments])

  const isClassTeacherForSelectedClass = useMemo(() => (
    classTeacherClassIds.map(Number).includes(Number(selectedClass))
  ), [classTeacherClassIds, selectedClass])

  const hasSpecificSubjectsForSelectedClass = teacherSubjectIds.length > 0

  const canEditSubject = useCallback((subjectId) => (
    !isClosedYear && (
      !isTeacher ||
      (!hasSpecificSubjectsForSelectedClass && isClassTeacherForSelectedClass) ||
      teacherSubjectIds.includes(Number(subjectId))
    )
  ), [hasSpecificSubjectsForSelectedClass, isClassTeacherForSelectedClass, isClosedYear, isTeacher, teacherSubjectIds])

  // ── loadGrid — canEditSubject is defined above so this is safe ────────────
  const loadGrid = useCallback(async () => {
    if (!selectedExam || !selectedClass) return
    setLoadingGrid(true)
    setSaved(false)
    try {
      const r = await marksAPI.getMarksEntry(selectedExam, selectedClass)
      setGridData(r.data)
      const map = {}
      r.data.students.forEach(s => {
        map[s.student_id] = {}
        Object.entries(s.marks).forEach(([subId, m]) => {
          map[s.student_id][subId] = {
            theory:    m.theory    ?? '',
            practical: m.practical ?? '',
            is_absent: m.is_absent || false,
            is_locked: m.is_locked || false,
          }
        })
      })
      if (draftKey) {
        const raw = localStorage.getItem(draftKey)
        if (raw) {
          try {
            const draft = JSON.parse(raw)
            if (draft?.marks && window.confirm('Restore the unsaved marks draft for this class and exam?')) {
              setLocalMarks(draft.marks)
              setDraftSavedAt(draft.savedAt || null)
              setDirty(true)
              return
            }
          } catch {
            localStorage.removeItem(draftKey)
          }
        }
      }
      setLocalMarks(map)
      setDirty(false)
      setDraftSavedAt(null)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoadingGrid(false)
    }
  }, [selectedExam, selectedClass, draftKey])

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedYear) {
      setClasses([])
      setSelectedClass('')
      return
    }
    setupAPI.getClasses(selectedYear).then(r => {
      const allClasses = r.data || []
      setClasses(
        isTeacher
          ? allClasses.filter(c => marksClassIds.includes(c.id))
          : allClasses
      )
    })
  }, [isTeacher, marksClassIds, selectedYear])

  useEffect(() => {
    if (selectedClass && selectedYear) {
      marksAPI.getExams({ class_id: selectedClass, academic_year_id: selectedYear })
        .then(r => setExams(r.data))
    } else {
      setExams([])
    }
  }, [selectedClass, selectedYear])

  useEffect(() => {
    if (selectedExam && selectedClass && view === 'entry') {
      loadGrid()
    }
  }, [selectedExam, selectedClass, view, loadGrid])

  useEffect(() => {
    if (!gridData || !selectedClass) return
    const filterKey = `marks-subject-filter:${selectedClass}:${authUser?.id || 'user'}`
    const saved = localStorage.getItem(filterKey)
    if (saved && (saved === 'all' || gridData.subjects.some(subject => String(subject.id) === saved))) {
      setSubjectFilter(saved)
      return
    }
    if (!isTeacher || subjectAssignments.length === 0) return
    const mySubjectsForClass = subjectAssignments
      .filter(assignment => Number(assignment.class_id) === Number(selectedClass))
      .map(assignment => String(assignment.subject_id))
      .filter(subjectId => gridData.subjects.some(subject => String(subject.id) === subjectId))
    if (mySubjectsForClass.length === 1) setSubjectFilter(mySubjectsForClass[0])
  }, [authUser?.id, gridData, isTeacher, selectedClass, subjectAssignments])

  useEffect(() => {
    if (!selectedClass) return
    localStorage.setItem(`marks-subject-filter:${selectedClass}:${authUser?.id || 'user'}`, subjectFilter)
  }, [authUser?.id, selectedClass, subjectFilter])

  useEffect(() => {
    setGridScrollTop(0)
    marksGridRef.current?.scrollTo?.({ top: 0 })
  }, [gridData, subjectFilter])

  useEffect(() => {
    if (!draftKey || !dirty) return undefined
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString()
      localStorage.setItem(draftKey, JSON.stringify({ marks: localMarks, savedAt }))
      setDraftSavedAt(savedAt)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [dirty, draftKey, localMarks])

  useEffect(() => {
    if (!dirty) return undefined
    const handler = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleMarkChange = useCallback((studentId, subjectId, field, value) => {
    if (isClosedYear || !canEditSubject(subjectId)) return
    setDirty(true)
    setLocalMarks(prev => {
      if (prev[studentId]?.[subjectId]?.is_locked) return prev
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [subjectId]: { ...prev[studentId]?.[subjectId], [field]: value },
        },
      }
    })
    setSaved(false)
  }, [canEditSubject, isClosedYear])

  const validateMarks = () => {
    if (!gridData) return true
    const issues = []
    gridData.students.forEach(student => {
      gridData.subjects.forEach(subject => {
        const marks = localMarks[student.student_id]?.[subject.id] || {}
        if (!canEditSubject(subject.id) || marks.is_locked) return
        if (marks.is_absent) return
        const checks = [
          { label: 'theory', value: marks.theory, max: subject.max_theory },
          { label: 'practical', value: marks.practical, max: subject.max_practical },
        ]
        checks.forEach(check => {
          if (check.value === '' || check.value === undefined || check.value === null || check.max <= 0) return
          const numeric = Number(check.value)
          if (Number.isNaN(numeric) || numeric < 0 || numeric > check.max) {
            issues.push(`${student.student_name} ${subject.name} ${check.label} must be 0-${check.max}`)
          }
        })
      })
    })
    if (issues.length) {
      toast.error(`Fix marks first: ${issues.slice(0, 2).join('; ')}${issues.length > 2 ? ` and ${issues.length - 2} more` : ''}`)
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (isClosedYear) return
    if (!gridData) return
    if (!validateMarks()) return
    setSaving(true)
    try {
      const entries = []
      gridData.students.forEach(s => {
        gridData.subjects.forEach(sub => {
          if (!canEditSubject(sub.id)) return
          const m = localMarks[s.student_id]?.[sub.id]
          if (m?.is_locked) return
          entries.push({
            enrollment_id:   s.enrollment_id,
            student_id:      s.student_id,
            subject_id:      sub.id,
            exam_id:         parseInt(selectedExam),
            theory_marks:    m?.theory !== '' && m?.theory !== undefined ? parseFloat(m.theory) : null,
            practical_marks: m?.practical !== '' && m?.practical !== undefined ? parseFloat(m.practical) : null,
            is_absent:       m?.is_absent || false,
          })
        })
      })
      if (entries.length === 0) {
        toast.error('No editable marks available for this selection')
        return
      }
      await marksAPI.bulkSaveMarks(entries)
      if (draftKey) localStorage.removeItem(draftKey)
      setDirty(false)
      setDraftSavedAt(null)
      setSaved(true)
      toast.success('Marks saved successfully')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleViewResults = async () => {
    setView('results')
    if (!selectedExam || !selectedClass) return
    setLoadingResults(true)
    try {
      const r = await marksAPI.getResults(selectedExam, selectedClass)
      setResults(r.data)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoadingResults(false)
    }
  }

  const handleCreateExam = async () => {
    if (!selectedClass || !selectedYear) return
    const examName = newExam.name.trim()
    if (!examName) {
      toast.error('Enter an exam name')
      return
    }
    setCreatingExam(true)
    try {
      await marksAPI.createExam({
        name:             examName,
        class_id:         parseInt(selectedClass),
        academic_year_id: parseInt(selectedYear),
        exam_date:        newExam.exam_date || null,
      })
      const r = await marksAPI.getExams({ class_id: selectedClass, academic_year_id: selectedYear })
      setExams(r.data)
      setShowNewExam(false)
      setNewExam({ name: '', exam_date: '' })
      toast.success(`Exam "${examName}" created`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCreatingExam(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const confirmLoseMarksDraft = () => !dirty || window.confirm('You have unsaved marks. Continue and keep only the autosaved draft?')
  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const yearOptions  = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))
  const hasSubjects  = gridData?.subjects?.length > 0
  const hasStudents  = gridData?.students?.length > 0
  const hasCustomConfig = gridData?.subjects?.some(s => s.has_custom_config)
  const examName     = exams.find(e => String(e.id) === selectedExam)?.name || 'Exam'

  const visibleSubjects = useMemo(() => {
    if (!gridData?.subjects) return []
    if (subjectFilter === 'all') return gridData.subjects
    return gridData.subjects.filter(subject => String(subject.id) === subjectFilter)
  }, [gridData, subjectFilter])

  const virtualRows = useMemo(() => {
    const students = gridData?.students || []
    if (isCompactMarksLayout || students.length <= 24) {
      return {
        topPadding: 0,
        bottomPadding: 0,
        rows: students.map((student, index) => ({ student, index })),
      }
    }
    const visibleCount = Math.ceil(gridViewportHeight / MARKS_ROW_HEIGHT) + MARKS_ROW_OVERSCAN * 2
    const start = Math.max(0, Math.floor(gridScrollTop / MARKS_ROW_HEIGHT) - MARKS_ROW_OVERSCAN)
    const end = Math.min(students.length, start + visibleCount)
    return {
      topPadding: start * MARKS_ROW_HEIGHT,
      bottomPadding: Math.max(0, (students.length - end) * MARKS_ROW_HEIGHT),
      rows: students.slice(start, end).map((student, offset) => ({ student, index: start + offset })),
    }
  }, [gridData, gridScrollTop, gridViewportHeight, isCompactMarksLayout])

  const handleGridScroll = useCallback(event => {
    setGridScrollTop(event.currentTarget.scrollTop)
    setGridViewportHeight(event.currentTarget.clientHeight || 620)
  }, [])

  const selectedClassMeta = classes.find(c => String(c.id) === selectedClass)
  const selectedClassLabel = selectedClassMeta ? `Class ${selectedClassMeta.name} - ${selectedClassMeta.division}` : 'No class selected'

  const entryStats = useMemo(() => {
    if (!gridData) {
      return { filled: 0, editable: 0, absent: 0, locked: 0, invalid: 0, completion: 0 }
    }
    let filled = 0
    let editable = 0
    let absent = 0
    let locked = 0
    let invalid = 0
    gridData.students.forEach(student => {
      visibleSubjects.forEach(subject => {
        const marks = localMarks[student.student_id]?.[subject.id] || {}
        const subjectLocked = marks.is_locked || !canEditSubject(subject.id)
        if (subjectLocked) {
          locked += 1
          return
        }
        editable += 1
        if (marks.is_absent) {
          absent += 1
          filled += 1
          return
        }
        const hasTheory = marks.theory !== '' && marks.theory !== undefined && marks.theory !== null
        const needsPractical = Number(subject.max_practical) > 0
        const hasPractical = marks.practical !== '' && marks.practical !== undefined && marks.practical !== null
        if (hasTheory && (!needsPractical || hasPractical)) filled += 1
        if (isMarkInvalid(marks.theory, subject.max_theory) || isMarkInvalid(marks.practical, subject.max_practical)) {
          invalid += 1
        }
      })
    })
    return {
      filled,
      editable,
      absent,
      locked,
      invalid,
      completion: editable ? Math.round((filled / editable) * 100) : 0,
    }
  }, [canEditSubject, gridData, localMarks, visibleSubjects])

  const mainTabs = [
    { value: 'entry',     label: 'Marks Entry' },
    { value: 'results',   label: 'Results' },
    ...(!isTeacher ? [{ value: 'subjects',  label: 'Subjects' }] : []),
    ...(!isTeacher && selectedExam ? [{ value: 'examconfig', label: 'Exam Marks Setup' }] : []),
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="me-root">
      <PageHeader
        title="Marks Entry"
        subtitle={selectedYearMeta?.label ? `Enter marks for ${selectedYearMeta.label}. Teacher edits are limited to assigned subjects.` : 'Enter marks class-wise. Manage subjects dynamically. Set custom max marks per exam.'}
      />
      {isClosedYear && (
        <ReadonlyBanner
          yearLabel={selectedYearMeta?.label}
          reason="This academic year is closed. Marks can be reviewed, but creating exams and saving marks are disabled."
        />
      )}

      {/* Top filters */}
      <div className="me-control-panel">
        <div className="me-control-title">
          <h2>Marks workspace</h2>
          <span>{dirty ? 'Unsaved changes are kept in an autosaved draft.' : 'Choose a class and exam to load the entry grid.'}</span>
        </div>
        <FilterRow>
          <Select
            value={selectedClass}
            onChange={e => {
              if (!confirmLoseMarksDraft()) return
              setSelectedClass(e.target.value)
              setSelectedExam('')
              setGridData(null)
              setSubjectFilter('all')
              setDirty(false)
              setView('entry')
            }}
            options={classOptions}
            placeholder="Select class..."
            style={{ flex: 1, minWidth: '180px' }}
          />
          <Select
            value={selectedYear}
            onChange={e => {
              if (!confirmLoseMarksDraft()) return
              setSelectedYearId(e.target.value)
              setSelectedExam('')
              setGridData(null)
              setSubjectFilter('all')
              setDirty(false)
            }}
            options={yearOptions}
            placeholder="Select year..."
            style={{ flex: 1, minWidth: '160px' }}
          />
          <div className="me-exam-group">
            <select
              className="input"
              value={selectedExam}
              onChange={e => {
                if (!confirmLoseMarksDraft()) return
                setSelectedExam(e.target.value)
                setView('entry')
                setGridData(null)
                setSubjectFilter('all')
                setDirty(false)
              }}
              style={{ flex: 1 }}
            >
              <option value="">Select exam...</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            {!isTeacher && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowNewExam(s => !s)}
                disabled={!selectedClass || isClosedYear}
                title="Create new exam"
              >
                + New
              </button>
            )}
          </div>
        </FilterRow>
      </div>

      {/* New exam form */}
      {!isTeacher && showNewExam && selectedClass && (
        <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--brand-700)', marginBottom: '12px' }}>
            Create New Exam
          </div>
          <div className="me-newexam-row">
            <div className="me-newexam-type">
              <label className="label">Exam Type</label>
              <input
                className="input"
                list="me-exam-type-options"
                value={newExam.name}
                onChange={e => setNewExam(n => ({ ...n, name: e.target.value }))}
                placeholder="Type exam name (e.g., Unit Test 1)"
              />
              <datalist id="me-exam-type-options">
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </datalist>
            </div>
            <div className="me-newexam-date">
              <label className="label">Date (optional)</label>
              <input type="date" className="input" value={newExam.exam_date} onChange={e => setNewExam(n => ({ ...n, exam_date: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={handleCreateExam} disabled={creatingExam || !newExam.name.trim() || isClosedYear}>
              {creatingExam ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Creating…</> : 'Create Exam'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowNewExam(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* No class selected — prompt */}
      {!selectedClass && (
        <div className="card">
          {!selectedYear ? (
            <ScreenState type="no-year" />
          ) : isTeacher && classes.length === 0 ? (
            <EmptyState
              icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              title="No subject assignments"
              description="Ask an admin to assign you to subjects before entering marks"
            />
          ) : classes.length === 0 ? (
            <OnboardingEmptyState type="noClasses" />
          ) : (
            <EmptyState
              icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              title="Select a class to begin"
              description="Choose a class and academic year from the filters above"
            />
          )}
        </div>
      )}

      {/* Main content — class selected */}
      {selectedClass && (
        <>
          <div className="me-context-strip">
            <EntryStat
              label="Class"
              value={selectedClassLabel}
              note={selectedYearMeta?.label || 'Academic year not selected'}
            />
            <EntryStat
              label="Exam"
              value={selectedExam ? examName : 'No exam selected'}
              note={selectedExam ? `${exams.length} exam${exams.length !== 1 ? 's' : ''} available` : 'Create or select an exam'}
            />
            <EntryStat
              label="Entry progress"
              value={gridData ? `${entryStats.completion}%` : '--'}
              note={gridData ? `${entryStats.filled}/${entryStats.editable} editable cells filled` : 'Load a grid to track progress'}
            />
            <EntryStat
              label="Review"
              value={gridData ? `${entryStats.invalid}` : '--'}
              note={gridData ? `${entryStats.absent} absent, ${entryStats.locked} locked or view-only` : 'Out-of-range marks appear here'}
            />
          </div>

          {/* Tab bar + contextual actions */}
          <div className="me-tab-wrapper">
            <TabBar
              tabs={mainTabs}
              active={view}
              onChange={v => {
                if (v !== 'entry' && !confirmLoseMarksDraft()) return
                if (v === 'results') { handleViewResults(); return }
                if (v === 'entry' && selectedExam) loadGrid()
                setView(v)
              }}
            />

            {view === 'entry' && hasStudents && (
              <div className="me-action-group">
                {hasCustomConfig && (
                  <span style={{
                    fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px',
                    background: 'var(--brand-100)', color: 'var(--brand-700)',
                    border: '1px solid var(--brand-200)',
                  }}>
                    Custom marks active
                  </span>
                )}
                {saved && (
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--success-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || isClosedYear || !dirty}>
                  {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save All Marks'}
                </button>
              </div>
            )}

            {view === 'results' && selectedExam && (
              <div className="me-action-group">
                <button
                  onClick={() => openSignedPdf('/pdf/token/report/results', '/pdf/report/results', { exam_id: selectedExam, class_id: selectedClass })}
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none', fontSize: '12.5px' }}
                >
                  Class Result PDF
                </button>
                <button
                  onClick={() => openSignedPdf(`/pdf/token/marksheet/class/${selectedClass}`, `/pdf/marksheet/class/${selectedClass}`, { exam_id: selectedExam })}
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none', fontSize: '12.5px' }}
                >
                  Marksheets PDF
                </button>
              </div>
            )}
          </div>

          {/* ── TAB: Subjects Manager ── */}
          {view === 'subjects' && (
            <SubjectManager
              classId={selectedClass}
              onSubjectsChanged={() => {
                if (selectedExam) loadGrid()
              }}
            />
          )}

          {/* ── TAB: Exam Config ── */}
          {view === 'examconfig' && selectedExam && (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Max Marks Setup — {examName}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  Customise the maximum marks for each subject specifically for this exam.
                  These overrides are used in grading, results, and marksheet PDFs.
                </div>
              </div>
              <ExamConfigPanel
                examId={parseInt(selectedExam)}
                classId={parseInt(selectedClass)}
                onConfigSaved={() => {
                  loadGrid()
                }}
              />
            </div>
          )}

          {view === 'examconfig' && !selectedExam && (
            <InlineBanner
              type="warning"
              title="No exam selected"
              message="Select an exam from the filter above to configure its max marks."
            />
          )}

          {/* ── TAB: Marks Entry ── */}
          {view === 'entry' && (
            <>
              {!selectedExam ? (
                <div className="card">
                  <EmptyState
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    title="Select an exam to enter marks"
                    description="Choose or create an exam using the filters above"
                  />
                </div>
              ) : (
                <div className="card">
                  {loadingGrid ? (
                    <table className="data-table"><TableSkeleton rows={8} cols={6} /></table>
                  ) : !hasSubjects ? (
                    <div style={{ padding: '20px' }}>
                      <InlineBanner
                        type="warning"
                        title="No subjects found for this class"
                        message="Go to the Subjects tab to add subjects or load GSEB defaults."
                      />
                    </div>
                  ) : !hasStudents ? (
                    <EmptyState
                      icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                      title={`No students enrolled in ${classes.find(c => String(c.id) === selectedClass)?.name || 'this class'}`}
                      description={isTeacher
                        ? 'No enrolled students found. Contact your admin so students can be assigned to this class.'
                        : 'This class has no active students. Add students via Students, then return here to enter marks.'}
                      action={!isTeacher && <Link to="/students/new" className="btn btn-primary btn-sm">Add Students</Link>}
                    />
                  ) : (
                    <>
                      <div className="me-info-bar">
                        <span className="me-info-chip"><strong>T</strong> Theory</span>
                        <span className="me-info-chip"><strong>P</strong> Practical</span>
                        <span className="me-info-chip"><strong>Abs</strong> Mark absent</span>
                        <span className={`me-info-chip ${dirty ? 'warning' : 'success'}`}>
                          {dirty ? `Draft autosaved${draftSavedAt ? ` ${new Date(draftSavedAt).toLocaleTimeString()}` : ''}` : 'Saved data loaded'}
                        </span>
                        {hasCustomConfig && (
                          <span className="me-info-chip brand">
                            Custom max marks active for this exam
                          </span>
                        )}
                        {entryStats.invalid > 0 && (
                          <span className="me-info-chip warning">{entryStats.invalid} mark{entryStats.invalid !== 1 ? 's' : ''} need review</span>
                        )}
                        <label className="me-subject-focus">
                          <span>Subject focus</span>
                          <select className="input" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                            <option value="all">All subjects</option>
                            {gridData.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                          </select>
                        </label>
                        {subjectFilter === 'all' && <span className="me-info-chip warning">Scroll right for all subjects</span>}
                      </div>
                      {isCompactMarksLayout && (
                        <div className="me-mobile-card-list">
                          {gridData.students.map(student => (
                            <StudentMarksCard
                              key={student.student_id}
                              student={student}
                              subjects={visibleSubjects}
                              marks={localMarks[student.student_id] || {}}
                              onChange={handleMarkChange}
                              canEditSubject={canEditSubject}
                            />
                          ))}
                        </div>
                      )}
                      {!isCompactMarksLayout && (
                        <div
                          className="me-grid-scroll me-entry-table"
                          ref={marksGridRef}
                          onScroll={handleGridScroll}
                        >
                          <table className="me-marks-table">
                            <thead>
                              <tr>
                                <th className="me-sticky-student" style={{
                                  padding: '11px 14px',
                                  textAlign: 'left',
                                  fontSize: '11px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                  color: 'var(--text-secondary)',
                                  minWidth: '190px',
                                }}>
                                  Student
                                </th>
                                <th className="me-sticky-roll" style={{
                                  padding: '11px 10px',
                                  fontWeight: 800,
                                  fontSize: '11px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                  color: 'var(--text-secondary)',
                                  width: '58px',
                                }}>Roll</th>
                                {visibleSubjects.map(sub => (
                                  <th
                                    key={sub.id}
                                    className={`me-subject-head ${sub.max_practical > 0 ? 'has-practical' : ''} ${sub.has_custom_config ? 'custom' : ''}`}
                                  >
                                    <div className="me-subject-name">
                                      {sub.name}
                                      {sub.has_custom_config && (
                                        <span title="Custom marks for this exam" style={{ fontSize: '10px', fontWeight: 800 }}>C</span>
                                      )}
                                    </div>
                                    <div className="me-subject-max">
                                      T/{sub.max_theory}{sub.max_practical > 0 ? ` · P/${sub.max_practical}` : ''}
                                      {sub.has_custom_config && (
                                        <span style={{ marginLeft: '3px' }}>(custom)</span>
                                      )}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {virtualRows.topPadding > 0 && (
                                <tr aria-hidden="true">
                                  <td colSpan={visibleSubjects.length + 2} style={{ height: virtualRows.topPadding, padding: 0, border: 0 }} />
                                </tr>
                              )}
                              {virtualRows.rows.map(({ student, index }) => (
                                <MarksGridRow
                                  key={student.student_id}
                                  student={student}
                                  subjects={visibleSubjects}
                                  marks={localMarks[student.student_id] || {}}
                                  rowIndex={index}
                                  onChange={handleMarkChange}
                                  canEditSubject={canEditSubject}
                                />
                              ))}
                              {virtualRows.bottomPadding > 0 && (
                                <tr aria-hidden="true">
                                  <td colSpan={visibleSubjects.length + 2} style={{ height: virtualRows.bottomPadding, padding: 0, border: 0 }} />
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="me-grid-footer">
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                          {gridData.students.length} student{gridData.students.length !== 1 ? 's' : ''} · {visibleSubjects.length} of {gridData.subjects.length} subject{gridData.subjects.length !== 1 ? 's' : ''}
                        </span>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || isClosedYear || !dirty}>
                          {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save All Marks'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── TAB: Results ── */}
          {view === 'results' && (
            <div className="card" style={{ overflowX: 'auto' }}>
              {loadingResults ? (
                <table className="data-table"><TableSkeleton rows={6} cols={8} /></table>
              ) : results.length === 0 ? (
                <EmptyState
                  icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  title="No results yet"
                  description="Save marks in the Entry tab to generate results"
                />
              ) : (
                <table className="data-table" style={{ minWidth: '760px' }}>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Student</th>
                      <th>Roll</th>
                      <th>Total</th>
                      <th style={{ textAlign: 'center' }}>%</th>
                      <th style={{ textAlign: 'center' }}>CGPA</th>
                      <th style={{ textAlign: 'center' }}>Grade</th>
                      <th style={{ textAlign: 'center' }}>Result</th>
                      <th style={{ textAlign: 'center' }}>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.student_id}>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '22px', borderRadius: '6px',
                            fontSize: '11px', fontWeight: 800,
                            background: r.class_rank === 1 ? '#fef3c7' : r.class_rank <= 3 ? 'var(--gray-100)' : 'transparent',
                            color: r.class_rank === 1 ? '#b45309' : 'var(--text-secondary)',
                          }}>
                            #{r.class_rank}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.student_name}</td>
                        <td style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{r.roll_number || '—'}</td>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {Math.round(r.total_marks)}/{Math.round(r.max_marks)}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--brand-600)' }}>
                          {Number(r.percentage).toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.cgpa}</td>
                        <td style={{ textAlign: 'center' }}><GradeBadge grade={r.grade} /></td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11.5px', fontWeight: 800,
                            padding: '3px 9px', borderRadius: '20px',
                            background: r.result === 'PASS' ? 'var(--success-100)' : 'var(--danger-100)',
                            color: r.result === 'PASS' ? 'var(--success-700)' : 'var(--danger-700)',
                          }}>
                            {r.result}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => openSignedPdf(
                              `/pdf/token/marksheet/student/${r.student_id}`,
                              `/pdf/marksheet/student/${r.student_id}`,
                              { exam_id: selectedExam, class_id: selectedClass },
                            )}
                            style={{ fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)', textDecoration: 'none' }}
                          >
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
