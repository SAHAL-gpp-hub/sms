import { useState, useEffect } from 'react'
import { attendanceAPI, formatINR } from '../services/api'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  // C-09 FIX: Add explicit error state so admin sees a retry banner, not blank dashes
  const [error, setError] = useState(null)

  useEffect(() => {
    attendanceAPI.getDashboardStats()
      .then(r => { setStats(r.data); setLoading(false) })
      .catch(() => {
        setError('Could not load dashboard data. Check backend connection.')
        setLoading(false)
      })
  }, [])

  const statCards = [
    {
      label: 'Total Students',
      value: loading ? '...' : (stats?.total_students ?? 0),
      sub: 'Active enrollments',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      label: 'Collected This Month',
      // M-02 FIX: Use formatINR instead of raw number / fmt()
      value: loading ? '...' : formatINR(stats?.fees_this_month ?? 0),
      sub: 'Fee payments received',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      label: 'Outstanding Dues',
      value: loading ? '...' : formatINR(stats?.total_outstanding ?? 0),
      sub: 'Total pending fees',
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    {
      label: 'Fee Defaulters',
      value: loading ? '...' : (stats?.defaulter_count ?? 0),
      sub: 'Students with balance due',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
  ]

  // C-09 FIX: Show retry banner when backend is unreachable
  if (error) return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
      </div>
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
        <p className="text-rose-700 font-semibold mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Welcome to Iqra School Management System —{' '}
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {statCards.map(s => (
          <div key={s.label} className={`bg-white rounded-xl border ${s.border} shadow-sm p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
              </div>
              <div className={`${s.bg} ${s.color} p-2.5 rounded-lg`}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Recent Payments</h2>
            <Link to="/fees/defaulters" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="p-6 text-center text-slate-400 text-sm">Loading...</div>
          ) : !stats?.recent_payments?.length ? (
            <div className="p-6 text-center text-slate-400 text-sm">No payments yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {stats.recent_payments.map((p, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-blue-600">{p.receipt_number}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.date} · {p.mode}</p>
                  </div>
                  {/* M-02 FIX: formatINR */}
                  <p className="text-sm font-bold text-emerald-600">{formatINR(p.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Class-wise enrollment */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Class-wise Enrollment</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-slate-400 text-sm">Loading...</div>
          ) : !stats?.class_counts?.length ? (
            <div className="p-6 text-center text-slate-400 text-sm">No students enrolled yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {stats.class_counts.map((c, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <p className="text-sm text-slate-700 font-medium">Class {c.class_name}</p>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                    {c.count} students
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: '+ Add Student', to: '/students/new', style: 'bg-blue-600 text-white hover:bg-blue-700' },
            { label: '📅 Mark Attendance', to: '/attendance', style: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
            { label: '💰 Fee Structure', to: '/fees', style: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
            { label: '⚠️ View Defaulters', to: '/fees/defaulters', style: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
            { label: '📝 Enter Marks', to: '/marks', style: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
          ].map(a => (
            <Link key={a.label} to={a.to}
              className={`${a.style} px-4 py-2 rounded-lg text-sm font-medium transition-colors`}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}