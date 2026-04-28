// Defaulters.jsx — Fixed class_name bug (API returns class_id, not class_name)
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { feeAPI, setupAPI, formatINR, extractError } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton } from '../../components/UI'

export default function Defaulters() {
  const [defaulters, setDefaulters] = useState([])
  const [classes, setClasses]       = useState([])
  const [years, setYears]           = useState([])
  const [classFilter, setClassFilter] = useState('')
  const [yearFilter, setYearFilter]   = useState('')
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setYearFilter(String(curr.id))
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (classFilter) params.class_id = classFilter
    if (yearFilter)  params.academic_year_id = yearFilter
    feeAPI.getDefaulters(params)
      .then(r => setDefaulters(r.data))
      .catch(() => toast.error('Failed to load defaulters'))
      .finally(() => setLoading(false))
  }, [classFilter, yearFilter])

  // FIX: API returns class_id (int), not class_name (string).
  // Resolve the class name from the classes list using class_id.
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
            <a
              href={`/api/v1/pdf/report/defaulters${yearFilter ? `?academic_year_id=${yearFilter}` : ''}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF Report
            </a>
          )
        }
      />

      <FilterRow>
        <Select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          options={classOptions}
          placeholder="All Classes"
          style={{ flex: 1, minWidth: '180px' }}
        />
        <Select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          options={yearOptions}
          placeholder="All Years"
          style={{ flex: 1, minWidth: '180px' }}
        />
        {(classFilter || yearFilter) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setClassFilter(''); setYearFilter('') }}
          >
            Clear
          </button>
        )}
      </FilterRow>

      {/* Summary cards — only show when there are defaulters */}
      {!loading && defaulters.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Total Defaulters',  value: defaulters.length,        color: 'var(--danger-600)',  bg: 'var(--danger-50)',   border: 'var(--danger-100)' },
            { label: 'Total Outstanding', value: formatINR(totalBalance),  color: 'var(--danger-600)',  bg: 'var(--danger-50)',   border: 'var(--danger-100)' },
            { label: 'Total Billed',      value: formatINR(totalOutstanding), color: 'var(--text-primary)', bg: 'var(--surface-0)', border: 'var(--border-default)' },
            { label: 'Total Collected',   value: formatINR(totalCollected), color: 'var(--success-600)', bg: 'var(--success-50)', border: 'var(--success-100)' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: '12px', padding: '16px 18px',
              boxShadow: 'var(--shadow-xs)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {loading ? (
          <table className="data-table"><TableSkeleton rows={6} cols={7} /></table>
        ) : defaulters.length === 0 ? (
          <EmptyState
            icon={
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="No defaulters found!"
            description="All fees are cleared for the selected filters. Great job!"
          />
        ) : (
          <>
            <table className="data-table">
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
                      <td style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px' }}>
                        {i + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>
                          {d.student_name}
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {/* FIX: was d.class_name (undefined) — now resolves from classes array using class_id */}
                        {resolveClassName(d.class_id)}
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {d.contact}
                        </span>
                      </td>
                      <td style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        ₹{(d.total_due || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontSize: '13.5px', color: 'var(--success-700)', fontWeight: 600 }}>
                        ₹{(d.total_paid || 0).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--danger-600)', letterSpacing: '-0.02em' }}>
                            ₹{(d.balance || 0).toLocaleString('en-IN')}
                          </div>
                          <div style={{ marginTop: '4px', height: '4px', background: 'var(--danger-100)', borderRadius: '2px', width: '80px' }}>
                            <div style={{ height: '100%', background: 'var(--danger-500)', borderRadius: '2px', width: `${balancePct}%` }} />
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--danger-500)', fontWeight: 600, marginTop: '2px' }}>
                            {balancePct}% unpaid
                          </div>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/fees/student/${d.student_id}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '5px 11px', borderRadius: '7px',
                            fontSize: '12px', fontWeight: 600,
                            color: 'var(--brand-700)',
                            background: 'var(--brand-50)',
                            border: '1px solid var(--brand-200)',
                            textDecoration: 'none', transition: 'all 0.12s',
                          }}
                        >
                          View Ledger →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '12px', color: 'var(--text-tertiary)',
            }}>
              {defaulters.length} defaulter{defaulters.length !== 1 ? 's' : ''} · Total outstanding: <strong style={{ color: 'var(--danger-600)' }}>{formatINR(totalBalance)}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
