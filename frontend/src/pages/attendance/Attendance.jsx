// Attendance.jsx — Fully responsive with mobile-optimized status toggles
import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { setupAPI, attendanceAPI, extractError, openSignedPdf } from '../../services/api'
import { getAuthUser } from '../../services/auth'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton, TabBar } from '../../components/UI'

const STATUS_OPTIONS = [
  { value: 'UNMARKED', label: 'Unmarked', short: '—', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
  { value: 'P',  label: 'Present', short: 'P',  color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  { value: 'A',  label: 'Absent',  short: 'A',  color: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
  { value: 'L',  label: 'Late',    short: 'L',  color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  { value: 'OL', label: 'Leave',   short: 'OL', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
]

const MARKABLE_STATUS_OPTIONS = STATUS_OPTIONS.filter(o => o.value !== 'UNMARKED')

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function StatusToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
      {MARKABLE_STATUS_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.label}
          aria-pressed={value === opt.value}
          style={{
            minWidth: '64px',
            minHeight: '36px',
            padding: '4px 8px',
            borderRadius: '7px',
            border: `1.5px solid ${value === opt.value ? opt.color : 'var(--border-default)'}`,
            background: value === opt.value ? opt.bg : 'var(--surface-0)',
            color: value === opt.value ? opt.color : 'var(--text-tertiary)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.12s',
            fontFamily: 'var(--font-sans)',
            touchAction: 'manipulation',
            transform: value === opt.value ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          <span className="attendance-status-short">{opt.short}</span>
          <span className="attendance-status-label">{opt.label}</span>
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
        { label: 'Late',    count: late,    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        { label: 'Leave',   count: onLeave, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
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
  const authUser = useMemo(() => getAuthUser(), [])
  const isTeacher = authUser?.role === 'teacher'
  const classTeacherClassIds = useMemo(() => authUser?.classTeacherClassIds || [], [authUser])
  const [classes, setClasses]               = useState([])
  const [selectedClass, setSelectedClass]   = useState('')
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().split('T')[0])
  const [roster, setRoster]                 = useState([])
  const [statuses, setStatuses]             = useState({})
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [dirty, setDirty]                   = useState(false)
  const [view, setView]                     = useState('daily')
  const [monthlySummary, setMonthlySummary] = useState([])
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [monthYear, setMonthYear] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })

  const fetchDailyAttendance = useCallback(async () => {
    setLoading(true)
    setSaved(false)
    setDirty(false)
    try {
      const r = await attendanceAPI.getDaily(selectedClass, selectedDate)
      setRoster(r.data)
      const map = {}
      r.data.forEach(s => { map[s.student_id] = s.status || 'UNMARKED' })
      setStatuses(map)
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
    setupAPI.getClasses().then(r => {
      const allClasses = r.data || []
      setClasses(
        isTeacher
          ? allClasses.filter(c => classTeacherClassIds.includes(c.id))
          : allClasses
      )
    })
  }, [classTeacherClassIds, isTeacher])

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
    setStatuses(prev => ({ ...prev, [studentId]: status }))
    setSaved(false)
    setDirty(true)
  }

  const handleMarkAll = (status) => {
    const label = STATUS_OPTIONS.find(o => o.value === status)?.label
    if (!window.confirm(`Mark all ${roster.length} students as ${label}? This will replace the current marks on this screen.`)) return
    const map = {}
    roster.forEach(s => { map[s.student_id] = status })
    setStatuses(map)
    setSaved(false)
    setDirty(true)
    toast(`All marked as ${label}`)
  }

  const handleMarkRemainingPresent = () => {
    const unmarkedCount = roster.filter(s => !statuses[s.student_id] || statuses[s.student_id] === 'UNMARKED').length
    if (unmarkedCount === 0) return
    if (!window.confirm(`Mark the remaining ${unmarkedCount} unmarked student${unmarkedCount !== 1 ? 's' : ''} as Present?`)) return
    const map = { ...statuses }
    roster.forEach(s => {
      if (!map[s.student_id] || map[s.student_id] === 'UNMARKED') map[s.student_id] = 'P'
    })
    setStatuses(map)
    setSaved(false)
    setDirty(true)
  }

  const handleSave = async () => {
    if (roster.length === 0) return
    const unmarked = roster.filter(s => !statuses[s.student_id] || statuses[s.student_id] === 'UNMARKED')
    if (unmarked.length > 0) {
      toast.error(`${unmarked.length} student${unmarked.length !== 1 ? 's are' : ' is'} still unmarked`)
      return
    }
    setSaving(true)
    try {
      const entries = roster.map(s => ({
        student_id: s.student_id,
        class_id:   parseInt(selectedClass),
        date:       selectedDate,
        status:     statuses[s.student_id],
      }))
      await attendanceAPI.markBulk(entries)
      setSaved(true)
      setDirty(false)
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
  const canSave = roster.length > 0 && unmarkedCount === 0

  const confirmDiscard = () => !dirty || window.confirm('You have unsaved attendance changes. Discard them?')
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
                  {MARKABLE_STATUS_OPTIONS.map(opt => (
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
                  {unmarkedCount > 0 && (
                    <button type="button" className="btn btn-secondary" onClick={handleMarkRemainingPresent}>
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
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave} style={{ whiteSpace: 'nowrap' }}>
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
                            value={statuses[student.student_id] || 'UNMARKED'}
                            onChange={status => handleStatusChange(student.student_id, status)}
                          />
                          {(!statuses[student.student_id] || statuses[student.student_id] === 'UNMARKED') && (
                            <div style={{ marginTop: '5px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Unmarked</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Save footer for long lists */}
            {roster.length > 5 && !loading && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                {unmarkedCount > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={handleMarkRemainingPresent}>
                    Mark remaining present ({unmarkedCount})
                  </button>
                )}
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave}>
                  {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save Attendance'}
                </button>
              </div>
            )}
          </div>
          {roster.length > 0 && !loading && (
            <div style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 20,
              marginTop: '12px',
              padding: '10px',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.96)',
              boxShadow: '0 -8px 24px rgba(15,23,42,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}>
              <strong style={{ color: unmarkedCount ? 'var(--danger-600)' : 'var(--success-700)' }}>
                {unmarkedCount ? `${unmarkedCount} unmarked` : 'Ready to save'}
              </strong>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave}>
                {saving ? 'Saving…' : 'Save Attendance'}
              </button>
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
