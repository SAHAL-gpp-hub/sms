// Attendance.jsx — Redesigned with better status toggle UX
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { setupAPI, attendanceAPI, extractError } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton, TabBar } from '../../components/UI'

const STATUS_OPTIONS = [
  { value: 'P',  label: 'Present', short: 'P',  color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  { value: 'A',  label: 'Absent',  short: 'A',  color: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
  { value: 'L',  label: 'Late',    short: 'L',  color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  { value: 'OL', label: 'On Leave',short: 'OL', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
]

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function StatusToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {STATUS_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.label}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: `1.5px solid ${value === opt.value ? opt.color : 'var(--border-default)'}`,
            background: value === opt.value ? opt.bg : 'var(--surface-0)',
            color: value === opt.value ? opt.color : 'var(--text-tertiary)',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.12s',
            fontFamily: 'var(--font-sans)',
            transform: value === opt.value ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          {opt.short}
        </button>
      ))}
    </div>
  )
}

function AttendanceSummaryBar({ statuses }) {
  const total   = Object.keys(statuses).length
  const present = Object.values(statuses).filter(s => s === 'P').length
  const absent  = Object.values(statuses).filter(s => s === 'A').length
  const late    = Object.values(statuses).filter(s => s === 'L').length
  const onLeave = Object.values(statuses).filter(s => s === 'OL').length
  if (total === 0) return null
  const pct = total > 0 ? Math.round((present / total) * 100) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
      {[
        { label: 'Present', count: present, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
        { label: 'Absent',  count: absent,  color: '#dc2626', bg: '#fff1f2', border: '#fecaca' },
        { label: 'Late',    count: late,    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        { label: 'On Leave',count: onLeave, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
      ].map(s => (
        <div key={s.label} style={{
          background: s.bg, border: `1px solid ${s.border}`,
          borderRadius: '10px', padding: '12px 14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.count}</div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: s.color, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Attendance() {
  const [classes, setClasses]         = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate]   = useState(new Date().toISOString().split('T')[0])
  const [roster, setRoster]           = useState([])
  const [statuses, setStatuses]       = useState({})
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [view, setView]               = useState('daily')
  const [monthlySummary, setMonthlySummary] = useState([])
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [monthYear, setMonthYear]     = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
  }, [])

  useEffect(() => {
    if (selectedClass && selectedDate && view === 'daily') {
      fetchDailyAttendance()
    }
  }, [selectedClass, selectedDate])

  useEffect(() => {
    if (view === 'monthly' && selectedClass) fetchMonthlySummary()
  }, [view, selectedClass, monthYear])

  const fetchDailyAttendance = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const r = await attendanceAPI.getDaily(selectedClass, selectedDate)
      setRoster(r.data)
      const map = {}
      r.data.forEach(s => { map[s.student_id] = s.status || 'P' })
      setStatuses(map)
    } catch {
      toast.error('Failed to load attendance roster')
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlySummary = async () => {
    if (!selectedClass) return
    setLoadingMonthly(true)
    try {
      const r = await attendanceAPI.getMonthlySummary(
        selectedClass, monthYear.year, monthYear.month
      )
      setMonthlySummary(r.data)
    } catch {
      toast.error('Failed to load monthly summary')
    } finally {
      setLoadingMonthly(false)
    }
  }

  const handleStatusChange = (studentId, status) => {
    setStatuses(prev => ({ ...prev, [studentId]: status }))
    setSaved(false)
  }

  const handleMarkAll = (status) => {
    const map = {}
    roster.forEach(s => { map[s.student_id] = status })
    setStatuses(map)
    setSaved(false)
    toast(`All students marked as ${STATUS_OPTIONS.find(o => o.value === status)?.label}`, { icon: '✓' })
  }

  const handleSave = async () => {
    if (roster.length === 0) return
    setSaving(true)
    try {
      const entries = roster.map(s => ({
        student_id: s.student_id,
        class_id:   parseInt(selectedClass),
        date:       selectedDate,
        status:     statuses[s.student_id] || 'P',
      }))
      await attendanceAPI.markBulk(entries)
      setSaved(true)
      toast.success(`Attendance saved for ${entries.length} students`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))

  const displayDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Mark daily attendance and view monthly reports"
      />

      {/* Filters */}
      <FilterRow>
        <Select
          value={selectedClass}
          onChange={e => { setSelectedClass(e.target.value); setRoster([]); setStatuses({}) }}
          options={classOptions}
          placeholder="Select class…"
          style={{ flex: 1, minWidth: '200px' }}
        />
        {view === 'daily' ? (
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label className="label" style={{ marginBottom: '6px' }}>Date</label>
            <input
              type="date"
              className="input"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <div>
              <label className="label" style={{ marginBottom: '6px' }}>Month</label>
              <select className="input" value={monthYear.month} onChange={e => setMonthYear(m => ({ ...m, month: parseInt(e.target.value) }))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ marginBottom: '6px' }}>Year</label>
              <select className="input" value={monthYear.year} onChange={e => setMonthYear(m => ({ ...m, year: parseInt(e.target.value) }))}>
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
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
            onChange={v => { setView(v); setSaved(false) }}
          />
        </div>
      </FilterRow>

      {/* Daily View */}
      {view === 'daily' && selectedClass && (
        <>
          {roster.length > 0 && <AttendanceSummaryBar statuses={statuses} />}

          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div className="card-title">
                  {displayDate || 'Attendance Roster'}
                </div>
                {roster.length > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    {roster.length} student{roster.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Mark all:</span>
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleMarkAll(opt.value)}
                    disabled={roster.length === 0}
                    style={{
                      padding: '5px 12px', borderRadius: '7px',
                      border: `1.5px solid ${opt.border}`,
                      background: opt.bg, color: opt.color,
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
                      opacity: roster.length === 0 ? 0.5 : 1,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                <div style={{ width: '1px', height: '24px', background: 'var(--border-default)', margin: '0 4px' }} />
                {saved && (
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--success-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || roster.length === 0}
                >
                  {saving
                    ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</>
                    : 'Save Attendance'
                  }
                </button>
              </div>
            </div>

            {loading ? (
              <table className="data-table"><TableSkeleton rows={10} cols={3} /></table>
            ) : roster.length === 0 ? (
              <EmptyState
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                title="No students found in this class"
                description="Add students to this class to mark attendance"
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Roll</th>
                    <th>Student Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(student => (
                    <tr key={student.student_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        {student.roll_number || '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {student.student_name}
                      </td>
                      <td>
                        <StatusToggle
                          value={statuses[student.student_id] || 'P'}
                          onChange={status => handleStatusChange(student.student_id, status)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Monthly View */}
      {view === 'monthly' && selectedClass && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                {MONTHS[monthYear.month - 1]} {monthYear.year} — Monthly Summary
              </div>
              {monthlySummary.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  {monthlySummary.filter(s => s.low_attendance).length} students below 75%
                </div>
              )}
            </div>
            {selectedClass && (
              <a
                href={`/api/v1/pdf/report/attendance?class_id=${selectedClass}&year=${monthYear.year}&month=${monthYear.month}`}
                target="_blank" rel="noreferrer"
                className="btn btn-secondary"
                style={{ textDecoration: 'none', fontSize: '12.5px' }}
              >
                📄 Download PDF Report
              </a>
            )}
          </div>

          {loadingMonthly ? (
            <table className="data-table"><TableSkeleton rows={8} cols={8} /></table>
          ) : monthlySummary.length === 0 ? (
            <EmptyState
              icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              title="No attendance records for this month"
              description="Switch to Daily view to mark attendance"
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th style={{ textAlign: 'center' }}>Working Days</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'center' }}>Late</th>
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
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        {s.roll_number || '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {s.student_name}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{s.total_working_days}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{s.days_present}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>{s.days_absent}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#d97706' }}>{s.days_late}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <div style={{ width: '36px', height: '5px', background: 'var(--gray-100)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: isLow ? 'var(--danger-500)' : 'var(--success-500)', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontWeight: 800, color: isLow ? 'var(--danger-600)' : 'var(--success-700)', fontSize: '13px', minWidth: '38px' }}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isLow ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--danger-100)', color: 'var(--danger-700)' }}>
                            ⚠ Low
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--success-100)', color: 'var(--success-700)' }}>
                            ✓ Good
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!selectedClass && (
        <div className="card">
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            title="Select a class to begin"
            description="Choose a class from the dropdown above to mark or view attendance"
          />
        </div>
      )}
    </div>
  )
}
