import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { attendanceAPI, formatINR, setupAPI } from '../services/api'
import { getAuthUser } from '../services/auth'
import { EmptyState, MetricCard, SectionPanel, Skeleton } from '../components/UI'

const Icon = ({ children }) => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
)

const ICONS = {
  students: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></Icon>,
  fees: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></Icon>,
  clock: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></Icon>,
  alert: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></Icon>,
  marks: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" /></Icon>,
  report: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" /></Icon>,
}

const ADMIN_ACTIONS = [
  { label: 'Add Student', to: '/students/new', color: 'var(--brand-600)', icon: ICONS.students },
  { label: 'Mark Attendance', to: '/attendance', color: '#0f766e', icon: ICONS.clock },
  { label: 'Enter Marks', to: '/marks', color: '#0891b2', icon: ICONS.marks },
  { label: 'Fee Structure', to: '/fees', color: 'var(--success-600)', icon: ICONS.fees },
  { label: 'Fee Defaulters', to: '/fees/defaulters', color: 'var(--danger-600)', icon: ICONS.alert },
  { label: 'Reports', to: '/reports', color: '#b45309', icon: ICONS.report },
]

function ActionTiles({ actions }) {
  return (
    <div className="action-grid">
      {actions.map(action => (
        <Link key={action.label} to={action.to} className="action-tile" style={{ '--action-color': action.color }}>
          <span className="action-tile-icon">{action.icon}</span>
          <span className="action-tile-label">{action.label}</span>
        </Link>
      ))}
    </div>
  )
}

function Hero({ title, copy, today, actions }) {
  return (
    <section className="dashboard-hero">
      <div className="dashboard-hero-main">
        <div className="dashboard-kicker">School operations</div>
        <h1 className="dashboard-title">{title}</h1>
        <p className="dashboard-copy">{copy}</p>
        <div className="dashboard-hero-actions">{actions}</div>
      </div>
      <aside className="dashboard-hero-side">
        <div className="dashboard-date-card">
          <small>Today</small>
          <strong>{today}</strong>
        </div>
        <div>
          <div className="metric-label">Navigation focus</div>
          <p style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Core workflows stay one click away: students, attendance, marks, fees, and reports.
          </p>
        </div>
      </aside>
    </section>
  )
}

function TeacherDashboard({ today }) {
  const authUser = getAuthUser()
  const [classes, setClasses] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)

  const classTeacherClassIds = authUser?.classTeacherClassIds || []
  const subjectAssignments = authUser?.subjectAssignments || []
  const assignedClassIds = authUser?.assignedClassIds || []

  useEffect(() => {
    setupAPI.getClasses()
      .then(r => setClasses(r.data || []))
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false))
  }, [])

  const classLabel = (id) => {
    const cls = classes.find(c => c.id === id)
    if (!cls) return `Class ${id}`
    return `Class ${cls.name}${cls.division ? ` - ${cls.division}` : ''}`
  }

  const uniqueSubjectClasses = [...new Set(subjectAssignments.map(a => a.class_id))]
  const actions = [
    ...(classTeacherClassIds.length ? [{ label: 'Mark Attendance', to: '/attendance', color: '#0f766e', icon: ICONS.clock }] : []),
    ...(subjectAssignments.length ? [{ label: 'Enter Marks', to: '/marks', color: '#0891b2', icon: ICONS.marks }] : []),
    { label: 'View Students', to: '/students', color: 'var(--brand-600)', icon: ICONS.students },
    { label: 'Reports', to: '/reports', color: '#b45309', icon: ICONS.report },
  ]

  return (
    <div>
      <Hero
        title={`Good day${authUser?.name ? `, ${authUser.name.split(' ')[0]}` : ''}.`}
        copy="Your assigned classes, attendance responsibilities, and marks workflows are organized for fast daily work."
        today={today}
        actions={<ActionTiles actions={actions} />}
      />

      <div className="metric-grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Assigned Classes" value={assignedClassIds.length} sub="Classes you can view" color="var(--brand-600)" icon={ICONS.students} loading={loadingClasses} />
        <MetricCard label="Class Teacher" value={classTeacherClassIds.length} sub="Attendance control" color="#0f766e" icon={ICONS.clock} loading={loadingClasses} />
        <MetricCard label="Subject Assignments" value={subjectAssignments.length} sub={`${uniqueSubjectClasses.length} class${uniqueSubjectClasses.length === 1 ? '' : 'es'}`} color="#0891b2" icon={ICONS.marks} loading={loadingClasses} />
      </div>

      <div className="dashboard-grid">
        <SectionPanel title="Attendance Classes" subtitle="Classes where you can mark daily attendance">
          {loadingClasses ? (
            <div style={{ display: 'grid', gap: 12 }}>{[1, 2, 3].map(i => <Skeleton key={i} height="16px" width={`${70 + i * 6}%`} />)}</div>
          ) : classTeacherClassIds.length === 0 ? (
            <EmptyState icon={ICONS.clock} title="No attendance assignment" description="Attendance controls appear after admin assigns you as class teacher." />
          ) : (
            classTeacherClassIds.map(id => (
              <div key={id} className="list-row">
                <div>
                  <div className="list-row-title">{classLabel(id)}</div>
                  <div className="list-row-meta">Daily attendance workflow</div>
                </div>
                <Link to="/attendance" className="btn btn-secondary btn-sm">Open</Link>
              </div>
            ))
          )}
        </SectionPanel>

        <SectionPanel title="Marks Assignments" subtitle="Subject coverage by class">
          {loadingClasses ? (
            <div style={{ display: 'grid', gap: 12 }}>{[1, 2, 3].map(i => <Skeleton key={i} height="16px" width={`${68 + i * 7}%`} />)}</div>
          ) : subjectAssignments.length === 0 ? (
            <EmptyState icon={ICONS.marks} title="No marks assignment" description="Marks entry appears after admin assigns subjects to you." />
          ) : (
            uniqueSubjectClasses.map(id => {
              const count = subjectAssignments.filter(a => a.class_id === id).length
              return (
                <div key={id} className="list-row">
                  <div>
                    <div className="list-row-title">{classLabel(id)}</div>
                    <div className="list-row-meta">{count} subject{count === 1 ? '' : 's'}</div>
                  </div>
                  <Link to="/marks" className="btn btn-secondary btn-sm">Open</Link>
                </div>
              )
            })
          )}
        </SectionPanel>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const authUser = getAuthUser()
  const isTeacher = authUser?.role === 'teacher'
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(!isTeacher)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isTeacher) {
      return
    }
    attendanceAPI.getDashboardStats()
      .then(r => { setStats(r.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [isTeacher])

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  if (isTeacher) return <TeacherDashboard today={today} />

  if (error) {
    return (
      <SectionPanel title="Could not load dashboard data" subtitle="The backend may be unreachable. Check that Docker is running.">
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </SectionPanel>
    )
  }

  return (
    <div>
      <Hero
        title={`Welcome back${authUser?.name ? `, ${authUser.name.split(' ')[0]}` : ''}.`}
        copy="A calmer command center for student records, attendance, fees, marks, and reports."
        today={today}
        actions={<Link to="/students/new" className="btn btn-primary">{ICONS.students} Add Student</Link>}
      />

      <div className="metric-grid">
        <MetricCard label="Total Students" value={(stats?.total_students ?? 0).toLocaleString()} sub="Active enrollments" color="var(--brand-600)" icon={ICONS.students} loading={loading} />
        <MetricCard label="Collected This Month" value={formatINR(stats?.fees_this_month ?? 0)} sub="Payments received" color="var(--success-600)" icon={ICONS.fees} loading={loading} />
        <MetricCard label="Outstanding Dues" value={formatINR(stats?.total_outstanding ?? 0)} sub="Total pending fees" color="var(--danger-600)" icon={ICONS.clock} loading={loading} />
        <MetricCard label="Fee Defaulters" value={stats?.defaulter_count ?? 0} sub="Students with balance due" color="var(--warning-600)" icon={ICONS.alert} loading={loading} />
      </div>

      <div style={{ marginTop: 16 }}>
        <SectionPanel title="Quick Actions" subtitle="High-frequency workflows for the front office" bodyStyle={{ padding: 16 }}>
          <ActionTiles actions={ADMIN_ACTIONS} />
        </SectionPanel>
      </div>

      <div className="dashboard-grid">
        <SectionPanel
          title="Recent Payments"
          subtitle="Latest receipts and collection activity"
          actions={<Link to="/fees/defaulters" className="btn btn-secondary btn-sm">View fees</Link>}
        >
          {loading ? (
            <div style={{ display: 'grid', gap: 14 }}>{[1, 2, 3].map(i => <Skeleton key={i} height="18px" width={`${70 + i * 5}%`} />)}</div>
          ) : !stats?.recent_payments?.length ? (
            <EmptyState icon={ICONS.fees} title="No payments yet" description="Payments will appear here once recorded." />
          ) : (
            stats.recent_payments.slice(0, 6).map((p, i) => (
              <div key={`${p.receipt_number}-${i}`} className="list-row">
                <div style={{ minWidth: 0 }}>
                  <div className="list-row-title mono" style={{ color: 'var(--brand-600)' }}>{p.receipt_number}</div>
                  <div className="list-row-meta">{p.date} · {p.mode}</div>
                </div>
                <strong style={{ color: 'var(--success-600)', whiteSpace: 'nowrap' }}>{formatINR(p.amount)}</strong>
              </div>
            ))
          )}
        </SectionPanel>

        <SectionPanel
          title="Class Enrollment"
          subtitle="Class-wise student distribution"
          actions={<Link to="/students" className="btn btn-secondary btn-sm">View students</Link>}
        >
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>{[1, 2, 3, 4].map(i => <Skeleton key={i} height="16px" width={`${60 + i * 8}%`} />)}</div>
          ) : !stats?.class_counts?.length ? (
            <EmptyState icon={ICONS.students} title="No students enrolled" description="Add students to see class-wise counts." />
          ) : (
            stats.class_counts.slice(0, 8).map((c, i) => {
              const maxCount = Math.max(...stats.class_counts.map(x => x.count))
              const pct = maxCount > 0 ? (c.count / maxCount) * 100 : 0
              return (
                <div key={`${c.class_name}-${i}`} style={{ padding: '10px 0', borderBottom: i < Math.min(stats.class_counts.length, 8) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
                    <div className="list-row-title">Class {c.class_name}</div>
                    <strong style={{ color: 'var(--brand-600)', fontSize: 12 }}>{c.count} students</strong>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--brand-600), #0f766e)' }} /></div>
                </div>
              )
            })
          )}
        </SectionPanel>
      </div>
    </div>
  )
}
