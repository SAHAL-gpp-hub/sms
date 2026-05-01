// Attendance.jsx — Fully responsive with mobile-optimized status toggles
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { setupAPI, attendanceAPI, extractError } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton, TabBar } from '../../components/UI'

const STATUS_OPTIONS = [
  { value: 'P',  label: 'Present', short: 'P',  color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  { value: 'A',  label: 'Absent',  short: 'A',  color: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
  { value: 'L',  label: 'Late',    short: 'L',  color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  { value: 'OL', label: 'Leave',   short: 'OL', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
]

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function StatusToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
      {STATUS_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.label}
          style={{
            minWidth: '36px',
            minHeight: '36px',
            padding: '4px 8px',
            borderRadius: '7px',
            border: `1.5px solid ${value === opt.value ? opt.color : 'var(--border-default)'}`,
            background: value === opt.value ? opt.bg : 'var(--surface-0)',
            color: value === opt.value ? opt.color : 'var(--text-tertiary)',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.12s',
            fontFamily: 'var(--font-sans)',
            touchAction: 'manipulation',
            transform: value === opt.value ? 'scale(1.08)' : 'scale(1)',
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

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '8px',
      marginBottom: '14px',
    }}>
      {[
        { label: 'Present', count: present, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
        { label: 'Absent',  count: absent,  color: '#dc2626', bg: '#fff1f2', border: '#fecaca' },
        { label: 'Late',    count: late,    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        { label: 'Leave',   count: onLeave, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
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
  const [classes, setClasses]               = useState([])
  const [selectedClass, setSelectedClass]   = useState('')
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().split('T')[0])
  const [roster, setRoster]                 = useState([])
  const [statuses, setStatuses]             = useState({})
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [view, setView]                     = useState('daily')
  const [monthlySummary, setMonthlySummary] = useState([])
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [monthYear, setMonthYear] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
  }, [])

  useEffect(() => {
    if (selectedClass && selectedDate && view === 'daily') fetchDailyAttendance()
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
      toast.error('Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlySummary = async () => {
    if (!selectedClass) return
    setLoadingMonthly(true)
    try {
      const r = await attendanceAPI.getMonthlySummary(selectedClass, monthYear.year, monthYear.month)
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
    toast(`All marked as ${STATUS_OPTIONS.find(o => o.value === status)?.label}`, { icon: '✓' })
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
      toast.success(`Saved for ${entries.length} students`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const displayDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
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
          style={{ flex: 1, minWidth: '160px' }}
        />
        <div style={{ flex: 1, minWidth: '140px', display: view === 'daily' ? 'block' : 'none' }}>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
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
                <div className="card-title">{displayDate || 'Attendance Roster'}</div>
                {roster.length > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    {roster.length} student{roster.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Mark all buttons */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleMarkAll(opt.value)}
                      disabled={roster.length === 0}
                      style={{
                        padding: '5px 10px',
                        minHeight: '34px',
                        borderRadius: '7px',
                        border: `1.5px solid ${opt.border}`,
                        background: opt.bg,
                        color: opt.color,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        opacity: roster.length === 0 ? 0.5 : 1,
                        touchAction: 'manipulation',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      All {opt.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {saved && (
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--success-600)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </span>
                  )}
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving || roster.length === 0} style={{ whiteSpace: 'nowrap' }}>
                    {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save'}
                  </button>
                </div>
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
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="data-table" style={{ minWidth: '340px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>Roll</th>
                      <th>Student</th>
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
              </div>
            )}

            {/* Save footer for long lists */}
            {roster.length > 5 && !loading && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || roster.length === 0}>
                  {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save Attendance'}
                </button>
              </div>
            )}
          </div>
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
              <a
                href={`/api/v1/pdf/report/attendance?class_id=${selectedClass}&year=${monthYear.year}&month=${monthYear.month}`}
                target="_blank" rel="noreferrer"
                className="btn btn-secondary"
                style={{ textDecoration: 'none', fontSize: '12.5px', whiteSpace: 'nowrap' }}
              >
                📄 PDF Report
              </a>
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
                            <span className="badge badge-danger">⚠ Low</span>
                          ) : (
                            <span className="badge badge-success">✓ Good</span>
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
            title="Select a class to begin"
            description="Choose a class from the dropdown above"
          />
        </div>
      )}
    </div>
  )
}