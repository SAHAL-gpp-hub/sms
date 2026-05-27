import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminAPI, attendanceAPI, formatINR, marksAPI, setupAPI } from '../services/api'
import { getAuthUser } from '../services/auth'
import { EmptyState, MetricCard, SectionPanel, Skeleton } from '../components/UI'
import OnboardingEmptyState from '../components/OnboardingEmptyState'
import { useAcademicYear } from '../contexts/academicYearContext'

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

const ADMIN_WORKFLOWS = [
  { key: 'today', label: "Today's Work" },
  { key: 'students', label: 'Students' },
  { key: 'fees', label: 'Fees' },
  { key: 'marks', label: 'Marks' },
  { key: 'reports', label: 'Reports' },
  { key: 'yearend', label: 'Year-End' },
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
  const { selectedYearId, selectedYear } = useAcademicYear()
  const todayIso = new Date().toISOString().slice(0, 10)
  const classesQuery = useQuery({
    queryKey: ['classes', selectedYearId],
    enabled: Boolean(selectedYearId),
    queryFn: async () => {
      const r = await setupAPI.getClasses(selectedYearId)
      return r.data || []
    },
  })
  const classes = classesQuery.data || []
  const loadingClasses = classesQuery.isLoading
  const currentYearId = selectedYearId

  const classTeacherClassIds = authUser?.classTeacherClassIds || []
  const subjectAssignments = authUser?.subjectAssignments || []
  const assignedClassIds = authUser?.assignedClassIds || []
  const uniqueSubjectClasses = [...new Set(subjectAssignments.map(a => a.class_id))]

  const classLabel = (id) => {
    const cls = classes.find(c => c.id === id)
    if (!cls) return `Class ${id}`
    return `Class ${cls.name}${cls.division ? ` - ${cls.division}` : ''}`
  }

  const attendanceQuery = useQuery({
    queryKey: ['teacher-today-attendance', classTeacherClassIds, todayIso, currentYearId],
    enabled: Boolean(currentYearId) && classTeacherClassIds.length > 0,
    queryFn: async () => {
      const rows = await Promise.all(classTeacherClassIds.map(async classId => {
        const r = await attendanceAPI.getDaily(classId, todayIso)
        const roster = r.data || []
        const unmarked = roster.filter(s => !s.status || s.status === 'UNMARKED').length
        return { classId, total: roster.length, unmarked }
      }))
      return rows
    },
    staleTime: 60_000,
  })

  const marksProgressQuery = useQuery({
    queryKey: ['teacher-marks-progress', uniqueSubjectClasses, currentYearId],
    enabled: !!currentYearId && uniqueSubjectClasses.length > 0,
    queryFn: async () => {
      const rows = await Promise.all(uniqueSubjectClasses.slice(0, 6).map(async classId => {
        const examsRes = await marksAPI.getExams({ class_id: classId, academic_year_id: currentYearId })
        const latestExam = (examsRes.data || [])[0]
        if (!latestExam) return { classId, status: 'no-exam' }
        const gridRes = await marksAPI.getMarksEntry(latestExam.id, classId)
        const grid = gridRes.data
        const teacherSubjectIds = subjectAssignments
          .filter(assignment => Number(assignment.class_id) === Number(classId))
          .map(assignment => Number(assignment.subject_id))
        const subjects = (grid.subjects || []).filter(subject => teacherSubjectIds.includes(Number(subject.id)))
        let entered = 0
        let total = 0
        ;(grid.students || []).forEach(student => {
          subjects.forEach(subject => {
            total += 1
            const marks = student.marks?.[subject.id]
            if (marks?.is_absent || marks?.theory !== null || marks?.practical !== null) entered += 1
          })
        })
        return { classId, status: 'ready', examName: latestExam.name, entered, total }
      }))
      return rows
    },
    staleTime: 2 * 60_000,
  })

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
        copy={`Your assigned classes, attendance responsibilities, and marks workflows are organized for ${selectedYear?.label || 'the selected academic year'}.`}
        today={today}
        actions={<ActionTiles actions={actions} />}
      />

      <div className="metric-grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Assigned Classes" value={assignedClassIds.length} sub="Classes you can view" color="var(--brand-600)" icon={ICONS.students} loading={loadingClasses} />
        <MetricCard label="Class Teacher" value={classTeacherClassIds.length} sub="Attendance control" color="#0f766e" icon={ICONS.clock} loading={loadingClasses} />
        <MetricCard label="Subject Assignments" value={subjectAssignments.length} sub={`${uniqueSubjectClasses.length} class${uniqueSubjectClasses.length === 1 ? '' : 'es'}`} color="#0891b2" icon={ICONS.marks} loading={loadingClasses} />
      </div>

      <div className="dashboard-grid">
        <SectionPanel title="Today's Attendance" subtitle="Start here before the day gets noisy">
          {attendanceQuery.isLoading ? (
            <div style={{ display: 'grid', gap: 12 }}>{[1, 2].map(i => <Skeleton key={i} height="18px" width={`${76 + i * 5}%`} />)}</div>
          ) : classTeacherClassIds.length === 0 ? (
            <EmptyState icon={ICONS.clock} title="No attendance assignment" description="Attendance controls appear after admin assigns you as class teacher." />
          ) : (
            (attendanceQuery.data || []).map(row => (
              <div key={row.classId} className="list-row">
                <div>
                  <div className="list-row-title">{classLabel(row.classId)}</div>
                  <div className="list-row-meta">
                    {row.unmarked === 0 ? `${row.total} students marked today` : `${row.unmarked} of ${row.total} students unmarked`}
                  </div>
                </div>
                <Link to="/attendance" className={`btn btn-sm ${row.unmarked === 0 ? 'btn-secondary' : 'btn-primary'}`}>
                  {row.unmarked === 0 ? 'Review' : 'Mark Now'}
                </Link>
              </div>
            ))
          )}
        </SectionPanel>

        <SectionPanel title="Marks Pending" subtitle="Latest exam progress for your assigned subjects">
          {marksProgressQuery.isLoading ? (
            <div style={{ display: 'grid', gap: 12 }}>{[1, 2].map(i => <Skeleton key={i} height="18px" width={`${70 + i * 8}%`} />)}</div>
          ) : subjectAssignments.length === 0 ? (
            <EmptyState icon={ICONS.marks} title="No marks assignment" description="Marks entry appears after admin assigns subjects to you." />
          ) : (
            (marksProgressQuery.data || []).map(row => (
              <div key={row.classId} className="list-row">
                <div>
                  <div className="list-row-title">{classLabel(row.classId)}</div>
                  <div className="list-row-meta">
                    {row.status === 'no-exam' ? 'No exam created yet' : `${row.examName} · ${row.entered}/${row.total} entered`}
                  </div>
                </div>
                <Link to="/marks" className="btn btn-secondary btn-sm">{row.status === 'no-exam' ? 'Open' : 'Continue'}</Link>
              </div>
            ))
          )}
        </SectionPanel>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
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
  const { selectedYearId, selectedYear } = useAcademicYear()
  const [activeWorkflow, setActiveWorkflow] = useState('today')
  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', selectedYearId],
    enabled: !isTeacher && Boolean(selectedYearId),
    queryFn: async () => {
      const r = await attendanceAPI.getDashboardStats(selectedYearId)
      return r.data
    },
    staleTime: 20_000,
  })
  const stats = statsQuery.data
  const actionQueueQuery = useQuery({
    queryKey: ['admin-action-queue', selectedYearId],
    enabled: !isTeacher && Boolean(selectedYearId),
    queryFn: async () => {
      const [corrections, otpFailures] = await Promise.all([
        adminAPI.listCorrectionRequests({ status: 'pending' }).catch(() => ({ data: [] })),
        adminAPI.getOtpFailures({ status: 'failed', limit: 5 }).catch(() => ({ data: { total: 0 } })),
      ])
      const items = []
      const correctionCount = corrections.data?.length || corrections.data?.items?.length || 0
      if (correctionCount > 0) {
        items.push({ severity: 'warning', label: `${correctionCount} profile correction${correctionCount === 1 ? '' : 's'} pending approval`, href: '/admin/users?tab=corrections', action: 'Review' })
      }
      const failureCount = otpFailures.data?.total || otpFailures.data?.length || 0
      if (failureCount > 0) {
        items.push({ severity: 'error', label: `${failureCount} parent/student activation email${failureCount === 1 ? '' : 's'} failed`, href: '/admin/users?tab=portal', action: 'Check' })
      }
      if ((stats?.defaulter_count || 0) > 0) {
        items.push({ severity: 'danger', label: `${stats.defaulter_count} fee defaulter${stats.defaulter_count === 1 ? '' : 's'} need follow-up`, href: '/fees/defaulters', action: 'Open' })
      }
      return items
    },
    refetchInterval: 5 * 60 * 1000,
  })
  const loading = !isTeacher && (statsQuery.isLoading || statsQuery.isFetching)
  const error = !isTeacher && statsQuery.isError

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
        copy={`Today's work is pulled forward for ${selectedYear?.label || 'the selected academic year'}: fees, student records, reports, and year-end operations.`}
        today={today}
        actions={<Link to="/students/new" className="btn btn-primary">{ICONS.students} Add Student</Link>}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 12, background: 'var(--surface-0)', marginBottom: 14 }}>
        <strong>{formatINR(stats?.fees_this_month ?? 0)} collected this month</strong>
        <span style={{ color: 'var(--text-tertiary)' }}>|</span>
        <strong style={{ color: 'var(--danger-600)' }}>{stats?.defaulter_count ?? 0} defaulters</strong>
        <span style={{ color: 'var(--text-tertiary)' }}>|</span>
        <strong>{actionQueueQuery.data?.length || 0} pending actions</strong>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
        {ADMIN_WORKFLOWS.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`btn btn-sm ${activeWorkflow === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveWorkflow(tab.key)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeWorkflow === 'today' && (
        <SectionPanel title="Action Queue" subtitle="Items that need attention today" bodyStyle={{ padding: 16 }}>
          {actionQueueQuery.isLoading ? (
            <Skeleton height="18px" width="70%" />
          ) : !actionQueueQuery.data?.length ? (
            <EmptyState icon={ICONS.alert} title="No urgent work right now" description="Corrections, failed portal invites, and fee follow-ups will appear here." />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {actionQueueQuery.data.map(item => (
                <div key={item.label} className="list-row">
                  <div>
                    <div className="list-row-title">{item.label}</div>
                    <div className="list-row-meta">{item.severity} priority</div>
                  </div>
                  <Link className="btn btn-secondary btn-sm" to={item.href}>{item.action}</Link>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      )}

      {activeWorkflow !== 'today' && (
        <SectionPanel title={`${ADMIN_WORKFLOWS.find(tab => tab.key === activeWorkflow)?.label} Workflow`} subtitle="Focused shortcuts for this admin job" bodyStyle={{ padding: 16 }}>
          {activeWorkflow === 'students' && (stats?.total_students || 0) === 0 ? (
            <OnboardingEmptyState type="noStudents" />
          ) : (
            <ActionTiles actions={ADMIN_ACTIONS.filter(action => {
              if (activeWorkflow === 'students') return ['/students/new'].includes(action.to)
              if (activeWorkflow === 'fees') return action.to.startsWith('/fees')
              if (activeWorkflow === 'marks') return action.to === '/marks'
              if (activeWorkflow === 'reports') return action.to === '/reports'
              if (activeWorkflow === 'yearend') return false
              return true
            }).concat(activeWorkflow === 'yearend' ? [{ label: 'Open Year-End', to: '/yearend', color: '#7c3aed', icon: ICONS.report }] : [])} />
          )}
        </SectionPanel>
      )}

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
