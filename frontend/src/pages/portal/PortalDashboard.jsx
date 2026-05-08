// frontend/src/pages/portal/PortalDashboard.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePortalContext } from '../../layouts/portalContext'
import { portalAPI } from '../../services/api'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(n) || 0)

// SVG icon set for portal dashboard
const Icons = {
  results: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  grade: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  attendance: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  fees: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  profile: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

function StatBubble({ label, value, subtext, color, icon }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 800, color: color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</div>
        {subtext && <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtext}</div>}
      </div>
    </div>
  )
}

function Shimmer({ h = '80px' }) {
  return <div style={{ height: h, borderRadius: '14px', background: 'linear-gradient(90deg,#f0f7f7 25%,#e0eded 50%,#f0f7f7 75%)', backgroundSize: '200% auto', animation: 'portalShimmer 1.5s linear infinite' }} />
}

export default function PortalDashboard() {
  const { role, profile, children, selectedChildId } = usePortalContext()
  const isParent = role === 'parent'

  const [results,    setResults]    = useState(null)
  const [attendance, setAttendance] = useState(null)
  const [fees,       setFees]       = useState(null)
  const [loading,    setLoading]    = useState(true)

  // Re-fetch whenever active child changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setResults(null); setAttendance(null); setFees(null)

      const sid = isParent ? selectedChildId : null
      if (isParent && !selectedChildId) {
        setLoading(false)
        return
      }

      const [resR, attR, feeR] = await Promise.allSettled([
        isParent ? portalAPI.getChildResults(sid)   : portalAPI.getResults(),
        isParent ? portalAPI.getAttendanceSummary(sid) : portalAPI.getAttendanceSummary(),
        isParent ? portalAPI.getChildFees(sid)      : portalAPI.getFees(),
      ])
      if (cancelled) return
      if (resR.status === 'fulfilled') setResults(resR.value.data)
      if (attR.status === 'fulfilled') setAttendance(attR.value.data)
      if (feeR.status === 'fulfilled') setFees(feeR.value.data)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [isParent, selectedChildId])

  const latestExam  = Array.isArray(results) ? results[0] : null
  const latestPct   = latestExam ? `${Number(latestExam.percentage || 0).toFixed(1)}%` : '—'
  const latestGrade = latestExam?.grade || '—'

  // Dashboard uses the calendar-aware monthly summary for both students and parents.
  const attPct = (() => {
    if (!attendance) return '—'
    const first = Array.isArray(attendance) ? attendance[0] : null
    return first?.percentage != null ? `${first.percentage.toFixed(1)}%` : '—'
  })()

  const balance     = fees?.total_balance != null ? fmt(fees.total_balance) : '—'
  const hasBalance  = fees && parseFloat(fees.total_balance) > 0

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = profile?.name_en?.split(' ')[0] || (isParent ? 'Parent' : 'Student')

  return (
    <>
      <style>{`@keyframes portalShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }`}</style>

      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg,#0d7377,#14a085)',
        borderRadius: '18px', padding: '18px 20px', marginBottom: '14px',
        color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, opacity: 0.8, marginBottom: '4px' }}>{today}</div>
          <div style={{ fontSize: '21px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Hello, {firstName}!
          </div>
          <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '4px', fontWeight: 600 }}>
            {profile ? `Std ${profile.class_id} · Roll ${profile.roll_number || '—'} · ${profile.student_id || ''}` : 'Iqra English Medium School'}
          </div>
        </div>
      </div>

      {/* Parent: show linked children summary if no child selected yet */}
      {isParent && children.length > 0 && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '12px 14px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            Linked Students — {children.length} total
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {children.map((c, i) => {
              const colors = ['#0d7377','#7c3aed','#d97706','#dc2626','#16a34a']
              const color  = colors[i % colors.length]
              const active = c.id === selectedChildId
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', borderRadius: '10px',
                  background: active ? color + '10' : '#f8fafc',
                  border: `1.5px solid ${active ? color : '#e2e8f0'}`,
                  flex: '1 0 calc(50% - 4px)', minWidth: 0,
                }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    background: `linear-gradient(135deg,${color},${color}bb)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 900, color: 'white', flexShrink: 0,
                  }}>
                    {(c.name_en || 'S').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: active ? color : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name_en}</div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Std {c.class_id}</div>
                  </div>
                  {active && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0, marginLeft: 'auto' }} />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        {loading ? (
          [1,2,3,4].map(i => <Shimmer key={i} />)
        ) : (
          <>
            <StatBubble label="Last Exam" value={latestPct} subtext={latestExam?.name || 'No exams yet'} color="#0d7377" icon={Icons.results} />
            <StatBubble label="Grade"     value={latestGrade} subtext="Overall" color="#7c3aed" icon={Icons.grade} />
            <StatBubble label="Attendance" value={attPct} subtext="Recent" color="#d97706" icon={Icons.attendance} />
            <StatBubble label="Fee Balance" value={balance} subtext={hasBalance ? 'Outstanding' : fees ? 'All clear' : '—'} color={hasBalance ? '#dc2626' : '#16a34a'} icon={Icons.fees} />
          </>
        )}
      </div>

      {/* Quick links */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '14px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Quick Access</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { to: '/portal/results',    label: 'View Results',  icon: Icons.results,    color: '#0d7377' },
            { to: '/portal/attendance', label: 'Attendance',    icon: Icons.attendance, color: '#d97706' },
            { to: '/portal/fees',       label: 'Fee Statement', icon: Icons.fees,       color: '#dc2626' },
            { to: '/portal/profile',    label: 'My Profile',    icon: Icons.profile,    color: '#7c3aed' },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '11px 12px', borderRadius: '11px',
              background: item.color + '0f', border: `1px solid ${item.color}22`,
              textDecoration: 'none', transition: 'all 0.15s',
            }}>
              <span style={{ color: item.color, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: item.color }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Latest exam summary */}
      {!loading && latestExam && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            Latest — {latestExam.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              { label: 'Score',      value: `${Math.round(latestExam.total_marks||0)}/${Math.round(latestExam.max_marks||0)}` },
              { label: 'Percentage', value: `${Number(latestExam.percentage||0).toFixed(1)}%` },
              { label: 'CGPA',       value: latestExam.cgpa || '—' },
            ].map(s => (
              <div key={s.label} style={{ background: '#f0f7f7', borderRadius: '10px', padding: '10px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#0d7377', marginTop: '2px' }}>{s.value}</div>
              </div>
            ))}
          </div>
          <Link to="/portal/results" style={{ display: 'block', textAlign: 'center', padding: '9px', borderRadius: '10px', background: '#0d737715', color: '#0d7377', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
            View All Results →
          </Link>
        </div>
      )}
    </>
  )
}
