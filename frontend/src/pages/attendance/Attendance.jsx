// Attendance.jsx — Fully responsive with mobile-optimized status toggles
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { setupAPI, attendanceAPI, extractError, openSignedPdf } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton, TabBar, ReadonlyBanner, ScreenState } from '../../components/UI'
import { useAcademicYear } from '../../contexts/academicYearContext'
import { useRoleContext } from '../../hooks/useRoleContext'

const STATUS_OPTIONS = [
  { value: 'UNMARKED', label: 'Unmarked', short: '—', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
  { value: 'P',  label: 'Present', short: 'P',  color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  { value: 'A',  label: 'Absent',  short: 'A',  color: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
]

const MARKABLE_STATUS_OPTIONS = STATUS_OPTIONS.filter(
  o => o.value === 'P' || o.value === 'A'
)

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function StatusToggle({ value, onChange, disabled = false }) {
  return (
    <div className="status-toggle-group">
      {MARKABLE_STATUS_OPTIONS.map(opt => (
        <button
          className="status-btn"
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          title={opt.label}
          aria-pressed={value === opt.value}
          style={{
            minWidth: '76px',
            minHeight: '42px',
            padding: '7px 10px',
            borderRadius: '8px',
            border: `1.5px solid ${value === opt.value ? opt.color : 'var(--border-default)'}`,
            background: value === opt.value ? opt.bg : 'var(--surface-0)',
            color: value === opt.value ? opt.color : 'var(--text-tertiary)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.12s',
            fontFamily: 'var(--font-sans)',
            touchAction: 'manipulation',
            transform: value === opt.value ? 'scale(1.08)' : 'scale(1)',
            opacity: disabled ? 0.65 : 1,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            alignItems: 'center',
            columnGap: '5px',
          }}
        >
          <span className="attendance-status-short">{opt.short}</span>
          <span className="attendance-status-label">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

function StatusBadge({ value }) {
  const opt = STATUS_OPTIONS.find(o => o.value === value) || STATUS_OPTIONS[0]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 12px', borderRadius: 8,
      background: opt.bg, border: `1.5px solid ${opt.border}`,
      color: opt.color, fontWeight: 700, fontSize: 13,
    }}>
      {opt.short} {opt.label}
    </span>
  )
}

function AttendanceSummaryBar({ statuses }) {
  const total    = Object.keys(statuses).length
  const present  = Object.values(statuses).filter(s => s === 'P').length
  const absent   = Object.values(statuses).filter(s => s === 'A').length
  const unmarked = Object.values(statuses).filter(s => !s || s === 'UNMARKED').length
  if (total === 0) return null

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
      gap: '8px',
      marginBottom: '14px',
    }}>
      {[
        { label: 'Present', count: present, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
        { label: 'Absent',  count: absent,  color: '#dc2626', bg: '#fff1f2', border: '#fecaca' },
        { label: 'Unmarked', count: unmarked, color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
      ].map(s => (
        <div key={s.label} style={{
          background: s.bg,
          border: `1px solid ${s.border}`,
          borderRadius: '10px',
          padding: '10px 8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.count}</div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: s.color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '3px' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Attendance() {
  const { selectedYearId, selectedYear, isClosedYear, loading: yearLoading } = useAcademicYear()
  const { isTeacher, classTeacherClassIds } = useRoleContext()
  const [classes, setClasses]               = useState([])
  const [selectedClass, setSelectedClass]   = useState('')
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().split('T')[0])
  const [roster, setRoster]                 = useState([])
  const [statuses, setStatuses]             = useState({})
  const [savedStatuses, setSavedStatuses]   = useState({})
  const [editMode, setEditMode]             = useState(false)
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [dirty, setDirty]                   = useState(false)
  const [view, setView]                     = useState('daily')
  const [monthlySummary, setMonthlySummary] = useState([])
  const [highlightUnmarked, setHighlightUnmarked] = useState(false)
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [monthYear, setMonthYear] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })

  const fetchDailyAttendance = useCallback(async () => {
    if (!selectedClass || !selectedDate) return
    setLoading(true)
    setSaved(false)
    setDirty(false)
    try {
      const r = await attendanceAPI.getDaily(selectedClass, selectedDate)
      setRoster(r.data)
      const map = {}
      r.data.forEach(s => { map[s.student_id] = s.status || 'UNMARKED' })
      setStatuses(map)
      setSavedStatuses(map)
      setEditMode(false)
      setHighlightUnmarked(false)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedDate])

  const fetchMonthlySummary = useCallback(async () => {
    if (!selectedClass) return
    setLoadingMonthly(true)
    try {
      const r = await attendanceAPI.getMonthlySummary(selectedClass, monthYear.year, monthYear.month)
      setMonthlySummary(r.data)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoadingMonthly(false)
    }
  }, [monthYear.month, monthYear.year, selectedClass])

  useEffect(() => {
    if (!selectedYearId) {
      setClasses([])
      setSelectedClass('')
      return
    }
    setupAPI.getClasses(selectedYearId).then(r => {
      const allClasses = r.data || []
      setClasses(
        isTeacher
          ? allClasses.filter(c => classTeacherClassIds.includes(c.id))
          : allClasses
      )
    })
  }, [classTeacherClassIds, isTeacher, selectedYearId])

  useEffect(() => {
    if (selectedClass && selectedDate && view === 'daily') fetchDailyAttendance()
  }, [fetchDailyAttendance, selectedClass, selectedDate, view])

  useEffect(() => {
    if (view === 'monthly' && selectedClass) fetchMonthlySummary()
  }, [fetchMonthlySummary, selectedClass, view])

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const handleStatusChange = (studentId, status) => {
    if (!editMode || isClosedYear) return
    setStatuses(prev => ({ ...prev, [studentId]: status }))
    setHighlightUnmarked(false)
    setSaved(false)
    setDirty(true)
  }

  const handleMarkAll = (status) => {
    if (!editMode || isClosedYear) return
    const label = STATUS_OPTIONS.find(o => o.value === status)?.label
    const map = {}
    roster.forEach(s => { map[s.student_id] = status })
    setStatuses(map)
    setHighlightUnmarked(false)
    setSaved(false)
    setDirty(true)
    toast(`All marked as ${label}`)
  }

  const handleMarkRemainingPresent = () => {
    if (!editMode || isClosedYear) return
    const unmarkedCount = roster.filter(s => !statuses[s.student_id] || statuses[s.student_id] === 'UNMARKED').length
    if (unmarkedCount === 0) return
    const map = { ...statuses }
    roster.forEach(s => {
      if (!map[s.student_id] || map[s.student_id] === 'UNMARKED') map[s.student_id] = 'P'
    })
    setStatuses(map)
    setHighlightUnmarked(false)
    setSaved(false)
    setDirty(true)
  }

  const handleSave = async () => {
    if (isClosedYear) return
    if (roster.length === 0) return
    const unmarked = roster.filter(s => !statuses[s.student_id] || statuses[s.student_id] === 'UNMARKED')
    if (unmarked.length > 0) {
      setHighlightUnmarked(true)
      document.getElementById(`student-row-${unmarked[0].student_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSaving(true)
    try {
      const entries = roster.map(s => ({
        enrollment_id: s.enrollment_id,
        student_id: s.student_id,
        class_id:   parseInt(selectedClass),
        date:       selectedDate,
        status:     statuses[s.student_id],
      }))
      await attendanceAPI.markBulk(entries)
      setSaved(true)
      setDirty(false)
      setHighlightUnmarked(false)
      setSavedStatuses(statuses)
      setEditMode(false)
      toast.success(`Saved for ${entries.length} students`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i)
  const unmarkedCount = roster.filter(s => !statuses[s.student_id] || statuses[s.student_id] === 'UNMARKED').length
  const confirmDiscard = () => !dirty || window.confirm('You have unsaved attendance changes. Discard them?')
  const displayDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="attendance-page">
      <style>{`
        .attendance-page .filter-row-inner {
          align-items: end;
        }
        .attendance-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .attendance-bulk-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .attendance-mobile-rowhead {
          display: none;
        }
        .attendance-desktop-name {
          display: inline;
        }
        .attendance-status-toggle-cell {
          min-width: 200px;
          padding-top: 0;
          padding-bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .status-toggle-group {
          display: grid;
          grid-template-columns: repeat(2, minmax(80px, 1fr));
          gap: 10px;
          width: 100%;
          max-width: 200px;
          align-items: center;
          justify-content: center;
        }
        .status-btn {
          display: flex !important;
          width: 100%;
          box-sizing: border-box;
        }
        .attendance-status-short {
          display: inline-grid;
          place-items: center;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: rgba(255,255,255,0.72);
          font-size: 11px;
          line-height: 1;
        }
        .attendance-status-label {
          min-width: 0;
          line-height: 1.1;
        }
        .attendance-save-bar {
          position: sticky;
          bottom: 0;
          z-index: 20;
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px 10px 0 0;
          box-shadow: 0 -8px 24px rgba(15,23,42,0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .attendance-page .card {
          overflow-x: hidden;
          max-width: 100%;
        }
        .attendance-table-wrapper {
          overflow-x: auto;
          max-width: 100%;
        }
        .data-table.attendance-table td {
          padding-top: 18px;
          padding-bottom: 18px;
          vertical-align: middle;
        }
        .data-table.attendance-table tbody tr {
          border-bottom: 1px solid var(--border-subtle);
        }
        .data-table.attendance-table tbody tr:last-child {
          border-bottom: none;
        }
        @media (max-width: 900px) {
          .attendance-actions {
            justify-content: flex-start;
            width: 100%;
          }
          .attendance-status-toggle-cell {
            min-width: 0;
          }
          .status-toggle-group {
            width: 100%;
          }
        }
        @media (max-width: 640px) {
          .attendance-page .filter-row-inner > * {
            min-width: 100% !important;
            width: 100%;
          }
          .attendance-actions > div,
          .attendance-actions .btn,
          .attendance-bulk-actions,
          .attendance-bulk-actions button {
            width: 100%;
          }
          .attendance-bulk-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .attendance-save-bar {
            align-items: stretch;
          }
          .attendance-save-bar > div,
          .attendance-save-bar .btn {
            width: 100%;
          }

          /* Card-style rows — no horizontal scroll */
          .attendance-table-wrapper {
            overflow-x: visible !important;
          }
          .data-table.attendance-table {
            min-width: 0 !important;
          }
          .data-table.attendance-table thead {
            display: none;
          }
          .data-table.attendance-table,
          .data-table.attendance-table tbody,
          .data-table.attendance-table tr,
          .data-table.attendance-table td {
            display: block;
            width: 100%;
          }
          .data-table.attendance-table tr {
            border: 1px solid var(--border-subtle);
            border-radius: 10px;
            margin: 0 0 10px 0;
            padding: 10px 12px;
            background: var(--surface-0);
          }
          .data-table.attendance-table tbody tr:last-child {
            border-bottom: 1px solid var(--border-subtle);
            margin-bottom: 0;
          }
          .data-table.attendance-table td {
            border: none;
            padding: 2px 0;
            text-align: left !important;
          }
          .attendance-mobile-rowhead {
            display: flex;
            align-items: baseline;
            justify-content: flex-start;
            gap: 8px;
            margin-bottom: 4px;
            text-align: left;
          }
          .attendance-mobile-sr {
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--text-tertiary);
            font-weight: 600;
          }
          .attendance-mobile-name {
            font-weight: 600;
            color: var(--text-primary);
            font-size: 14px;
            flex: 1;
          }
          .attendance-mobile-roll {
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--text-tertiary);
            font-weight: 600;
            white-space: nowrap;
          }
          .attendance-desktop-name {
            display: none;
          }
          .data-table.attendance-table td.attendance-cell-sr,
          .data-table.attendance-table td.attendance-cell-roll {
            display: none;
          }
          .data-table.attendance-table td.attendance-cell-student {
            text-align: left !important;
          }

          .attendance-status-toggle-cell {
            min-width: 0;
            margin-top: 6px;
            align-items: stretch;
          }
          .status-toggle-group {
            max-width: 100%;
            gap: 8px;
          }
          .status-btn {
            min-height: 44px;
            font-size: 13px;
            min-width: 0 !important;
            padding: 6px 6px !important;
          }
          .attendance-status-label {
            display: inline;
          }
        }
        @keyframes unmarkedPulse {
          0%, 100% { box-shadow: inset 0 0 0 2px #dc2626; }
          50% { box-shadow: inset 0 0 0 4px #fecaca; }
        }
      `}</style>
      <PageHeader
        title="Attendance"
        subtitle={selectedYear?.label ? `Mark daily attendance and view monthly reports for ${selectedYear.label}` : 'Mark daily attendance and view monthly reports'}
      />
      {isClosedYear && (
        <ReadonlyBanner
          yearLabel={selectedYear?.label}
          reason="This academic year is closed. Attendance can be reviewed, but editing and saving are disabled."
        />
      )}

      {/* Filters */}
      <FilterRow>
        <Select
          value={selectedClass}
          onChange={e => {
            if (!confirmDiscard()) return
            setSelectedClass(e.target.value)
            setRoster([])
            setStatuses({})
            setDirty(false)
          }}
          options={classOptions}
          placeholder="Select class…"
          style={{ flex: 1, minWidth: '160px' }}
        />
        <div style={{ flex: 1, minWidth: '140px', display: view === 'daily' ? 'block' : 'none' }}>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={e => {
              if (!confirmDiscard()) return
              setSelectedDate(e.target.value)
            }}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
        {view === 'monthly' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '120px' }}>
              <label className="label">Month</label>
              <select className="input" value={monthYear.month} onChange={e => setMonthYear(m => ({ ...m, month: parseInt(e.target.value) }))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div style={{ minWidth: '90px' }}>
              <label className="label">Year</label>
              <select className="input" value={monthYear.year} onChange={e => setMonthYear(m => ({ ...m, year: parseInt(e.target.value) }))}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <TabBar
            tabs={[
              { value: 'daily',   label: 'Daily' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            active={view}
            onChange={v => {
              if (!confirmDiscard()) return
              setView(v)
              setSaved(false)
              setDirty(false)
            }}
          />
        </div>
      </FilterRow>

      {!selectedYearId && !yearLoading && (
        <div className="card"><ScreenState type="no-year" /></div>
      )}
      {selectedYearId && isTeacher && classes.length === 0 && !loading && (
        <div className="card">
          <ScreenState
            type="no-permission"
            title="No attendance assignment"
            description="Ask an admin to assign you as class teacher for this academic year."
          />
        </div>
      )}

      {/* Daily View */}
      {view === 'daily' && selectedClass && (
        <>
          {roster.length > 0 && <AttendanceSummaryBar statuses={statuses} />}

          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div className="card-title">{displayDate || 'Attendance Roster'}</div>
                {roster.length > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    {roster.length} student{roster.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <div className="attendance-actions">
                {!isClosedYear && !editMode && roster.length > 0 && (
                  <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                    Edit Attendance
                  </button>
                )}
                {!isClosedYear && editMode && roster.length > 0 && (
                  <button className="btn btn-secondary" onClick={() => {
                    setStatuses(savedStatuses)
                    setDirty(false)
                    setEditMode(false)
                  }}>
                    Cancel
                  </button>
                )}
                {editMode && (
                  <>
                    {/* Mark all buttons */}
                    <div className="attendance-bulk-actions">
                      {MARKABLE_STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleMarkAll(opt.value)}
                          disabled={roster.length === 0 || isClosedYear}
                          style={{
                            padding: '5px 10px',
                            minHeight: '34px',
                            borderRadius: '7px',
                            border: `1.5px solid ${opt.border}`,
                            background: opt.bg,
                            color: opt.color,
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: (roster.length === 0 || isClosedYear) ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-sans)',
                            opacity: (roster.length === 0 || isClosedYear) ? 0.5 : 1,
                            touchAction: 'manipulation',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          All {opt.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {unmarkedCount > 0 && (
                        <button type="button" className="btn btn-secondary" onClick={handleMarkRemainingPresent} disabled={isClosedYear}>
                          Mark remaining present ({unmarkedCount})
                        </button>
                      )}
                      {saved && (
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--success-600)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Saved
                        </span>
                      )}
                      <button className="btn btn-primary" onClick={handleSave} disabled={saving || roster.length === 0 || isClosedYear || !dirty} style={{ whiteSpace: 'nowrap' }}>
                        {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <table className="data-table"><TableSkeleton rows={8} cols={3} /></table>
            ) : roster.length === 0 ? (
              <EmptyState
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                title="No students in this class"
                description="Add students to mark attendance"
              />
            ) : (
              <div className="attendance-table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="data-table attendance-table" style={{ minWidth: '340px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '44px' }}>Sr.</th>
                      <th style={{ textAlign: 'center' }}>Student</th>
                      <th style={{ width: '90px' }}>Roll No.</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((student, index) => {
                      const isUnmarked = !statuses[student.student_id] || statuses[student.student_id] === 'UNMARKED'
                      return (
                        <tr
                          key={student.student_id}
                          id={`student-row-${student.student_id}`}
                          style={{
                            animation: highlightUnmarked && isUnmarked ? 'unmarkedPulse 1.1s ease-in-out infinite' : undefined,
                            background: highlightUnmarked && isUnmarked ? '#fff1f2' : undefined,
                          }}
                        >
                          <td className="attendance-cell-sr" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                            {index + 1}
                          </td>
                          <td className="attendance-cell-student" style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                            <div className="attendance-mobile-rowhead">
                              <span className="attendance-mobile-sr">{index + 1}.</span>
                              <span className="attendance-mobile-name">{student.student_name}</span>
                              <span className="attendance-mobile-roll">Roll {student.roll_number || '—'}</span>
                            </div>
                            <span className="attendance-desktop-name">{student.student_name}</span>
                          </td>
                          <td className="attendance-cell-roll" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                            {student.roll_number || '—'}
                          </td>
                          <td className="attendance-status-toggle-cell">
                            {editMode ? (
                              <StatusToggle
                                value={statuses[student.student_id] || 'UNMARKED'}
                                onChange={status => handleStatusChange(student.student_id, status)}
                                disabled={isClosedYear}
                              />
                            ) : (
                              <StatusBadge value={statuses[student.student_id] || 'UNMARKED'} />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Save footer for long lists */}
            {editMode && roster.length > 5 && !loading && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                {unmarkedCount > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={handleMarkRemainingPresent} disabled={isClosedYear}>
                    Mark remaining present ({unmarkedCount})
                  </button>
                )}
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || roster.length === 0 || isClosedYear || !dirty}>
                  {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save Attendance'}
                </button>
              </div>
            )}
          </div>
          {editMode && roster.length > 0 && !loading && (
            <div className="attendance-save-bar" style={{
              border: highlightUnmarked && unmarkedCount > 0 ? '1px solid #fecaca' : '1px solid var(--border-default)',
              background: highlightUnmarked && unmarkedCount > 0 ? '#fee2e2' : 'rgba(255,255,255,0.96)',
            }}>
              <strong style={{ color: unmarkedCount ? 'var(--danger-600)' : 'var(--success-700)' }}>
                {unmarkedCount ? `${unmarkedCount} student${unmarkedCount !== 1 ? 's' : ''} still unmarked` : 'Ready to save'}
              </strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {highlightUnmarked && unmarkedCount > 0 && (
                  <button className="btn btn-secondary" type="button" onClick={() => {
                    const next = roster.find(s => !statuses[s.student_id] || statuses[s.student_id] === 'UNMARKED')
                    if (next) document.getElementById(`student-row-${next.student_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}>
                    Next unmarked
                  </button>
                )}
                {unmarkedCount > 0 && (
                  <button className="btn btn-secondary" type="button" onClick={handleMarkRemainingPresent} disabled={isClosedYear}>
                    Mark all Present
                  </button>
                )}
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || roster.length === 0 || isClosedYear || !dirty}>
                  {saving ? 'Saving…' : 'Save Attendance'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Monthly View */}
      {view === 'monthly' && selectedClass && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-title">{MONTHS[monthYear.month - 1]} {monthYear.year} Summary</div>
              {monthlySummary.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  {monthlySummary.filter(s => s.low_attendance).length} students below 75%
                </div>
              )}
            </div>
            {selectedClass && (
              <button
                onClick={() => openSignedPdf('/pdf/token/report/attendance', '/pdf/report/attendance', {
                  class_id: selectedClass,
                  year: monthYear.year,
                  month: monthYear.month,
                })}
                className="btn btn-secondary"
                style={{ textDecoration: 'none', fontSize: '12.5px', whiteSpace: 'nowrap' }}
              >
                PDF Report
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {loadingMonthly ? (
              <table className="data-table"><TableSkeleton rows={8} cols={7} /></table>
            ) : monthlySummary.length === 0 ? (
              <EmptyState
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                title="No records for this month"
                description="Switch to Daily view to mark attendance"
              />
            ) : (
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Student</th>
                    <th style={{ textAlign: 'center' }}>Days</th>
                    <th style={{ textAlign: 'center' }}>Present</th>
                    <th style={{ textAlign: 'center' }}>Absent</th>
                    <th style={{ textAlign: 'center' }}>%</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map(s => {
                    const pct = s.percentage || 0
                    const isLow = s.low_attendance
                    return (
                      <tr key={s.student_id} style={{ background: isLow ? '#fff1f2' : undefined }}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.roll_number || '—'}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.student_name}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{s.total_working_days}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{s.days_present}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>{s.days_absent}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: isLow ? 'var(--danger-600)' : 'var(--success-700)', fontSize: '13px' }}>
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isLow ? (
                            <span className="badge badge-danger">Low</span>
                          ) : (
                            <span className="badge badge-success">Good</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!selectedClass && (
        <div className="card">
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            title={isTeacher && classes.length === 0 ? 'No class teacher assignment' : 'Select a class to begin'}
            description={isTeacher && classes.length === 0 ? 'Ask an admin to assign you as class teacher before marking attendance' : 'Choose a class from the dropdown above'}
          />
        </div>
      )}
    </div>
  )
}