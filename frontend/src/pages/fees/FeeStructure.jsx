// FeeStructure.jsx — Fully responsive
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { feeAPI, setupAPI, extractError } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton, ConfirmModal, InlineBanner } from '../../components/UI'

const FREQ_COLORS = {
  Monthly:   { bg: 'var(--brand-50)',   color: 'var(--brand-700)',   border: 'var(--brand-200)' },
  'One-Time':{ bg: 'var(--purple-50)', color: 'var(--purple-600)', border: 'var(--purple-100)' },
  Termly:    { bg: 'var(--warning-50)', color: 'var(--warning-600)', border: '#fde68a' },
  Annual:    { bg: 'var(--success-50)', color: 'var(--success-700)', border: 'var(--success-100)' },
}

function FreqBadge({ freq }) {
  const s = FREQ_COLORS[freq] || { bg: 'var(--gray-100)', color: 'var(--gray-600)', border: 'var(--border-default)' }
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {freq}
    </span>
  )
}

export default function FeeStructure() {
  const [classes, setClasses]           = useState([])
  const [years, setYears]               = useState([])
  const [feeHeads, setFeeHeads]         = useState([])
  const [structures, setStructures]     = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedYear, setSelectedYear]   = useState('')
  const [seeding, setSeeding]           = useState(false)
  const [adding, setAdding]             = useState(false)
  const [assigning, setAssigning]       = useState(false)
  const [loadingStructures, setLoadingStructures] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [form, setForm] = useState({ fee_head_id: '', amount: '', due_date: '' })

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setSelectedYear(String(curr.id))
    })
    feeAPI.getFeeHeads().then(r => setFeeHeads(r.data))
  }, [])

  useEffect(() => {
    if (selectedClass && selectedYear) {
      setLoadingStructures(true)
      feeAPI.getFeeStructures({ class_id: selectedClass, academic_year_id: selectedYear })
        .then(r => setStructures(r.data))
        .finally(() => setLoadingStructures(false))
    } else {
      setStructures([])
    }
  }, [selectedClass, selectedYear])

  const handleSeedHeads = async () => {
    setSeeding(true)
    try {
      await feeAPI.seedFeeHeads()
      const r = await feeAPI.getFeeHeads()
      setFeeHeads(r.data)
      toast.success('GSEB fee heads loaded')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSeeding(false)
    }
  }

  const handleAdd = async () => {
    if (!form.fee_head_id) { toast.error('Please select a fee head'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Amount must be > ₹0'); return }
    if (!selectedClass) { toast.error('Please select a class first'); return }
    if (!selectedYear)  { toast.error('Please select an academic year'); return }
    setAdding(true)
    try {
      await feeAPI.createFeeStructure({
        class_id: parseInt(selectedClass), fee_head_id: parseInt(form.fee_head_id),
        amount: parseFloat(form.amount), due_date: form.due_date || null,
        academic_year_id: parseInt(selectedYear),
      })
      setForm({ fee_head_id: '', amount: '', due_date: '' })
      const r = await feeAPI.getFeeStructures({ class_id: selectedClass, academic_year_id: selectedYear })
      setStructures(r.data)
      toast.success('Fee added to structure')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await feeAPI.deleteFeeStructure(deleteTarget.id)
      setStructures(s => s.filter(x => x.id !== deleteTarget.id))
      toast.success('Fee removed')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setDeleting(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedClass || !selectedYear) return
    if (structures.length === 0) { toast.error('No fee structure defined. Add fees first.'); return }
    setAssigning(true)
    try {
      const r = await feeAPI.assignFees(selectedClass, selectedYear)
      const { assigned } = r.data
      if (assigned === 0) {
        toast('No new records created — fees may already be assigned.', { icon: 'ℹ️' })
      } else {
        toast.success(`Fees assigned to ${assigned} student records`)
      }
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setAssigning(false)
    }
  }

  const selectedClassName = classes.find(c => String(c.id) === selectedClass)
  const totalAmount = structures.reduce((s, x) => s + parseFloat(x.amount || 0), 0)
  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — Div ${c.division}` }))
  const yearOptions  = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))

  return (
    <div>
      <PageHeader
        title="Fee Structure"
        subtitle="Define fees per class and academic year"
      />

      {feeHeads.length === 0 && (
        <InlineBanner
          type="warning"
          title="No fee heads found"
          message="Load pre-configured GSEB fee heads to get started quickly."
        />
      )}

      {feeHeads.length === 0 && (
        <div style={{ marginBottom: '14px' }}>
          <button className="btn btn-secondary" onClick={handleSeedHeads} disabled={seeding}>
            {seeding ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Loading...</> : <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Load GSEB Fee Heads</>}
          </button>
        </div>
      )}

      {/* Filters */}
      <FilterRow>
        <Select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          options={classOptions}
          placeholder="Select class…"
          style={{ flex: 1, minWidth: '160px' }}
        />
        <Select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          options={yearOptions}
          placeholder="Select year…"
          style={{ flex: 1, minWidth: '150px' }}
        />
        {selectedClass && selectedYear && (
          <button className="btn btn-success" onClick={handleAssign} disabled={assigning} style={{ whiteSpace: 'nowrap' }}>
            {assigning
              ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Assigning…</>
              : <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg> Assign to Students</>}
          </button>
        )}
      </FilterRow>

      {selectedClass && selectedYear && (
        <>
          {/* Add fee form */}
          <div className="card" style={{ marginBottom: '14px' }}>
            <div className="card-header">
              <div className="card-title">Add Fee to Structure</div>
            </div>
            <div style={{ padding: '16px 18px' }}>
              {/* Responsive grid: stacks on mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="label">Fee Head</label>
                  <select className="input" value={form.fee_head_id} onChange={e => setForm(f => ({ ...f, fee_head_id: e.target.value }))}>
                    <option value="">Select fee head…</option>
                    {feeHeads.map(fh => <option key={fh.id} value={fh.id}>{fh.name} ({fh.frequency})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Amount (₹)</label>
                  <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" min="1" inputMode="decimal" />
                </div>
                <div>
                  <label className="label">Due Date (optional)</label>
                  <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleAdd} disabled={adding} style={{ width: '100%' }}>
                {adding ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Adding…</> : '+ Add Fee'}
              </button>
            </div>
          </div>

          {/* Structure table */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  {selectedClassName ? `Class ${selectedClassName.name} — Div ${selectedClassName.division}` : 'Fee Structure'}
                </div>
                {structures.length > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    {structures.length} fee item{structures.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {structures.length > 0 && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>

            {loadingStructures ? (
              <table className="data-table"><TableSkeleton rows={4} cols={4} /></table>
            ) : structures.length === 0 ? (
              <EmptyState
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                title="No fees defined yet"
                description="Use the form above to add fees"
              />
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="data-table" style={{ minWidth: '400px' }}>
                  <thead>
                    <tr>
                      <th>Fee Head</th>
                      <th>Frequency</th>
                      <th>Amount</th>
                      <th>Due Date</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.fee_head?.name}</td>
                        <td><FreqBadge freq={s.fee_head?.frequency} /></td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{parseFloat(s.amount).toLocaleString('en-IN')}</td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>{s.due_date || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => setDeleteTarget({ id: s.id, name: s.fee_head?.name })}
                            style={{ background: 'var(--danger-50)', color: 'var(--danger-600)', border: '1px solid var(--danger-100)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', touchAction: 'manipulation' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedClass && (
        <div className="card">
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
            title="Select a class to view fee structure"
            description="Choose a class and academic year from the filters above"
          />
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Remove Fee"
        message={`Remove "${deleteTarget?.name}" from the fee structure? Existing payment records will not be affected.`}
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}