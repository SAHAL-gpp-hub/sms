// Defaulters.jsx — Fully responsive with mobile card view
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { feeAPI, setupAPI, formatINR, openSignedPdf } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton } from '../../components/UI'

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

export default function Defaulters() {
  const [defaulters, setDefaulters] = useState([])
  const [classes, setClasses]       = useState([])
  const [years, setYears]           = useState([])
  const [classFilter, setClassFilter] = useState('')
  const [yearFilter, setYearFilter]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 640)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setYearFilter(String(curr.id))
    })
  }, [])

  const fetchDefaulters = useCallback(() => {
    setLoading(true)
    const params = {}
    if (classFilter) params.class_id = classFilter
    if (yearFilter)  params.academic_year_id = yearFilter
    feeAPI.getDefaulters(params)
      .then(r => setDefaulters(r.data))
      .catch(() => toast.error('Failed to load defaulters'))
      .finally(() => setLoading(false))
  }, [classFilter, yearFilter])

  useEffect(() => {
    fetchDefaulters()
  }, [fetchDefaulters])

  const resolveClassName = (classId) => {
    const cls = classes.find(c => c.id === classId)
    return cls ? `Class ${cls.name} — ${cls.division}` : `Class ${classId}`
  }

  const totalBalance    = defaulters.reduce((s, d) => s + (d.balance || 0), 0)
  const totalOutstanding = defaulters.reduce((s, d) => s + (d.total_due || 0), 0)
  const totalCollected  = defaulters.reduce((s, d) => s + (d.total_paid || 0), 0)

  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const yearOptions  = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))

  return (
    <div>
      <PageHeader
        title="Fee Defaulters"
        subtitle="Students with outstanding fee balance"
        actions={
          defaulters.length > 0 && (
            <button
              onClick={() => openSignedPdf('/pdf/token/report/defaulters', '/pdf/report/defaulters', yearFilter ? { academic_year_id: yearFilter } : {})}
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
        <Select value={yearFilter}  onChange={e => setYearFilter(e.target.value)}  options={yearOptions}  placeholder="All Years"   style={{ flex: 1, minWidth: '150px' }} />
        {(classFilter || yearFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setClassFilter(''); setYearFilter('') }}>Clear</button>
        )}
      </FilterRow>

      {/* Summary cards */}
      {!loading && defaulters.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          {[
            { label: 'Defaulters',    value: defaulters.length,         color: 'var(--danger-600)',  bg: 'var(--danger-50)',   border: 'var(--danger-100)' },
            { label: 'Outstanding',   value: formatINR(totalBalance),   color: 'var(--danger-600)',  bg: 'var(--danger-50)',   border: 'var(--danger-100)' },
            { label: 'Total Billed',  value: formatINR(totalOutstanding), color: 'var(--text-primary)', bg: 'var(--surface-0)', border: 'var(--border-default)' },
            { label: 'Collected',     value: formatINR(totalCollected), color: 'var(--success-600)', bg: 'var(--success-50)', border: 'var(--success-100)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: s.color, letterSpacing: '-0.02em', wordBreak: 'break-all' }}>{s.value}</div>
            </div>
          ))}
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
                      )
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
    </div>
  )
}
