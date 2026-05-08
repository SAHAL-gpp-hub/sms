// frontend/src/pages/portal/PortalAttendance.jsx
// Rebuilt with:
//   1. Calendar-aware working day count (backend now uses holiday calendar,
//      not hardcoded Sunday exclusion — the denominator is now correct)
//   2. Child-aware — parents see data for selectedChildId automatically
//   3. Monthly calendar heatmap with colour-coded day cells
//   4. Year-over-year navigation
//   5. Low attendance warning banner (< 75%)
//   6. Full monthly summary stats with progress bar

import { useState, useEffect } from 'react'
import { usePortalContext } from '../../layouts/portalContext'
import { portalAPI } from '../../services/api'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su']

const STATUS_META = {
  P:  { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: 'Present' },
  A:  { color: '#dc2626', bg: '#fee2e2', border: '#fecaca', label: 'Absent'  },
  L:  { color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'Late'    },
  OL: { color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe', label: 'Leave'   },
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar grid — colour-coded day cells
// ─────────────────────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, records }) {
  // Build a date → status map
  const recordMap = {}
  records.forEach(r => { if (r.date) recordMap[r.date] = r.status })

  const firstDay    = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  // Monday-first offset (0=Mon … 6=Sun)
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div>
      {/* Day headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 3, marginBottom: 5,
      }}>
        {DAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 800,
            color: '#94a3b8', padding: '3px 0',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const status  = recordMap[dateStr]
          const meta    = STATUS_META[status]
          const isToday = dateStr === todayStr

          return (
            <div
              key={dateStr}
              title={status ? `${STATUS_META[status]?.label}` : dateStr}
              style={{
                aspectRatio: '1/1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                minHeight: 32,
                background: meta
                  ? meta.bg
                  : isToday ? '#f0f7f7' : 'transparent',
                color: meta
                  ? meta.color
                  : isToday ? '#0d7377' : '#64748b',
                border: isToday && !meta
                  ? '1.5px solid #0d7377'
                  : meta
                    ? `1px solid ${meta.border}`
                    : '1px solid transparent',
                transition: 'transform 0.1s',
              }}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shimmer skeleton
// ─────────────────────────────────────────────────────────────────────────────
function Shimmer({ h = '80px', r = '14px' }) {
  return (
    <div style={{
      height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #f0f7f7 25%, #e0eded 50%, #f0f7f7 75%)',
      backgroundSize: '200% auto',
      animation: 'portalShimmer 1.5s linear infinite',
    }} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalAttendance() {
  const { role, profile, selectedChildId } = usePortalContext()
  const isParent = role === 'parent'

  const now = new Date()
  const [year,    setYear]    = useState(now.getFullYear())
  const [month,   setMonth]   = useState(now.getMonth() + 1)
  const [records, setRecords] = useState([])   // all records for this student
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  // ── Fetch attendance records ───────────────────────────────────────────────
  // The backend now returns daily records. Working-day denominator is computed
  // from the academic calendar (holiday-aware) — we just count P records here
  // and show percentage against the total records in that month (which already
  // excludes Sundays and holidays on the backend's attendance marking side).
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(false)
      setRecords([])
      setSummaries([])

      const targetStudentId = isParent ? selectedChildId : null
      if (!targetStudentId && isParent) {
        setLoading(false)
        return
      }

      try {
        const [attendanceRes, summaryRes] = await Promise.all([
          portalAPI.getAttendance(targetStudentId),
          portalAPI.getAttendanceSummary(targetStudentId),
        ])
        if (cancelled) return
        setRecords(attendanceRes.data || [])
        setSummaries(summaryRes.data || [])
        setLoading(false)
      } catch {
        if (cancelled) return
        setError(true)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isParent, selectedChildId])

  // ── Month navigation ───────────────────────────────────────────────────────
  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (isThisMonth) return
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // ── Filter records to this month ──────────────────────────────────────────
  const monthStr  = `${year}-${String(month).padStart(2, '0')}`
  const monthRecs = records.filter(r => r.date?.startsWith(monthStr))

  const present  = monthRecs.filter(r => r.status === 'P').length
  const absent   = monthRecs.filter(r => r.status === 'A').length
  const late     = monthRecs.filter(r => r.status === 'L').length
  const onLeave  = monthRecs.filter(r => r.status === 'OL').length
  const total    = monthRecs.length

  const monthSummary = summaries.find(s => s.year === year && s.month === month)
  const pct = monthSummary ? Number(monthSummary.percentage).toFixed(1) : null
  const isLow = pct !== null && parseFloat(pct) < 75

  // ── Overall (all-time) stats ───────────────────────────────────────────────
  const summaryWorkingDays = summaries.reduce((sum, s) => sum + Number(s.working_days || 0), 0)
  const summaryPresent = summaries.reduce((sum, s) => sum + Number(s.present || 0), 0)
  const allPct = summaryWorkingDays > 0 ? ((summaryPresent / summaryWorkingDays) * 100).toFixed(1) : null

  const displayName = profile?.name_en?.split(' ')[0] || (isParent ? 'Student' : 'Student')

  return (
    <>
      <style>{`
        @keyframes portalShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>

      {/* Page title */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Attendance
        </h2>
        <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
          {isParent && selectedChildId ? `${displayName}'s attendance` : 'Monthly calendar view'}
        </p>
      </div>

      {/* Parent — no child selected */}
      {isParent && !selectedChildId && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'white', borderRadius: 16 }}>
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}><svg width="40" height="40" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>Select a student</div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
            Tap the switch button in the header to choose a student
          </div>
        </div>
      )}

      {((!isParent) || (isParent && selectedChildId)) && (
        <>
          {/* ── Overall stats strip ── */}
          {!loading && allPct !== null && (
            <div style={{
              background: 'white', borderRadius: 14, padding: '12px 16px',
              marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* Donut-style ring */}
              <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
                <svg width="54" height="54" viewBox="0 0 54 54">
                  <circle cx="27" cy="27" r="22" fill="none" stroke="#f0f7f7" strokeWidth="6" />
                  <circle
                    cx="27" cy="27" r="22" fill="none"
                    stroke={parseFloat(allPct) >= 75 ? '#16a34a' : '#dc2626'}
                    strokeWidth="6"
                    strokeDasharray={`${(parseFloat(allPct) / 100) * 138.2} 138.2`}
                    strokeLinecap="round"
                    transform="rotate(-90 27 27)"
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900,
                  color: parseFloat(allPct) >= 75 ? '#16a34a' : '#dc2626',
                }}>
                  {allPct}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                  Overall Attendance
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                  {summaryPresent} present out of {summaryWorkingDays} working days
                </div>
                {parseFloat(allPct) < 75 && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c', marginTop: 4 }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{display:"inline",marginRight:"3px",verticalAlign:"middle"}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>Below 75% minimum
                  </div>
                )}
              </div>
            </div>
          )}
          {loading && <Shimmer h="78px" r="14px" />}

          {/* ── Calendar card ── */}
          <div style={{
            background: 'white', borderRadius: 16, padding: '14px 16px',
            marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            {/* Month navigator */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 14,
            }}>
              <button
                onClick={prevMonth}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  border: '1px solid #e2e8f0', background: 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#64748b', touchAction: 'manipulation',
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  {MONTHS[month - 1]} {year}
                </div>
                {!loading && pct !== null && (
                  <div style={{
                    fontSize: 13, fontWeight: 800, marginTop: 2,
                    color: isLow ? '#dc2626' : '#16a34a',
                  }}>
                    {pct}% this month
                  </div>
                )}
              </div>

              <button
                onClick={nextMonth}
                disabled={isThisMonth}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  border: '1px solid #e2e8f0', background: 'white',
                  cursor: isThisMonth ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isThisMonth ? '#cbd5e1' : '#64748b',
                  touchAction: 'manipulation',
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {loading ? (
              <Shimmer h="200px" r="10px" />
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
                Could not load attendance data
              </div>
            ) : (
              <CalendarGrid year={year} month={month} records={monthRecs} />
            )}
          </div>

          {/* ── Low attendance warning ── */}
          {!loading && isLow && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12,
              padding: '12px 14px', marginBottom: 12,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <svg width="18" height="18" fill="none" stroke="#b91c1c" viewBox="0 0 24 24" style={{flexShrink:0}} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c' }}>
                  Low attendance — {pct}%
                </div>
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 3, lineHeight: 1.5 }}>
                  Minimum required is 75%. Please contact the school if there is a valid reason for absences.
                </div>
              </div>
            </div>
          )}

          {/* ── Monthly summary stats ── */}
          <div style={{
            background: 'white', borderRadius: 16, padding: '14px 16px',
            marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              fontSize: 10.5, fontWeight: 800, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
            }}>
              {MONTHS[month - 1]} Summary
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4].map(i => <Shimmer key={i} h="44px" r="10px" />)}
              </div>
            ) : !monthSummary && total === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                No attendance records for {MONTHS[month - 1]}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    { key: 'P',  label: 'Present', count: present  },
                    { key: 'A',  label: 'Absent',  count: absent   },
                    { key: 'L',  label: 'Late',    count: late     },
                    { key: 'OL', label: 'Leave',   count: onLeave  },
                  ].map(s => {
                    const meta = STATUS_META[s.key]
                    return (
                      <div key={s.key} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: `${meta.bg}55`,
                        border: `1px solid ${meta.border}`,
                      }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: meta.color, flexShrink: 0,
                        }} />
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {s.label}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                            {s.count}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Progress bar */}
                {pct !== null && (
                  <div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5,
                    }}>
                      <span>{monthSummary?.present ?? present} present of {monthSummary?.working_days ?? total} working days</span>
                      <span style={{ color: isLow ? '#dc2626' : '#16a34a' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        transition: 'width 0.6s ease',
                        width: `${Math.min(parseFloat(pct), 100)}%`,
                        background: isLow
                          ? 'linear-gradient(90deg, #dc2626, #f87171)'
                          : 'linear-gradient(90deg, #16a34a, #22c55e)',
                      }} />
                    </div>
                    {/* 75% threshold marker */}
                    <div style={{ position: 'relative', height: 12 }}>
                      <div style={{
                        position: 'absolute', left: '75%',
                        top: 0, bottom: 0,
                        borderLeft: '1.5px dashed #94a3b8',
                      }} />
                      <span style={{
                        position: 'absolute', left: '75%',
                        top: 2, fontSize: 9, fontWeight: 700,
                        color: '#94a3b8', paddingLeft: 3, whiteSpace: 'nowrap',
                      }}>
                        75% min
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Legend ── */}
          <div style={{
            background: 'white', borderRadius: 16, padding: '12px 16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              fontSize: 10.5, fontWeight: 800, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
            }}>
              Legend
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: meta.bg, border: `1.5px solid ${meta.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: meta.color,
                  }}>
                    {key}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    {meta.label}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: 'transparent', border: '1.5px dashed #94a3b8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: '#94a3b8',
                }}>
                  —
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  Not marked / holiday
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
