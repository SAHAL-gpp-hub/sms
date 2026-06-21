// Defaulters.jsx — Chart view (All Classes) + Table view (specific class)
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import { feeAPI, setupAPI, formatINR, openSignedPdf } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton } from '../../components/UI'
import { useAcademicYear } from '../../contexts/academicYearContext'

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DONUT_COLORS = ['#22c55e', '#ef4444']
const CLASS_BAR_COLLECTED = '#3b82f6'
const CLASS_BAR_OUTSTANDING = '#fca5a5'
const MONTH_LINE_COLOR = '#6366f1'

function fmtINR(v) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v}`
}
function classDisplayName(name) {
  const l = name?.toLowerCase()
  if (l === 'nursery') return 'Nursery'
  if (l === 'lkg')     return 'LKG'
  if (l === 'ukg')     return 'UKG'
  return `Class ${name}`
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border-default)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {formatINR ? formatINR(p.value) : fmtINR(p.value)}
        </div>
      ))}
    </div>
  )
}

// ─── mobile card ────────────────────────────────────────────────────────────

function DefaulterCard({ d, resolveClassName }) {
  const balancePct = d.total_due > 0
    ? Math.min(((d.balance / d.total_due) * 100), 100).toFixed(0)
    : 0
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border-default)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {d.student_name}
          </div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>
            {resolveClassName(d.class_id)}
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--danger-600)', letterSpacing:'-0.02em' }}>
            ₹{(d.balance||0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize:10, color:'var(--danger-500)', fontWeight:600 }}>balance due</div>
        </div>
      </div>

      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>
            Paid: ₹{(d.total_paid||0).toLocaleString('en-IN')} of ₹{(d.total_due||0).toLocaleString('en-IN')}
          </span>
          <span style={{ fontSize:11, color:'var(--danger-500)', fontWeight:700 }}>{balancePct}% unpaid</span>
        </div>
        <div style={{ height:5, background:'var(--danger-100)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${100-balancePct}%`, background:'var(--success-500)', borderRadius:3 }} />
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:4, borderTop:'1px solid var(--border-subtle)' }}>
        <span className="mono" style={{ fontSize:12, color:'var(--text-tertiary)' }}>{d.contact}</span>
        <Link
          to={`/fees/student/${d.student_id}`}
          style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:7, fontSize:12, fontWeight:600, color:'var(--brand-700)', background:'var(--brand-50)', border:'1px solid var(--brand-200)', textDecoration:'none', touchAction:'manipulation' }}
        >
          View Ledger →
        </Link>
      </div>
    </div>
  )
}

// ─── chart section (shown when "All Classes" selected) ───────────────────────

function ChartsSection({ defaulters, monthlyData, selectedMonth, onMonthChange, loading, classes, isMobile = false }) {
  // --- Group by class name only (no division) ---
  const byClass = Object.values(
    defaulters.reduce((acc, d) => {
      const cls = classes.find(c => c.id === d.class_id)
      const k = cls ? classDisplayName(cls.name) : `Class ${d.class_id}`
      if (!acc[k]) acc[k] = { name: k, Collected: 0, Outstanding: 0 }
      acc[k].Collected   += d.total_paid
      acc[k].Outstanding += d.balance
      return acc
    }, {})
  ).sort((a, b) => (b.Outstanding - a.Outstanding))

  // --- Donut ---
  const totalCollected   = defaulters.reduce((s, d) => s + (d.total_paid || 0), 0)
  const totalOutstanding = defaulters.reduce((s, d) => s + (d.balance   || 0), 0)
  const donutData = [
    { name: 'Collected',   value: totalCollected   },
    { name: 'Outstanding', value: totalOutstanding },
  ]

  const cardStyle = {
    background: 'var(--surface-0)',
    border: '1px solid var(--border-default)',
    borderRadius: 12,
    padding: '16px 18px',
  }
  const titleStyle = {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-tertiary)',
    marginBottom: 12,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Row 1: Monthly Collections (full width) */}
      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={titleStyle}>Monthly Fee Collections</div>
          <select
            value={selectedMonth}
            onChange={e => onMonthChange(Number(e.target.value))}
            style={{
              fontSize:12, fontWeight:600,
              border:'1px solid var(--border-default)',
              borderRadius:6, padding:'4px 8px',
              background:'var(--surface-1)',
              color:'var(--text-primary)',
              cursor:'pointer',
            }}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-tertiary)', fontSize:13 }}>
            Loading…
          </div>
        ) : monthlyData.length === 0 ? (
          <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-tertiary)', fontSize:13 }}>
            No payment data for {MONTHS[selectedMonth - 1]}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData} margin={{ top:4, right:16, left:0, bottom:0 }}>
              <defs>
                <linearGradient id="collectGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={MONTH_LINE_COLOR} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={MONTH_LINE_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize:11, fill:'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={fmtINR}
                tick={{ fontSize:11, fill:'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="collected"
                name="Collected"
                stroke={MONTH_LINE_COLOR}
                strokeWidth={2.5}
                fill="url(#collectGrad)"
                dot={{ r:3, fill:MONTH_LINE_COLOR }}
                activeDot={{ r:5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 2: stacked on mobile, side-by-side on desktop */}
      <div style={{
        display:'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 280px',
        gap:14,
      }}>

        {/* Stacked bar */}
        <div style={cardStyle}>
          <div style={titleStyle}>Outstanding by Class</div>
          {byClass.length === 0 ? (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-tertiary)', fontSize:13 }}>
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, byClass.length * 32 + 40)}>
              <BarChart data={byClass} layout="vertical" margin={{ top:0, right:16, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={fmtINR}
                  tick={{ fontSize:11, fill:'var(--text-tertiary)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize:11, fill:'var(--text-primary)', fontWeight:600 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize:11, paddingTop:8 }}
                />
                <Bar dataKey="Collected"   stackId="a" fill={CLASS_BAR_COLLECTED}   radius={[0,0,0,0]} barSize={16} />
                <Bar dataKey="Outstanding" stackId="a" fill={CLASS_BAR_OUTSTANDING} radius={[0,4,4,0]} barSize={16} />

              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut */}
        <div style={{ ...cardStyle, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ ...titleStyle, textAlign:'center' }}>Collection Ratio</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                minAngle={4}
                labelLine={false}
                label={({ cx, cy }) => (
                  totalCollected + totalOutstanding > 0 ? (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={cx} dy="-8" fontSize="16" fontWeight="800" fill="var(--success-600)">
                        {((totalCollected / (totalCollected + totalOutstanding)) * 100).toFixed(1)}%
                      </tspan>
                      <tspan x={cx} dy="20" fontSize="10" fontWeight="600" fill="var(--text-tertiary)">
                        collected
                      </tspan>
                    </text>
                  ) : null
                )}
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtINR(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:16, marginTop:4 }}>
            {donutData.map((d, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:DONUT_COLORS[i], flexShrink:0 }} />
                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Defaulters() {
  const { selectedYearId, selectedYear, years } = useAcademicYear()
  const [classes, setClasses]             = useState([])
  const [classFilter, setClassFilter]     = useState('')
  const [isMobile, setIsMobile]           = useState(window.innerWidth < 640)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  const yearFilter   = selectedYearId || ''
  const isAllClasses = !classFilter

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  useEffect(() => {
    if (!selectedYearId) return
    setupAPI.getClasses(selectedYearId).then(r => setClasses(r.data))
  }, [selectedYearId])

  // Defaulters data
  const defaultersQuery = useQuery({
    queryKey: ['defaulters', classFilter, yearFilter],
    queryFn: async () => {
      const params = {}
      if (classFilter) params.class_id = classFilter
      if (yearFilter)  params.academic_year_id = yearFilter
      const r = await feeAPI.getDefaulters(params)
      return r.data || []
    },
    staleTime: 0,          // always re-fetch when the class/year key changes
    placeholderData: [],   // show empty table (not stale previous class data) while loading
  })

  // Monthly collections — only fetch when "All Classes" is shown
  const monthlyQuery = useQuery({
    queryKey: ['monthly-collections', yearFilter, selectedMonth],
    queryFn: async () => {
      const params = { month: selectedMonth }
      if (yearFilter) params.academic_year_id = yearFilter
      const r = await feeAPI.getMonthlyCollections(params)
      return r.data || []
    },
    enabled: isAllClasses,
  })

  useEffect(() => {
    if (defaultersQuery.isError) toast.error('Failed to load defaulters')
  }, [defaultersQuery.isError])

  const defaulters = defaultersQuery.data || []
  const loading    = defaultersQuery.isLoading || defaultersQuery.isFetching

  const resolveClassName = (classId) => {
    const cls = classes.find(c => c.id === classId)
    return cls ? `Class ${cls.name} — ${cls.division}` : `Class ${classId}`
  }

  // Derive KPIs from the current (filtered) defaulters array only.
  // Names match what is shown in the card labels — no aliasing.
  const kpiOutstanding = defaulters.reduce((s, d) => s + (d.balance    || 0), 0)
  const kpiBilled      = defaulters.reduce((s, d) => s + (d.total_due  || 0), 0)
  const kpiCollected   = defaulters.reduce((s, d) => s + (d.total_paid || 0), 0)
  // totalBalance is kept as an alias so the footer summary line still works
  const totalBalance   = kpiOutstanding

  const classOptions       = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const yearOptions        = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))
  const selectedClassLabel = classFilter ? classOptions.find(c => c.value === classFilter)?.label : 'All Classes'
  const selectedYearLabel  = yearFilter  ? yearOptions.find(y  => y.value === yearFilter)?.label  : 'All Years'
  const exportParams = {
    ...(classFilter ? { class_id: classFilter }        : {}),
    ...(yearFilter  ? { academic_year_id: yearFilter } : {}),
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

  // KPI cards — only shown when a class is selected
  const kpiCards = [
    { label: 'Defaulters',   value: defaulters.length,        color: 'var(--danger-600)',   bg: 'var(--danger-50)',   border: 'var(--danger-100)'   },
    { label: 'Outstanding',  value: formatINR(kpiOutstanding), color: 'var(--danger-600)',   bg: 'var(--danger-50)',   border: 'var(--danger-100)'   },
    { label: 'Total Billed', value: formatINR(kpiBilled),      color: 'var(--text-primary)', bg: 'var(--surface-0)',  border: 'var(--border-default)' },
    { label: 'Collected',    value: formatINR(kpiCollected),   color: 'var(--success-600)', bg: 'var(--success-50)', border: 'var(--success-100)'  },
  ]

  return (
    <div>
      <PageHeader
        title="Fee Defaulters"
        subtitle={`Students with outstanding fee balance for ${selectedYear?.label || 'the selected academic year'}`}
        actions={
          !isAllClasses && defaulters.length > 0 && (
            <button
              onClick={handleExportPdf}
              className="btn btn-secondary"
              style={{ textDecoration:'none', fontSize:13 }}
            >
              PDF Report
            </button>
          )
        }
      />

      <FilterRow>
        <Select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          options={classOptions}
          placeholder="All Classes"
          style={{ flex:'1 1 140px', minWidth:0 }}
        />
        <Select
          value={yearFilter}
          onChange={() => {}}
          options={yearOptions}
          placeholder="All Years"
          disabled
          style={{ flex:'1 1 140px', minWidth:0 }}
        />
        {classFilter && (
          <button className="btn btn-ghost btn-sm" onClick={() => setClassFilter('')}>Clear</button>
        )}
      </FilterRow>

      {/* ── ALL CLASSES: charts view ─────────────────────────────────── */}
      {isAllClasses ? (
        loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[220, 220].map((h, i) => (
              <div key={i} className="card" style={{ height:h }}>
                <span className="skeleton" style={{ display:'block', height:'100%', borderRadius:12 }} />
              </div>
            ))}
          </div>
        ) : defaulters.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              title="No defaulters found!"
              description="All fees are cleared for the current academic year."
            />
          </div>
        ) : (
          <ChartsSection
            defaulters={defaulters}
            monthlyData={monthlyQuery.data || []}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            loading={monthlyQuery.isLoading || monthlyQuery.isFetching}
            classes={classes}
            isMobile={isMobile}
          />
        )
      ) : (
        /* ── CLASS SELECTED: KPI + table/cards ───────────────────────── */
        <>
          {!loading && defaulters.length > 0 && (
            <>
              <div style={{
                marginBottom:10, padding:'10px 12px',
                border:'1px solid var(--border-default)', borderRadius:10,
                background:'var(--surface-0)', color:'var(--text-secondary)',
                fontSize:'12.5px', fontWeight:600,
              }}>
                PDF export will include exactly: {selectedClassLabel || 'All Classes'} · {selectedYearLabel || 'All Years'} · {defaulters.length} defaulter{defaulters.length !== 1 ? 's' : ''}.
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10, marginBottom:14 }}>
                {kpiCards.map(s => (
                  <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-tertiary)', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:16, fontWeight:800, color:s.color, letterSpacing:'-0.02em', wordBreak:'break-all' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {isMobile ? (
            <div>
              {loading ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[1,2,3].map(i => (
                    <div key={i} className="card" style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                      <span className="skeleton" style={{ display:'block', height:16, width:'60%', borderRadius:6 }} />
                      <span className="skeleton" style={{ display:'block', height:12, width:'40%', borderRadius:6 }} />
                      <span className="skeleton" style={{ display:'block', height:8, borderRadius:6 }} />
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
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {defaulters.map(d => (
                    <DefaulterCard key={d.student_id} d={d} resolveClassName={resolveClassName} />
                  ))}
                  <div style={{ fontSize:12, color:'var(--text-tertiary)', textAlign:'center', padding:'6px 0' }}>
                    {defaulters.length} defaulter{defaulters.length !== 1 ? 's' : ''} · Outstanding: <strong style={{ color:'var(--danger-600)' }}>{formatINR(totalBalance)}</strong>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
                  <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                    <table className="data-table" style={{ minWidth:600 }}>
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
                          const balancePct = d.total_due > 0
                            ? ((d.balance / d.total_due) * 100).toFixed(0)
                            : 0
                          return (
                            <tr key={d.student_id}>
                              <td style={{ color:'var(--text-tertiary)', fontWeight:600, fontSize:12 }}>{i+1}</td>
                              <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{d.student_name}</td>
                              <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{resolveClassName(d.class_id)}</td>
                              <td><span className="mono" style={{ fontSize:'12.5px', color:'var(--text-secondary)' }}>{d.contact}</span></td>
                              <td style={{ fontWeight:600 }}>₹{(d.total_due||0).toLocaleString('en-IN')}</td>
                              <td style={{ color:'var(--success-700)', fontWeight:600 }}>₹{(d.total_paid||0).toLocaleString('en-IN')}</td>
                              <td>
                                <div>
                                  <div style={{ fontSize:14, fontWeight:800, color:'var(--danger-600)' }}>₹{(d.balance||0).toLocaleString('en-IN')}</div>
                                  <div style={{ marginTop:3, height:4, background:'var(--danger-100)', borderRadius:2, width:70 }}>
                                    <div style={{ height:'100%', background:'var(--danger-500)', borderRadius:2, width:`${balancePct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Link
                                  to={`/fees/student/${d.student_id}`}
                                  style={{ display:'inline-flex', alignItems:'center', padding:'5px 10px', borderRadius:7, fontSize:12, fontWeight:600, color:'var(--brand-700)', background:'var(--brand-50)', border:'1px solid var(--brand-200)', textDecoration:'none' }}
                                >
                                  Ledger →
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border-subtle)', fontSize:12, color:'var(--text-tertiary)' }}>
                    {defaulters.length} defaulter{defaulters.length !== 1 ? 's' : ''} · Outstanding: <strong style={{ color:'var(--danger-600)' }}>{formatINR(totalBalance)}</strong>
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