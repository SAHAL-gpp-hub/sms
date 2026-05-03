// frontend/src/pages/portal/PortalAttendance.jsx
import { useState, useEffect } from 'react'
import { portalAPI } from '../../services/api'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DAYS   = ['Mo','Tu','We','Th','Fr','Sa','Su']

const STATUS_META = {
  P:  { color: '#16a34a', bg: '#dcfce7', label: 'Present' },
  A:  { color: '#dc2626', bg: '#fee2e2', label: 'Absent'  },
  L:  { color: '#d97706', bg: '#fef3c7', label: 'Late'    },
  OL: { color: '#2563eb', bg: '#dbeafe', label: 'Leave'   },
}

function CalendarView({ year, month, records }) {
  // records: [{date: "2026-04-01", status: "P"}, ...]
  const recordMap = {}
  records.forEach(r => { recordMap[r.date] = r.status })

  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  // Monday = 0 offset
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 800, color: '#94a3b8', padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const status = recordMap[dateStr]
          const meta = STATUS_META[status]
          const isToday = dateStr === new Date().toISOString().split('T')[0]

          return (
            <div key={i} style={{
              aspect: '1/1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px',
              fontSize: '12px', fontWeight: 700,
              background: meta ? meta.bg : isToday ? '#f0f7f7' : 'transparent',
              color: meta ? meta.color : isToday ? '#0d7377' : '#64748b',
              border: isToday && !meta ? '1.5px solid #0d7377' : 'none',
              minHeight: '34px',
            }}>
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PortalAttendance() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    portalAPI.getAttendance()
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Filter records for selected month
  const monthStr = `${year}-${String(month).padStart(2,'0')}`
  const monthRecords = Array.isArray(data)
    ? data.filter(r => r.date && r.date.startsWith(monthStr))
    : []

  const present = monthRecords.filter(r => r.status === 'P').length
  const absent  = monthRecords.filter(r => r.status === 'A').length
  const late    = monthRecords.filter(r => r.status === 'L').length
  const leave   = monthRecords.filter(r => r.status === 'OL').length
  const total   = monthRecords.length
  const pct     = total > 0 ? ((present / total) * 100).toFixed(1) : '—'

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <>
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Attendance</h2>
        <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>Monthly calendar view</p>
      </div>

      {/* Month selector */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '14px 16px',
        marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <button onClick={prevMonth} style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', touchAction: 'manipulation' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>{MONTHS[month - 1]} {year}</div>
            {!loading && total > 0 && (
              <div style={{
                fontSize: '13px', fontWeight: 800,
                color: parseFloat(pct) >= 75 ? '#16a34a' : '#dc2626',
                marginTop: '2px',
              }}>
                {pct}% attendance
              </div>
            )}
          </div>
          <button onClick={nextMonth} disabled={isThisMonth} style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: isThisMonth ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isThisMonth ? '#cbd5e1' : '#64748b', touchAction: 'manipulation' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {loading ? (
          <div style={{ height: '200px', borderRadius: '10px', background: 'linear-gradient(90deg, #f0f7f7 25%, #e0eded 50%, #f0f7f7 75%)', backgroundSize: '200% auto', animation: 'portalShimmer 1.5s linear infinite' }} />
        ) : (
          <CalendarView year={year} month={month} records={monthRecords} />
        )}
      </div>

      {/* Legend + stats */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
          {MONTHS[month - 1]} Summary
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { key: 'P',  label: 'Present', count: present },
            { key: 'A',  label: 'Absent',  count: absent  },
            { key: 'L',  label: 'Late',    count: late    },
            { key: 'OL', label: 'Leave',   count: leave   },
          ].map(s => {
            const meta = STATUS_META[s.key]
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '10px', background: meta.bg + '55' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{s.count}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px' }}>
              <span>Attendance rate</span>
              <span style={{ color: parseFloat(pct) >= 75 ? '#16a34a' : '#dc2626' }}>{pct}%</span>
            </div>
            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px', transition: 'width 0.6s ease',
                width: `${pct}%`,
                background: parseFloat(pct) >= 75 ? 'linear-gradient(90deg, #16a34a, #22c55e)' : 'linear-gradient(90deg, #dc2626, #f87171)',
              }} />
            </div>
            {parseFloat(pct) < 75 && (
              <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: '#fee2e2', fontSize: '11.5px', fontWeight: 700, color: '#b91c1c' }}>
                ⚠️ Below 75% minimum requirement
              </div>
            )}
          </div>
        )}

        {total === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
            No attendance records for this month
          </div>
        )}
      </div>

      {/* Color legend */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Legend</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: meta.bg, border: `1.5px solid ${meta.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: meta.color }}>{key}</div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{meta.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
