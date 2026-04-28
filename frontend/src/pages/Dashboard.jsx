// Dashboard.jsx — Redesigned with skeletons, better layout, improved stats
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { attendanceAPI, formatINR } from '../services/api'
import { StatCard, EmptyState, Skeleton } from '../components/UI'

const STAT_ICONS = {
  students: (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  fees: (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  outstanding: (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  defaulters: (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
}

const QUICK_ACTIONS = [
  { label: 'Add Student',     to: '/students/new',     color: 'var(--brand-600)',   bg: 'var(--brand-50)',   border: 'var(--brand-200)' },
  { label: 'Mark Attendance', to: '/attendance',        color: '#7c3aed',            bg: 'var(--purple-50)',  border: 'var(--purple-100)' },
  { label: 'Enter Marks',     to: '/marks',             color: '#0891b2',            bg: '#ecfeff',           border: '#cffafe' },
  { label: 'Fee Structure',   to: '/fees',              color: 'var(--success-600)', bg: 'var(--success-50)', border: 'var(--success-100)' },
  { label: 'View Defaulters', to: '/fees/defaulters',   color: 'var(--danger-600)',  bg: 'var(--danger-50)',  border: 'var(--danger-100)' },
  { label: 'Reports',         to: '/reports',           color: '#b45309',            bg: 'var(--warning-50)', border: '#fde68a' },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    attendanceAPI.getDashboardStats()
      .then(r => { setStats(r.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  if (error) return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">{today}</p>
      </div>
      <div style={{
        background: 'var(--surface-0)', border: '1px solid var(--danger-100)',
        borderRadius: '14px', padding: '40px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Could not load dashboard data
        </div>
        <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          The backend may be unreachable. Check that Docker is running.
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <Link to="/students/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Student
        </Link>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <StatCard
          label="Total Students"
          value={loading ? null : (stats?.total_students ?? 0).toLocaleString()}
          sub="Active enrollments"
          color="var(--brand-600)"
          icon={STAT_ICONS.students}
          loading={loading}
        />
        <StatCard
          label="Collected This Month"
          value={loading ? null : formatINR(stats?.fees_this_month ?? 0)}
          sub="Payments received"
          color="var(--success-600)"
          icon={STAT_ICONS.fees}
          loading={loading}
        />
        <StatCard
          label="Outstanding Dues"
          value={loading ? null : formatINR(stats?.total_outstanding ?? 0)}
          sub="Total pending fees"
          color="var(--danger-600)"
          icon={STAT_ICONS.outstanding}
          loading={loading}
        />
        <StatCard
          label="Fee Defaulters"
          value={loading ? null : (stats?.defaulter_count ?? 0)}
          sub="Students with balance due"
          color="var(--warning-600)"
          icon={STAT_ICONS.defaulters}
          loading={loading}
        />
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div className="card-title">Quick Actions</div>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {QUICK_ACTIONS.map(a => (
            <Link
              key={a.label}
              to={a.to}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '9px',
                border: `1px solid ${a.border}`,
                background: a.bg,
                color: a.color,
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Recent Payments */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Payments</div>
            <Link to="/fees/defaulters" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--brand-600)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Skeleton height="12px" width="100px" style={{ marginBottom: '5px' }} />
                    <Skeleton height="11px" width="70px" />
                  </div>
                  <Skeleton height="14px" width="60px" />
                </div>
              ))}
            </div>
          ) : !stats?.recent_payments?.length ? (
            <EmptyState
              icon={<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
              title="No payments yet"
              description="Payments will appear here once recorded"
            />
          ) : (
            <div style={{ padding: '4px 0' }}>
              {stats.recent_payments.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 20px',
                  borderBottom: i < stats.recent_payments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div>
                    <div className="mono" style={{ color: 'var(--brand-600)', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>
                      {p.receipt_number}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {p.date} · <span style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{p.mode}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--success-600)' }}>
                    {formatINR(p.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Class-wise enrollment */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Class Enrollment</div>
            <Link to="/students" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--brand-600)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} height="13px" width={`${60 + i * 8}%`} />)}
            </div>
          ) : !stats?.class_counts?.length ? (
            <EmptyState
              icon={<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" /></svg>}
              title="No students enrolled"
              description="Add students to see class-wise counts"
            />
          ) : (
            <div style={{ padding: '4px 0' }}>
              {stats.class_counts.slice(0, 8).map((c, i) => {
                const maxCount = Math.max(...stats.class_counts.map(x => x.count))
                const pct = maxCount > 0 ? (c.count / maxCount) * 100 : 0
                return (
                  <div key={i} style={{
                    padding: '8px 20px',
                    borderBottom: i < Math.min(stats.class_counts.length, 8) - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Class {c.class_name}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-600)' }}>
                        {c.count} students
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--brand-500)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
