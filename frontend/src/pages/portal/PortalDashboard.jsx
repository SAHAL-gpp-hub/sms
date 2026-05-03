// frontend/src/pages/portal/PortalDashboard.jsx
import { useState, useEffect } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { portalAPI } from '../../services/api'

function StatBubble({ label, value, subtext, color, bg, icon }) {
  return (
    <div style={{
      background: bg,
      borderRadius: '16px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <div style={{
        width: '44px', height: '44px',
        borderRadius: '12px',
        background: color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</div>
        {subtext && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>{subtext}</div>}
      </div>
    </div>
  )
}

export default function PortalDashboard() {
  const { profile } = useOutletContext() || {}
  const [results, setResults]     = useState(null)
  const [attendance, setAttendance] = useState(null)
  const [fees, setFees]           = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.allSettled([
      portalAPI.getResults(),
      portalAPI.getAttendanceSummary(),
      portalAPI.getFees(),
    ]).then(([resR, attR, feeR]) => {
      if (resR.status === 'fulfilled') setResults(resR.value.data)
      if (attR.status === 'fulfilled') setAttendance(attR.value.data)
      if (feeR.status === 'fulfilled') setFees(feeR.value.data)
      setLoading(false)
    })
  }, [])

  // Latest exam result
  const latestExam = Array.isArray(results) ? results[0] : null
  const latestPct  = latestExam
    ? (typeof latestExam.percentage === 'number' ? latestExam.percentage.toFixed(1) : '—') + '%'
    : '—'
  const latestGrade = latestExam?.grade || '—'

  // This month attendance
  const thisMonthAtt = Array.isArray(attendance) ? attendance[0] : null
  const attPct = thisMonthAtt?.percentage != null ? thisMonthAtt.percentage.toFixed(1) + '%' : '—'

  // Fee balance
  const balance = fees?.total_balance != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(fees.total_balance)
    : '—'

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <style>{`
        .portal-card {
          background: white;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          margin-bottom: 12px;
        }
        .portal-card-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94a3b8;
          margin-bottom: 12px;
        }
        .portal-shimmer {
          background: linear-gradient(90deg, #f0f7f7 25%, #e0eded 50%, #f0f7f7 75%);
          background-size: 200% auto;
          animation: portalShimmer 1.5s linear infinite;
          border-radius: 8px;
        }
        @keyframes portalShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0d7377, #14a085)',
        borderRadius: '18px',
        padding: '18px 20px',
        marginBottom: '14px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative circle */}
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, opacity: 0.8, marginBottom: '4px' }}>{today}</div>
          <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            {loading ? 'Loading…' : `Hello, ${(profile?.name_en || '').split(' ')[0] || 'Student'}! 👋`}
          </div>
          <div style={{ fontSize: '12.5px', opacity: 0.75, marginTop: '4px', fontWeight: 600 }}>
            {profile ? `Std ${profile.class_id} · Roll No. ${profile.roll_number || '—'}` : 'Iqra English Medium School'}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        {loading ? (
          <>
            {[1,2,3,4].map(i => (
              <div key={i} className="portal-shimmer" style={{ height: '80px' }} />
            ))}
          </>
        ) : (
          <>
            <StatBubble label="Last Exam" value={latestPct} subtext={latestExam?.name || 'No exams yet'} color="#0d7377" bg="white" icon="📊" />
            <StatBubble label="Grade" value={latestGrade} subtext={latestExam ? 'Overall' : '—'} color="#7c3aed" bg="white" icon="🎓" />
            <StatBubble label="Attendance" value={attPct} subtext={thisMonthAtt ? 'This month' : 'No data yet'} color="#d97706" bg="white" icon="📅" />
            <StatBubble label="Fee Balance" value={balance} subtext={fees ? (parseFloat(fees.total_balance) > 0 ? 'Outstanding' : 'All clear ✓') : '—'} color={fees && parseFloat(fees.total_balance) > 0 ? '#dc2626' : '#16a34a'} bg="white" icon="💰" />
          </>
        )}
      </div>

      {/* Quick links */}
      <div className="portal-card">
        <div className="portal-card-title">Quick Access</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { to: '/portal/results',    label: 'View Results',    icon: '📊', color: '#0d7377' },
            { to: '/portal/attendance', label: 'Attendance',      icon: '📅', color: '#d97706' },
            { to: '/portal/fees',       label: 'Fee Statement',   icon: '💰', color: '#dc2626' },
            { to: '/portal/profile',    label: 'My Profile',      icon: '👤', color: '#7c3aed' },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 12px', borderRadius: '12px',
              background: item.color + '0f',
              border: `1px solid ${item.color}22`,
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent exam results */}
      {!loading && latestExam && (
        <div className="portal-card">
          <div className="portal-card-title">Latest Exam — {latestExam.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              { label: 'Score', value: `${Math.round(latestExam.total_marks || 0)}/${Math.round(latestExam.max_marks || 0)}` },
              { label: 'Percentage', value: `${(latestExam.percentage || 0).toFixed(1)}%` },
              { label: 'CGPA', value: latestExam.cgpa || '—' },
            ].map(s => (
              <div key={s.label} style={{ background: '#f0f7f7', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#0d7377', letterSpacing: '-0.02em', marginTop: '2px' }}>{s.value}</div>
              </div>
            ))}
          </div>
          <Link to="/portal/results" style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: '10px', background: '#0d737718', color: '#0d7377', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>
            View All Results →
          </Link>
        </div>
      )}
    </>
  )
}
