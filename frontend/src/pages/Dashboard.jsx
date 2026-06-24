import { Link } from 'react-router-dom'
import { memo, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminAPI, attendanceAPI, formatINR, marksAPI, setupAPI, analyticsAPI } from '../services/api'
import { getAuthUser } from '../services/auth'
import { EmptyState, MetricCard, SectionPanel, Skeleton } from '../components/UI'
import OnboardingEmptyState from '../components/OnboardingEmptyState'
import { useAcademicYear } from '../contexts/academicYearContext'
import TodayAttendanceSummary from '../components/TodayAttendanceSummary'
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'


// Academic order: Nursery → LKG → UKG → Class 1 → Class 2 ... → Class 10
const ACADEMIC_ORDER = [
  'nursery', 'lkg', 'ukg',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
];

function getAcademicOrderIndex(className) {
  if (!className) return 999;
  let cleanName = className.toString().trim().replace(/^(Class\s+)/i, '').toLowerCase();
  const idx = ACADEMIC_ORDER.indexOf(cleanName);
  return idx !== -1 ? idx : 999;
}

export function sortClasses(classes, getName = (c) => c) {
  return [...classes].sort((a, b) => {
    const idxA = getAcademicOrderIndex(getName(a));
    const idxB = getAcademicOrderIndex(getName(b));
    if (idxA !== idxB) return idxA - idxB;
    return getName(a).toString().localeCompare(getName(b).toString());
  });
}

// Modern SVG Icons
const Icons = {
  students: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
    </svg>
  ),
  teachers: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  fees: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  clock: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  alert: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  marks: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  report: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  calendar: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  message: (props) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
};

const ICONS = {
  students: <Icons.students />,
  fees: <Icons.fees />,
  clock: <Icons.clock />,
  alert: <Icons.alert />,
  marks: <Icons.marks />,
  report: <Icons.report />,
  calendar: <Icons.calendar />,
  message: <Icons.message />
};


// ── Quick Action groups ────────────────────────────────────────────────────

const ACTION_GROUPS = [
  {
    groupLabel: 'Student Ops',
    actions: [
      { label: 'Add Student',      to: '/students/new',         color: 'var(--brand-600)', icon: ICONS.students },
      { label: 'Mark Attendance',  to: '/attendance',           color: '#0f766e',          icon: ICONS.clock },
      { label: 'Enter Marks',      to: '/marks',                color: '#0891b2',          icon: ICONS.marks },
    ],
  },
  {
    groupLabel: 'Financial',
    actions: [
      { label: 'Fee Structure',    to: '/fees',                 color: 'var(--success-600)', icon: ICONS.fees },
      { label: 'Fee Defaulters',   to: '/fees/defaulters',      color: 'var(--danger-600)',  icon: ICONS.alert },
    ],
  },
  {
    groupLabel: 'Reports',
    actions: [
      { label: 'Notifications',    to: '/admin/notifications',  color: '#7c3aed', icon: ICONS.report },
      { label: 'Reports',          to: '/reports',              color: '#b45309', icon: ICONS.report },
    ],
  },
]

const ADMIN_ACTIONS = ACTION_GROUPS.flatMap(g => g.actions)

const ADMIN_WORKFLOWS = [
  { key: 'today',    label: "Today's Work" },
  { key: 'students', label: 'Students' },
  { key: 'fees',     label: 'Fees' },
  { key: 'marks',    label: 'Marks' },
  { key: 'reports',  label: 'Reports' },
  { key: 'yearend',  label: 'Year-End' },
]

// ── Priority stripe colours ───────────────────────────────────────────────

const SEVERITY_BORDER = {
  error:   '#ef4444',
  danger:  '#ef4444',
  warning: '#f59e0b',
  info:    '#3b82f6',
}

// ── Enrollment bar colour by fill % ──────────────────────────────────────

function enrollmentBarColor(pct) {
  if (pct >= 90) return '#ef4444'   // near-full / full → red
  if (pct >= 70) return '#f59e0b'   // filling up → amber
  return '#14b8a6'                   // normal → teal
}

// ── Grouped Quick Actions ─────────────────────────────────────────────────

const QuickActionsGrouped = memo(function QuickActionsGrouped() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {ACTION_GROUPS.map((group, gi) => (
        <div key={group.groupLabel}>
          {gi > 0 && (
            <div style={{
              height: 1,
              background: 'var(--border-subtle)',
              margin: '0 0 16px',
            }} />
          )}
          <div style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            marginBottom: 8,
          }}>
            {group.groupLabel}
          </div>
          <div className="action-grid">
            {group.actions.map(action => (
              <Link
                key={action.label}
                to={action.to}
                className="action-tile"
                style={{ '--action-color': action.color }}
              >
                <span className="action-tile-icon">{action.icon}</span>
                <span className="action-tile-label">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
})

// ── Legacy flat action tiles (used for workflow sub-panels) ───────────────

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

// ── KPI Cards (memoised) ──────────────────────────────────────────────────

const KpiCards = memo(function KpiCards({ stats, loading }) {
  return (
    <div className="metric-grid">
      <MetricCard
        label="Total Students"
        value={(stats?.total_students ?? 0).toLocaleString()}
        sub="Active enrollments"
        color="#3b82f6"
        accentSide
        icon={ICONS.students}
        loading={loading}
      />
      <MetricCard
        label="Collected This Month"
        value={formatINR(stats?.fees_this_month ?? 0)}
        sub="Payments received"
        color="#22c55e"
        accentSide
        icon={ICONS.fees}
        loading={loading}
      />
      <MetricCard
        label="Outstanding Dues"
        value={formatINR(stats?.total_outstanding ?? 0)}
        sub="Total pending fees"
        color="#ef4444"
        accentSide
        icon={ICONS.clock}
        loading={loading}
      />
      <MetricCard
        label="Fee Defaulters"
        value={stats?.defaulter_count ?? 0}
        sub="Students with balance due"
        color="#f59e0b"
        accentSide
        icon={ICONS.alert}
        loading={loading}
      />
    </div>
  )
})

// ── Hero ──────────────────────────────────────────────────────────────────

function Hero({ title, copy, today, actions, attendanceSummary }) {
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

          {/* Separator */}
          <div style={{
            margin: '14px 0 0',
            height: 1,
            background: 'rgba(255,255,255,0.1)',
          }} />

          {/* Attendance donut chart */}
          <TodayAttendanceSummary
            present={attendanceSummary?.present ?? 0}
            absent={attendanceSummary?.absent ?? 0}
            not_marked={attendanceSummary?.not_marked ?? 0}
            total={attendanceSummary?.total ?? 0}
          />
        </div>
      </aside>
    </section>
  )
}

// ── Teacher Dashboard ─────────────────────────────────────────────────────

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
        attendanceSummary={null}
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

// ── Admin Dashboard ───────────────────────────────────────────────────────

export default function Dashboard() {
  const authUser = getAuthUser()
  const isTeacher = authUser?.role === 'teacher'
  const { selectedYearId, selectedYear } = useAcademicYear()
  const [selectedAttendanceClass, setSelectedAttendanceClass] = useState('All Classes')
  const [selectedExamName, setSelectedExamName] = useState(null)

  // 1. Fetch main dashboard stats
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

  // 2. Fetch teacher count dynamically via role counts
  const teachersQuery = useQuery({
    queryKey: ['admin-teachers-count', selectedYearId],
    enabled: !isTeacher && Boolean(selectedYearId),
    queryFn: async () => {
      const r = await adminAPI.listUsers({ page: 1, page_size: 1 })
      return r.data?.role_counts?.teacher || 1
    },
    staleTime: 60_000,
  })
  const teacherCount = teachersQuery.data ?? 1

  // 3. Fetch deduplicated exam names (one per exam type, not per class)
  const examNamesQuery = useQuery({
    queryKey: ['dashboard-exam-names', selectedYearId],
    enabled: !isTeacher && Boolean(selectedYearId),
    queryFn: async () => {
      const r = await marksAPI.getExamNames({ academic_year_id: selectedYearId })
      return r.data || []
    },
    staleTime: 60_000,
  })
  const examNames = examNamesQuery.data || []
  const activeExamName = selectedExamName || examNames[0] || null

  // 4. Fetch class performance for the selected exam name (all classes, one request)
  const classPerfQuery = useQuery({
    queryKey: ['dashboard-class-perf', selectedYearId, activeExamName],
    enabled: !isTeacher && Boolean(selectedYearId) && Boolean(activeExamName),
    queryFn: async () => {
      const r = await analyticsAPI.classPerformance({
        academic_year_id: selectedYearId,
        exam_name: activeExamName,
      })
      return r.data
    },
    staleTime: 60_000,
  })

  // Build display list from real API data — no hardcoded fallbacks
  const combinedPerformance = useMemo(() => {
    const classes = classPerfQuery.data?.classes
    if (!classes || classes.length === 0) return []

    return classes.map((item, idx) => {
      let displayName = item.class_name
      if (/^\d+$/.test(displayName)) {
        displayName = `Class ${displayName}`
      } else if (/^(nursery|lkg|ukg)$/i.test(displayName)) {
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase()
        if (displayName.toLowerCase() === 'nursery') displayName = 'Nursery'
      }
      return {
        name: displayName,
        value: item.avg_percentage,
        color: ['#3b82f6', '#60a5fa', '#10b981', '#f59e0b', '#8b5cf6'][idx % 5],
      }
    })
  }, [classPerfQuery.data])

  // Real school average from API — show '—' while loading or no data
  const realAvgMarks = useMemo(() => {
    if (classPerfQuery.isLoading) return '…'
    if (classPerfQuery.data?.school_average != null) {
      return `${classPerfQuery.data.school_average}%`
    }
    return '—'
  }, [classPerfQuery.data, classPerfQuery.isLoading])

  // Top performer class from API
  const topPerformerClass = useMemo(() => {
    const top = classPerfQuery.data?.top_class
    return { name: top ?? '—', value: null }
  }, [classPerfQuery.data])


  // 5. Fetch action queue / notification counts
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
      return {
        items,
        corrections: correctionCount,
        defaulters: stats?.defaulter_count || 0
      }
    },
    refetchInterval: 5 * 60 * 1000,
  })

  const loading = !isTeacher && (statsQuery.isLoading || statsQuery.isFetching)
  const error   = !isTeacher && statsQuery.isError

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })


  const attendanceTrendsQuery = useQuery({
    queryKey: ['dashboard-attendance-trends', selectedYearId, selectedAttendanceClass],
    enabled: !isTeacher && Boolean(selectedYearId),
    queryFn: async () => {
      const params = {}
      if (selectedAttendanceClass !== 'All Classes') {
        // Strip "Class " prefix so "Class 5" → "5" which matches Class.name in DB
        params.class_name = selectedAttendanceClass.replace(/^Class\s+/i, '')
      }
      const r = await analyticsAPI.attendanceTrends(params)
      return r.data || []
    },
    staleTime: 60_000,
  })

  // Map API response to chart format — null pct displayed as 0 bar with clear tooltip
  const realAttendanceTrends = useMemo(() => {
    if (!attendanceTrendsQuery.data || attendanceTrendsQuery.data.length === 0) return []
    return attendanceTrendsQuery.data.map(item => {
      const d = new Date(item.date + 'T00:00:00')
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' })
      const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      return {
        name: `${dayLabel} (${dateLabel})`,
        Percentage: item.attendance_pct,  // may be null — chart renders 0 bar
      }
    })
  }, [attendanceTrendsQuery.data])

  // 7. Compute academically sorted filter states for Attendance
  const attendanceClassesList = useMemo(() => {
    // class_counts now has one entry per class name (sections merged by backend).
    // class_name values are raw DB names: "nursery", "1", "lkg" etc.
    // Prefix numeric names with "Class " for display; keep nursery/lkg/ukg as-is humanized.
    const names = (stats?.class_counts || []).map(c => {
      const n = c.class_name
      if (/^\d+$/.test(n)) return `Class ${n}`
      const low = n.toLowerCase()
      if (low === 'nursery') return 'Nursery'
      if (low === 'lkg') return 'LKG'
      if (low === 'ukg') return 'UKG'
      return n
    })
    const sorted = sortClasses(names, c => c)
    return ['All Classes', ...sorted]
  }, [stats])


  const classFilteredStats = useMemo(() => {
    if (selectedAttendanceClass === 'All Classes' || !stats) {
      return {
        present: stats?.attendance_summary?.present ?? 0,
        absent: stats?.attendance_summary?.absent ?? 0,
        not_marked: stats?.attendance_summary?.not_marked ?? 0,
        total: stats?.attendance_summary?.total ?? 0,
      }
    }
    // Use the real attendance_summary (school-wide) — per-class breakdown
    // is not available from the summary endpoint; show school total when a
    // class filter is active (the bar chart is already scoped per-class)
    return {
      present: stats?.attendance_summary?.present ?? 0,
      absent: stats?.attendance_summary?.absent ?? 0,
      not_marked: stats?.attendance_summary?.not_marked ?? 0,
      total: stats?.attendance_summary?.total ?? 0,
    }
  }, [selectedAttendanceClass, stats])

  // Donut chart cell array
  const donutData = useMemo(() => {
    return [
      { name: 'Present', value: classFilteredStats.present, color: '#3b82f6' },
      { name: 'Absent', value: classFilteredStats.absent, color: '#ef4444' },
      { name: 'Not Marked', value: classFilteredStats.not_marked, color: '#94a3b8' },
    ]
  }, [classFilteredStats])


  if (isTeacher) return <TeacherDashboard today={today} />

  if (error) {
    return (
      <SectionPanel title="Could not load dashboard data" subtitle="The backend may be unreachable. Check that Docker is running.">
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </SectionPanel>
    )
  }

  // Format collection into clean string (e.g. ₹4.8L or similar)
  const formatCollectedAmt = (amt) => {
    if (amt >= 100000) {
      return `₹${(amt / 100000).toFixed(1)}L`
    }
    return formatINR(amt)
  }

  const collectedVal = stats?.fees_this_month ?? 0

  // 8 quick actions list (large SVGs width/height=28)
  const quickActionsList = [
    {
      label: "Today's Work",
      to: "/admin/users?tab=corrections",
      colorClass: "purple",
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      badge: actionQueueQuery.data?.corrections > 0 ? `${actionQueueQuery.data.corrections} pending` : null
    },
    {
      label: "Students",
      to: "/students",
      colorClass: "purple",
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9-5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        </svg>
      )
    },
    {
      label: "Fees",
      to: "/fees/defaulters",
      colorClass: "green",
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      badge: actionQueueQuery.data?.defaulters > 0 ? `${actionQueueQuery.data.defaulters} due` : null
    },
    {
      label: "Marks",
      to: "/marks",
      colorClass: "orange",
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    {
      label: "Reports",
      to: "/reports",
      colorClass: "blue",
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      )
    },
    {
      label: "Year End",
      to: "/yearend",
      colorClass: "purple",
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      label: "Schedule",
      to: "/yearend",
      colorClass: "cyan",
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      label: "Messages",
      to: "/admin/notifications",
      colorClass: "rose",
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      badge: "3 new"
    }
  ]

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      
      {/* 1. Top KPI Row */}
      <div className="premium-kpi-grid">
        
        {/* KPI 1: Total Students */}
        <div className="premium-kpi-card">
          <div className="premium-kpi-card-header">
            <div className="premium-kpi-icon-wrapper purple">
              <Icons.students />
            </div>
            <span className="premium-trend-badge up">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              +4.2%
            </span>
          </div>
          <div className="premium-kpi-body">
            <span className="premium-kpi-number">
              {loading ? "..." : (stats?.total_students ?? 1284).toLocaleString()}
            </span>
            <span className="premium-kpi-label">Total Students</span>
          </div>
        </div>
 
        {/* KPI 2: Total Teachers */}
        <div className="premium-kpi-card">
          <div className="premium-kpi-card-header">
            <div className="premium-kpi-icon-wrapper purple">
              <Icons.teachers />
            </div>
            <span className="premium-trend-badge up">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              +2
            </span>
          </div>
          <div className="premium-kpi-body">
            <span className="premium-kpi-number">
              {teachersQuery.isLoading ? "..." : teacherCount}
            </span>
            <span className="premium-kpi-label">Total Teachers</span>
          </div>
        </div>
 
        {/* KPI 3: Fees Collected */}
        <div className="premium-kpi-card">
          <div className="premium-kpi-card-header">
            <div className="premium-kpi-icon-wrapper green">
              <Icons.fees />
            </div>
            <span className="premium-trend-badge up">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              +11%
            </span>
          </div>
          <div className="premium-kpi-body">
            <span className="premium-kpi-number">
              {loading ? "..." : formatCollectedAmt(collectedVal)}
            </span>
            <span className="premium-kpi-label">Fees Collected</span>
          </div>
        </div>
 
        {/* KPI 4: Avg. Marks */}
        <div className="premium-kpi-card">
          <div className="premium-kpi-card-header">
            <div className="premium-kpi-icon-wrapper orange">
              <Icons.marks />
            </div>
            <span className="premium-trend-badge down">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              -1.2%
            </span>
          </div>
          <div className="premium-kpi-body">
            <span className="premium-kpi-number">{realAvgMarks}</span>
            <span className="premium-kpi-label">Avg. Marks</span>
          </div>
        </div>
 
      </div>
 
      {/* 2. Interactive Analytics Row */}
      <div className="premium-dashboard-row">
        
        {/* Attendance Overview Card */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="premium-card-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="premium-card-title">Attendance Overview</h2>
                <p className="premium-card-subtitle">Real records · {selectedAttendanceClass}</p>
              </div>
            </div>
            
            {/* Tabs for filtering classes */}
            <div className="class-selector-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 4px', width: '100%', marginTop: 2 }}>
              {attendanceClassesList.map(name => (
                <button 
                  key={name} 
                  className={`class-selector-tab ${selectedAttendanceClass === name ? 'active' : ''}`}
                  onClick={() => setSelectedAttendanceClass(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
 
          <div className="attendance-charts-container" style={{ marginTop: 6, gap: 16 }}>
            
            {/* Donut Chart with Legend Pills (Chart Sub-card for separation) */}
            <div className="chart-sub-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: '#f8fafc', border: '1px solid var(--border-default)', borderRadius: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Today's Distribution</span>
              <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
                <PieChart width={140} height={140}>
                  <Pie
                    data={donutData}
                    cx={70}
                    cy={70}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                
                {/* Center Percentage Display */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {classFilteredStats.total > 0 
                      ? `${Math.round((classFilteredStats.present / classFilteredStats.total) * 100)}%` 
                      : '0%'}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Present
                  </span>
                </div>
              </div>
 
              {/* Attendance Breakdown Pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="attendance-pill present" style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
                  <span><span className="attendance-dot present"></span>Present</span>
                  <span className="attendance-pill-value">{classFilteredStats.present.toLocaleString()}</span>
                </div>
                <div className="attendance-pill absent" style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
                  <span><span className="attendance-dot absent"></span>Absent</span>
                  <span className="attendance-pill-value">{classFilteredStats.absent.toLocaleString()}</span>
                </div>
                <div className="attendance-pill not-marked" style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
                  <span><span className="attendance-dot not-marked"></span>Not Marked</span>
                  <span className="attendance-pill-value">{classFilteredStats.not_marked.toLocaleString()}</span>
                </div>
              </div>
            </div>
 
            {/* Weekly Attendance Bar Chart (Chart Sub-card for separation) */}
            <div className="chart-sub-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: '#f8fafc', border: '1px solid var(--border-default)', borderRadius: 12, flexGrow: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Daily Attendance Rate (%)</span>
              <div style={{ width: '100%', height: '100%', minHeight: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={realAttendanceTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      formatter={(value) => [`${value}%`, 'Attendance']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                    />
                    <Bar dataKey="Percentage" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
 
          </div>
        </div>
 
        {/* Class Performance Card */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="premium-card-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="premium-card-title">Class Performance</h2>
              <p className="premium-card-subtitle" style={{ fontSize: 12 }}>
                {activeExamName || 'Select Exam'}
              </p>
            </div>
            <select
              className="input"
              style={{ width: 'auto', fontSize: 12, padding: '4px 8px', height: 'auto', minHeight: 'auto' }}
              value={activeExamName || ''}
              onChange={(e) => setSelectedExamName(e.target.value)}
            >
              {examNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            {/* Scrollable container for class list */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    paddingRight: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
              {classPerfQuery.isLoading ? (
                [1,2,3,4,5].map(i => <div key={i} style={{ height: 18, background: '#f1f5f9', borderRadius: 4 }} />)
              ) : combinedPerformance.length === 0 ? (
                <EmptyState icon={ICONS.marks} title="No marks entered" description={activeExamName ? `No results for ${activeExamName} yet.` : 'Select an exam above.'} />
              ) : (
                combinedPerformance.map((row) => (
                  <div key={row.name} className="class-perf-row" style={{ margin: 0 }}>
                    <span className="class-perf-name" style={{ fontSize: 13, width: 70 }}>{row.name}</span>
                    <div className="class-perf-bar-wrapper" style={{ height: 6 }}>
                      <div className="class-perf-bar-fill" style={{ width: `${row.value}%`, backgroundColor: row.color }} />
                    </div>
                    <span className="class-perf-value" style={{ fontSize: 12.5, width: 35 }}>{row.value}%</span>
                  </div>
                ))
              )}
            </div>
 
            <div className="perf-callouts" style={{ marginTop: 14, gap: 10 }}>
              <div className="perf-callout-box purple" style={{ padding: 10, borderRadius: 10 }}>
                <span className="perf-callout-value" style={{ fontSize: 18 }}>{realAvgMarks}</span>
                <span className="perf-callout-label" style={{ fontSize: 10 }}>School Average</span>
              </div>
              <div className="perf-callout-box green" style={{ padding: 10, borderRadius: 10 }}>
                <span className="perf-callout-value" style={{ fontSize: 18 }}>{topPerformerClass.name}</span>
                <span className="perf-callout-label" style={{ fontSize: 10 }}>Top Performer</span>
              </div>
            </div>
          </div>
        </div>
 
      </div>
 
      {/* 3. Quick Actions Grid */}
      <div className="premium-card" style={{ padding: 14 }}>
        <div className="premium-card-header" style={{ marginBottom: 12 }}>
          <h2 className="premium-card-title">Quick Actions</h2>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-tertiary)' }}>{today}</span>
        </div>
 
        <div className="actions-grid-premium">
          {quickActionsList.map((action) => (
            <Link key={action.label} to={action.to} className="action-card-premium">
              {action.badge && <span className="action-card-badge">{action.badge}</span>}
              <div className={`action-card-icon-circle ${action.colorClass}`}>
                {action.icon}
              </div>
              <span className="action-card-label-premium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
 
    </div>
  )
}


