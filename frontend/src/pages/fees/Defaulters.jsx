// Defaulters.jsx — Fully responsive with mobile card view
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { feeAPI, setupAPI, formatINR, openSignedPdf } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton } from '../../components/UI'
import { useAcademicYear } from '../../contexts/academicYearContext'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

function DefaulterCard({ d, resolveClassName }) {
  const balancePct = d.total_due > 0 ? Math.min(((d.balance / d.total_due) * 100), 100).toFixed(0) : 0
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border-default)',
      borderRadius: '12px',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.student_name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {resolveClassName(d.class_id)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--danger-600)', letterSpacing: '-0.02em' }}>
            ₹{(d.balance || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--danger-500)', fontWeight: 600 }}>balance due</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Paid: ₹{(d.total_paid || 0).toLocaleString('en-IN')} of ₹{(d.total_due || 0).toLocaleString('en-IN')}</span>
          <span style={{ fontSize: '11px', color: 'var(--danger-500)', fontWeight: 700 }}>{balancePct}% unpaid</span>
        </div>
        <div style={{ height: '5px', background: 'var(--danger-100)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${100 - balancePct}%`, background: 'var(--success-500)', borderRadius: '3px' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
        <span className="mono" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{d.contact}</span>
        <Link
          to={`/fees/student/${d.student_id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, color: 'var(--brand-700)', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', textDecoration: 'none', touchAction: 'manipulation' }}
        >
          View Ledger →
        </Link>
      </div>
    </div>
  )
}

// KPI summary card shown under the filter row (for "All Classes" view)
function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border-default)',
      borderRadius: '14px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: 'var(--shadow-xs)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '4px',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        background: accent,
      }} />
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${accent}1A`,
        color: accent,
        flexShrink: 0,
        marginLeft: '6px',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '3px' }}>
          {label}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 600 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiSection({ defaulters, totalCollected, totalBalance, totalOutstanding }) {
  const collectionRatio = (totalCollected + totalBalance) > 0
    ? ((totalCollected / (totalCollected + totalBalance)) * 100).toFixed(1)
    : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '20px' }}>
      <KpiCard
        label="Total Defaulters"
        value={defaulters.length}
        sub="students with dues"
        accent="#dc2626"
        icon={
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        }
      />
      <KpiCard
        label="Outstanding"
        value={formatINR(totalBalance)}
        sub="yet to be collected"
        accent="#ea580c"
        icon={
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-6a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      />
      <KpiCard
        label="Collected"
        value={formatINR(totalCollected)}
        sub="received so far"
        accent="#16a34a"
        icon={
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      />
      <KpiCard
        label="Total Billed"
        value={formatINR(totalOutstanding)}
        sub="across all defaulters"
        accent="#6366f1"
        icon={
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-9m-2 9h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v9a2 2 0 002 2z" /></svg>
        }
      />
      <KpiCard
        label="Collection Ratio"
        value={`${collectionRatio}%`}
        sub="of total billed"
        accent="#0891b2"
        icon={
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
        }
      />
    </div>
  )
}

function ChartsSection({
  monthlyData,
  monthlyLoading,
  selectedMonth,
  setSelectedMonth,
  byClass,
  donutData,
  totalCollected,
  totalBalance
}) {
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  const totalBilled = totalCollected + totalBalance
  const collectionRatio = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : 0

  const COLORS = ['#16a34a', '#dc2626']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
      {/* Chart 1: Area Chart (Full Width) */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Monthly Collections (Daily)</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Daily collections for the selected month</p>
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              background: 'var(--surface-0)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div style={{ height: '300px', width: '100%' }}>
          {monthlyLoading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="skeleton" style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
            </div>
          ) : monthlyData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              No payments recorded in this month.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(val) => `₹${val}`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Collected']}
                  contentStyle={{ background: 'var(--surface-0)', border: '1px solid var(--border-default)', borderRadius: '10px', fontSize: '12px', boxShadow: 'var(--shadow-md)' }}
                  cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fill="url(#collectedGradient)"
                  dot={{ r: 3, fill: '#4f46e5', strokeWidth: 2, stroke: 'var(--surface-0)' }}
                  activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: 'var(--surface-0)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row for Chart 2 & Chart 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Chart 2: Horizontal Stacked Bar Chart */}
        <div className="card" style={{ padding: '20px', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Outstanding by Class</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Collected vs Outstanding per class</p>
          </div>
          <div style={{ flex: 1, height: '100%', minHeight: '250px' }}>
            {byClass.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                No class fee records.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byClass} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barCategoryGap="28%">
                  <defs>
                    <linearGradient id="collectedBarGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="outstandingBarGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={(val) => `₹${val}`} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={80} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value, name) => [`₹${value.toLocaleString('en-IN')}`, name]}
                    contentStyle={{ background: 'var(--surface-0)', border: '1px solid var(--border-default)', borderRadius: '10px', fontSize: '12px', boxShadow: 'var(--shadow-md)' }}
                    cursor={{ fill: 'var(--border-subtle)', opacity: 0.4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Bar dataKey="Collected" stackId="a" fill="url(#collectedBarGradient)" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="Outstanding" stackId="a" fill="url(#outstandingBarGradient)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Donut Chart for Collection Ratio */}
        <div className="card" style={{ padding: '20px', minHeight: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', alignSelf: 'flex-start', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Overall Collection Ratio</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Ratio of collected to outstanding fees</p>
          </div>

          <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: '100%', height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="collectedSliceGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                    <linearGradient id="outstandingSliceGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                    cornerRadius={6}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'url(#collectedSliceGradient)' : 'url(#outstandingSliceGradient)'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                    contentStyle={{ background: 'var(--surface-0)', border: '1px solid var(--border-default)', borderRadius: '10px', fontSize: '12px', boxShadow: 'var(--shadow-md)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {collectionRatio}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Collected
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '16px', justifyContent: 'center', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Collected: ₹{totalCollected.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(135deg, #f87171, #dc2626)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Outstanding: ₹{totalBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Defaulters() {
  const { selectedYearId, selectedYear, years } = useAcademicYear()
  const [classes, setClasses]       = useState([])
  const [classFilter, setClassFilter] = useState('')
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 640)
  const yearFilter = selectedYearId || ''

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!selectedYearId) return
    setupAPI.getClasses(selectedYearId).then(r => setClasses(r.data))
  }, [selectedYearId])

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const isAllClasses = !classFilter

  const defaultersQuery = useQuery({
    queryKey: ['defaulters', classFilter, yearFilter],
    queryFn: async () => {
      const params = {}
      if (classFilter) params.class_id = classFilter
      if (yearFilter) params.academic_year_id = yearFilter
      const r = await feeAPI.getDefaulters(params)
      return r.data || []
    },
  })

  const monthlyQuery = useQuery({
    queryKey: ['monthly-collections', yearFilter, selectedMonth],
    queryFn: () => feeAPI.getMonthlyCollections({
      month: selectedMonth,
      ...(yearFilter ? { academic_year_id: yearFilter } : {}),
    }).then(r => r.data || []),
    enabled: isAllClasses,
  })

  useEffect(() => {
    if (defaultersQuery.isError) toast.error('Failed to load defaulters')
  }, [defaultersQuery.isError])

  useEffect(() => {
    if (monthlyQuery.isError) toast.error('Failed to load monthly collections')
  }, [monthlyQuery.isError])

  const defaulters = defaultersQuery.data || []
  const loading = defaultersQuery.isLoading || defaultersQuery.isFetching

  const resolveClassName = (classId) => {
    const cls = classes.find(c => c.id === classId)
    return cls ? `Class ${cls.name} — ${cls.division}` : `Class ${classId}`
  }

  const totalBalance    = defaulters.reduce((s, d) => s + (d.balance || 0), 0)
  const totalOutstanding = defaulters.reduce((s, d) => s + (d.total_due || 0), 0)
  const totalCollected  = defaulters.reduce((s, d) => s + (d.total_paid || 0), 0)

  const byClass = Object.values(
    defaulters.reduce((acc, d) => {
      const k = d.class_name || `Cls ${d.class_id}`
      if (!acc[k]) acc[k] = { name: k, Collected: 0, Outstanding: 0 }
      acc[k].Collected   += d.total_paid
      acc[k].Outstanding += d.balance
      return acc
    }, {})
  ).sort((a, b) => b.Outstanding - a.Outstanding)

  const donutData = [
    { name: 'Collected',   value: totalCollected   },
    { name: 'Outstanding', value: totalBalance },
  ]

  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const yearOptions  = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))
  const selectedClassLabel = classFilter ? classOptions.find(c => c.value === classFilter)?.label : 'All Classes'
  const selectedYearLabel = yearFilter ? yearOptions.find(y => y.value === yearFilter)?.label : 'All Years'
  const exportParams = {
    ...(classFilter ? { class_id: classFilter } : {}),
    ...(yearFilter ? { academic_year_id: yearFilter } : {}),
  }

  const handleExportPdf = () => {
    const confirmed = window.confirm(
      `Exporting ${defaulters.length} defaulter${defaulters.length !== 1 ? 's' : ''}\n` +
      `${selectedClassLabel || 'All Classes'} · ${selectedYearLabel || 'All Years'}\n` +
      `Outstanding: ${formatINR(totalBalance)}`
    )
    if (!confirmed) return
    openSignedPdf('/pdf/token/report/defaulters', '/pdf/report/defaulters', exportParams)
      .catch(() => toast.error('Could not prepare defaulters PDF'))
  }

  return (
    <div>
      <PageHeader
        title="Fee Defaulters"
        subtitle={`Students with outstanding fee balance for ${selectedYear?.label || 'the selected academic year'}`}
        actions={
          defaulters.length > 0 && (
            <button
              onClick={handleExportPdf}
              className="btn btn-secondary"
              style={{ textDecoration: 'none', fontSize: '13px' }}
            >
              PDF Report
            </button>
          )
        }
      />

      <FilterRow>
        <Select value={classFilter} onChange={e => setClassFilter(e.target.value)} options={classOptions} placeholder="All Classes" style={{ flex: 1, minWidth: '150px' }} />
        <Select value={yearFilter}  onChange={() => {}}  options={yearOptions}  placeholder="All Years" disabled style={{ flex: 1, minWidth: '150px' }} />
        {(classFilter || yearFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setClassFilter('')}>Clear</button>
        )}
      </FilterRow>

      {!loading && defaulters.length > 0 && (
        <KpiSection
          defaulters={defaulters}
          totalCollected={totalCollected}
          totalBalance={totalBalance}
          totalOutstanding={totalOutstanding}
        />
      )}

      {isAllClasses ? (
        <ChartsSection
          monthlyData={monthlyQuery.data || []}
          monthlyLoading={monthlyQuery.isLoading || monthlyQuery.isFetching}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          byClass={byClass}
          donutData={donutData}
          totalCollected={totalCollected}
          totalBalance={totalBalance}
        />
      ) : (
        <>
          {/* Export summary banner */}
          {!loading && defaulters.length > 0 && (
            <div style={{
              marginBottom: '14px',
              padding: '10px 12px',
              border: '1px solid var(--border-default)',
              borderRadius: '10px',
              background: 'var(--surface-0)',
              color: 'var(--text-secondary)',
              fontSize: '12.5px',
              fontWeight: 600,
            }}>
              PDF export will include exactly: {selectedClassLabel || 'All Classes'} · {selectedYearLabel || 'All Years'} · {defaulters.length} defaulter{defaulters.length !== 1 ? 's' : ''}.
            </div>
          )}

          {/* Mobile: cards */}
          {isMobile ? (
            <div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span className="skeleton" style={{ display: 'block', height: '16px', width: '60%', borderRadius: '6px' }} />
                      <span className="skeleton" style={{ display: 'block', height: '12px', width: '40%', borderRadius: '6px' }} />
                      <span className="skeleton" style={{ display: 'block', height: '8px', borderRadius: '6px' }} />
                    </div>
                  ))}
                </div>
              ) : defaulters.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    title="No defaulters found!"
                    description="All fees are cleared for the selected filters."
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {defaulters.map((d, i) => (
                    <DefaulterCard key={d.student_id} d={d} index={i} resolveClassName={resolveClassName} />
                  ))}
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '6px 0' }}>
                    {defaulters.length} defaulter{defaulters.length !== 1 ? 's' : ''} · Outstanding: <strong style={{ color: 'var(--danger-600)' }}>{formatINR(totalBalance)}</strong>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Desktop: table */
            <div className="card">
              {loading ? (
                <table className="data-table"><TableSkeleton rows={6} cols={7} /></table>
              ) : defaulters.length === 0 ? (
                <EmptyState
                  icon={<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  title="No defaulters found!"
                  description="All fees are cleared for the selected filters."
                />
              ) : (
                <>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="data-table" style={{ minWidth: '600px' }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Student Name</th>
                          <th>Class</th>
                          <th>Contact</th>
                          <th>Total Due</th>
                          <th>Paid</th>
                          <th>Balance</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {defaulters.map((d, i) => {
                          const balancePct = d.total_due > 0 ? ((d.balance / d.total_due) * 100).toFixed(0) : 0
                          return (
                            <tr key={d.student_id}>
                              <td style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px' }}>{i + 1}</td>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.student_name}</td>
                              <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{resolveClassName(d.class_id)}</td>
                              <td><span className="mono" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{d.contact}</span></td>
                              <td style={{ fontWeight: 600 }}>₹{(d.total_due || 0).toLocaleString('en-IN')}</td>
                              <td style={{ color: 'var(--success-700)', fontWeight: 600 }}>₹{(d.total_paid || 0).toLocaleString('en-IN')}</td>
                              <td>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--danger-600)' }}>₹{(d.balance || 0).toLocaleString('en-IN')}</div>
                                  <div style={{ marginTop: '3px', height: '4px', background: 'var(--danger-100)', borderRadius: '2px', width: '70px' }}>
                                    <div style={{ height: '100%', background: 'var(--danger-500)', borderRadius: '2px', width: `${balancePct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Link to={`/fees/student/${d.student_id}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, color: 'var(--brand-700)', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', textDecoration: 'none' }}>
                                  Ledger →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {defaulters.length} defaulter{defaulters.length !== 1 ? 's' : ''} · Outstanding: <strong style={{ color: 'var(--danger-600)' }}>{formatINR(totalBalance)}</strong>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}