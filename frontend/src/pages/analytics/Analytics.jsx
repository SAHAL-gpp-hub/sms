import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { analyticsAPI, formatINR, marksAPI, setupAPI } from '../../services/api'
import { EmptyState, MetricCard, SectionPanel, Skeleton } from '../../components/UI'

const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#9333ea', '#0ea5e9', '#14b8a6', '#64748b']

function ChartShell({ loading, empty, children }) {
  if (loading) return <Skeleton height="260px" />
  if (empty) return <EmptyState title="No data found" description="Try adjusting selected year or exam." />
  return children
}

export default function Analytics() {
  const [months, setMonths] = useState(12)
  const [attendanceMonths, setAttendanceMonths] = useState(3)
  const [riskThreshold, setRiskThreshold] = useState(75)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedExamClassId, setSelectedExamClassId] = useState('')

  const yearsQuery = useQuery({
    queryKey: ['analytics-years'],
    queryFn: async () => (await setupAPI.getAcademicYears()).data || [],
  })
  const years = yearsQuery.data || []
  const defaultYearId = years.find(y => y.is_current)?.id || years[0]?.id || null
  const [academicYearId, setAcademicYearId] = useState(null)
  const activeYearId = academicYearId || defaultYearId

  const classesQuery = useQuery({
    queryKey: ['analytics-classes', activeYearId],
    enabled: !!activeYearId,
    queryFn: async () => (await setupAPI.getClasses(activeYearId)).data || [],
  })
  const examsQuery = useQuery({
    queryKey: ['analytics-exams', activeYearId, selectedExamClassId],
    enabled: !!activeYearId,
    queryFn: async () => (await marksAPI.getExams({
      academic_year_id: activeYearId,
      class_id: selectedExamClassId || undefined,
    })).data || [],
  })
  const examOptions = useMemo(() => examsQuery.data || [], [examsQuery.data])
  const [examId, setExamId] = useState(null)
  const classLabelById = useMemo(() => {
    const map = {}
    ;(classesQuery.data || []).forEach(cls => {
      map[String(cls.id)] = `${cls.name}${cls.division ? `-${cls.division}` : ''}`
    })
    return map
  }, [classesQuery.data])
  const visibleExamOptions = useMemo(() => (
    examOptions.map(exam => ({
      ...exam,
      label: selectedExamClassId
        ? exam.name
        : `${exam.name}${classLabelById[String(exam.class_id)] ? ` — Class ${classLabelById[String(exam.class_id)]}` : ''}`,
    }))
  ), [examOptions, classLabelById, selectedExamClassId])
  const activeExamId = examOptions.some(exam => exam.id === examId)
    ? examId
    : (examOptions[0]?.id || null)

  const feeQuery = useQuery({
    queryKey: ['analytics-fee', activeYearId, months],
    enabled: !!activeYearId,
    queryFn: async () => (await analyticsAPI.feeCollection({ academic_year_id: activeYearId, months })).data,
  })

  const classPerfQuery = useQuery({
    queryKey: ['analytics-class-performance', activeYearId, activeExamId],
    enabled: !!activeYearId && !!activeExamId,
    queryFn: async () =>
      (await analyticsAPI.classPerformance({ academic_year_id: activeYearId, exam_id: activeExamId })).data || [],
  })

  const gradeQuery = useQuery({
    queryKey: ['analytics-grade-distribution', activeYearId, activeExamId],
    enabled: !!activeYearId && !!activeExamId,
    queryFn: async () =>
      (await analyticsAPI.gradeDistribution({ academic_year_id: activeYearId, exam_id: activeExamId })).data || [],
  })

  const attendanceQuery = useQuery({
    queryKey: ['analytics-attendance-trends', attendanceMonths, selectedClassId],
    queryFn: async () =>
      (await analyticsAPI.attendanceTrends({
        months: attendanceMonths,
        class_id: selectedClassId || undefined,
      })).data || [],
  })

  const topStudentsQuery = useQuery({
    queryKey: ['analytics-top-students', activeExamId],
    enabled: !!activeExamId,
    queryFn: async () => (await analyticsAPI.topStudents({ exam_id: activeExamId, limit: 10 })).data || [],
  })

  const atRiskQuery = useQuery({
    queryKey: ['analytics-at-risk', riskThreshold, activeYearId],
    enabled: !!activeYearId,
    queryFn: async () =>
      (await analyticsAPI.atRiskAttendance({
        threshold: riskThreshold,
        academic_year_id: activeYearId,
      })).data,
  })

  const feeTrend = feeQuery.data?.trend || []
  const feeSummary = feeQuery.data?.summary || {}
  const classPerformance = classPerfQuery.data || []
  const attendanceTrend = attendanceQuery.data || []
  const topStudents = topStudentsQuery.data || []
  const atRiskStudents = atRiskQuery.data?.students || []

  const pieData = useMemo(
    () =>
      (gradeQuery.data || []).map((item, idx) => ({
        ...item,
        fill: CHART_COLORS[idx % CHART_COLORS.length],
      })),
    [gradeQuery.data],
  )

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SectionPanel
        title="Analytics Dashboard"
        subtitle="School-wide finance, academics, and attendance insights."
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="input" value={activeYearId || ''} onChange={e => setAcademicYearId(Number(e.target.value) || null)}>
              {years.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}
            </select>
            <select className="input" value={selectedExamClassId} onChange={e => setSelectedExamClassId(e.target.value)}>
              <option value="">All classes</option>
              {(classesQuery.data || []).map(cls => (
                <option key={cls.id} value={cls.id}>
                  Class {cls.name}{cls.division ? `-${cls.division}` : ''}
                </option>
              ))}
            </select>
            <select className="input" value={activeExamId || ''} onChange={e => setExamId(Number(e.target.value) || null)}>
              {visibleExamOptions.map(exam => <option key={exam.id} value={exam.id}>{exam.label}</option>)}
            </select>
          </div>
        )}
      >
        <div className="metric-grid">
          <MetricCard label="Collection Rate" value={`${(feeSummary.collection_rate || 0).toFixed(1)}%`} sub="Current year" color="var(--brand-600)" />
          <MetricCard label="Total Collected" value={formatINR(feeSummary.total_collected || 0)} sub="Current year" color="var(--success-600)" />
          <MetricCard label="Outstanding" value={formatINR(feeSummary.outstanding || 0)} sub="Pending dues" color="var(--danger-600)" />
          <MetricCard label="At-Risk Attendance" value={atRiskQuery.data?.count || 0} sub="This month" color="var(--warning-600)" />
        </div>
      </SectionPanel>

      <div className="dashboard-grid">
        <SectionPanel title="Monthly Fee Collection" subtitle="Last N months">
          <div style={{ marginBottom: 8 }}>
            <select className="input" value={months} onChange={e => setMonths(Number(e.target.value))}>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={18}>Last 18 months</option>
            </select>
          </div>
          <ChartShell loading={feeQuery.isLoading} empty={!feeTrend.length}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={feeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="collected" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartShell>
        </SectionPanel>

        <SectionPanel title="Class Performance" subtitle="Average exam percentage by class">
          <ChartShell loading={classPerfQuery.isLoading} empty={!classPerformance.length}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={classPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg_percentage" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>
        </SectionPanel>
      </div>

      <div className="dashboard-grid">
        <SectionPanel title="Grade Distribution" subtitle="School-wide grade count">
          <ChartShell loading={gradeQuery.isLoading} empty={!pieData.length}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie data={pieData} dataKey="count" nameKey="grade" outerRadius={90} />
              </PieChart>
            </ResponsiveContainer>
          </ChartShell>
        </SectionPanel>

        <SectionPanel title="Attendance Trends" subtitle="Daily attendance percentage">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select className="input" value={attendanceMonths} onChange={e => setAttendanceMonths(Number(e.target.value))}>
              <option value={1}>1 month</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
            </select>
            <select className="input" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
              <option value="">All classes</option>
              {(classesQuery.data || []).map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}{cls.division ? `-${cls.division}` : ''}</option>
              ))}
            </select>
          </div>
          <ChartShell loading={attendanceQuery.isLoading} empty={!attendanceTrend.length}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="attendance_pct" fill="#93c5fd" stroke="#2563eb" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartShell>
        </SectionPanel>
      </div>

      <div className="dashboard-grid">
        <SectionPanel title="Top Students" subtitle="By total marks for selected exam">
          {topStudentsQuery.isLoading ? (
            <Skeleton height="220px" />
          ) : !topStudents.length ? (
            <EmptyState title="No ranking data" description="No marks found for selected exam." />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {topStudents.map((item, idx) => (
                <div key={`${item.student_id}-${idx}`} className="list-row">
                  <div>
                    <div className="list-row-title">{item.student_name}</div>
                    <div className="list-row-meta">Grade {item.grade} · {item.percentage}%</div>
                  </div>
                  <strong>{item.total_marks}</strong>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel title="At-Risk Attendance" subtitle="Students below threshold this month">
          <div style={{ marginBottom: 8 }}>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              value={riskThreshold}
              onChange={e => setRiskThreshold(Number(e.target.value) || 0)}
            />
          </div>
          {atRiskQuery.isLoading ? (
            <Skeleton height="220px" />
          ) : !atRiskStudents.length ? (
            <EmptyState title="No at-risk students" description="Everyone is above the current threshold." />
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 280, overflow: 'auto' }}>
              {atRiskStudents.slice(0, 25).map((item, idx) => (
                <div key={`${item.student_id}-${idx}`} className="list-row">
                  <div>
                    <div className="list-row-title">{item.student_name}</div>
                    <div className="list-row-meta">{item.class_name}</div>
                  </div>
                  <strong style={{ color: 'var(--danger-600)' }}>{item.attendance_pct}%</strong>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </div>
  )
}
