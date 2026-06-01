// FeeStructure.jsx — Fully responsive
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { feeAPI, setupAPI, extractError } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton, ConfirmModal, InlineBanner } from '../../components/UI'
import OnboardingEmptyState from '../../components/OnboardingEmptyState'
import { useAcademicYear } from '../../contexts/academicYearContext'

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
  const { selectedYearId, selectedYear: selectedYearMeta, years, isClosedYear } = useAcademicYear()
  const [classes, setClasses]           = useState([])
  const [feeHeads, setFeeHeads]         = useState([])
  const [structures, setStructures]     = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedYear, setSelectedYear]   = useState('')
  const [seeding, setSeeding]           = useState(false)
  const [adding, setAdding]             = useState(false)
  const [assigning, setAssigning]       = useState(false)
  const [previewingPlan, setPreviewingPlan] = useState(false)
  const [loadingStructures, setLoadingStructures] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [applyConfirm, setApplyConfirm] = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [form, setForm] = useState({ fee_head_id: '', amount: '', due_date: '' })

  useEffect(() => {
    feeAPI.getFeeHeads().then(r => setFeeHeads(r.data))
  }, [])

  useEffect(() => {
    setSelectedYear(selectedYearId || '')
    setSelectedClass('')
    setStructures([])
    if (!selectedYearId) {
      setClasses([])
      return
    }
    setupAPI.getClasses(selectedYearId).then(r => setClasses(r.data))
  }, [selectedYearId])

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
      const payload = {
        class_id: parseInt(selectedClass),
        academic_year_id: parseInt(selectedYear),
        items: [{
          fee_head_id: parseInt(form.fee_head_id),
          amount: parseFloat(form.amount),
          due_date: form.due_date || null,
        }],
      }
      setPreviewingPlan(true)
      const previewRes = await feeAPI.previewFeePlan(payload)
      const preview = previewRes.data
      setApplyConfirm({ preview, payload })
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setPreviewingPlan(false)
      setAdding(false)
    }
  }

  const executeApplyPlan = async () => {
    if (!applyConfirm) return
    setAdding(true)
    try {
      const r = await feeAPI.applyFeePlan(applyConfirm.payload)
      const assigned = r.data?.students_assigned ?? r.data?.assigned ?? applyConfirm.preview?.affected_students ?? 0
      toast.success(`Fee plan applied and assigned to ${assigned} student record(s)`)
      setApplyConfirm(null)
      setForm({ fee_head_id: '', amount: '', due_date: '' })
      const structuresRes = await feeAPI.getFeeStructures({ class_id: selectedClass, academic_year_id: selectedYear })
      setStructures(structuresRes.data)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setAdding(false)
    }
  }

  const handlePreviewOnly = async () => {
    if (!form.fee_head_id) { toast.error('Please select a fee head'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Amount must be > ₹0'); return }
    if (!selectedClass || !selectedYear) { toast.error('Select class and academic year first'); return }
    setPreviewingPlan(true)
    try {
      const res = await feeAPI.previewFeePlan({
        class_id: parseInt(selectedClass),
        academic_year_id: parseInt(selectedYear),
        items: [{
          fee_head_id: parseInt(form.fee_head_id),
          amount: parseFloat(form.amount),
          due_date: form.due_date || null,
        }],
      })
      const preview = res.data
      const feeHead = feeHeads.find(head => String(head.id) === form.fee_head_id)
      toast.success(
        `${feeHead?.name || 'Fee item'} is ready for ${preview.affected_students || 0} student(s). ` +
        `${preview.duplicate_assignments || 0} duplicate assignment(s) will be skipped.`
      )
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setPreviewingPlan(false)
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
      const selected = classes.find(c => String(c.id) === selectedClass)
      const classIds = selected
        ? classes.filter(c => c.name === selected.name && String(c.academic_year_id) === String(selectedYear)).map(c => c.id)
        : [selectedClass]
      const results = await Promise.all(classIds.map(classId => feeAPI.assignFees(classId, selectedYear)))
      const assigned = results.reduce((sum, r) => sum + (r.data?.assigned || 0), 0)
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
  const classGroups = classes.reduce((groups, cls) => {
    const key = `${cls.academic_year_id || selectedYearId}:${cls.name}`
    if (!groups[key]) groups[key] = { ...cls, divisions: [] }
    if (cls.division && !groups[key].divisions.includes(cls.division)) groups[key].divisions.push(cls.division)
    return groups
  }, {})
  const classOptions = Object.values(classGroups)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }))
    .map(c => ({ value: String(c.id), label: `Class ${c.name}` }))
  const yearOptions  = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))

  return (
    <div>
      <PageHeader
        title="Fee Structure"
        subtitle={`Define fees for ${selectedYearMeta?.label || 'the selected academic year'}`}
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

      {classes.length === 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <OnboardingEmptyState type="noClasses" />
        </div>
      )}

      {/* Filters */}
      {classes.length > 0 && <FilterRow>
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
          disabled
          style={{ flex: 1, minWidth: '150px' }}
        />
      </FilterRow>}

      {selectedClass && selectedYear && (
        <>
          {/* Add fee form */}
          <div className="card" style={{ marginBottom: '14px' }}>
            <div className="card-header">
              <div className="card-title">Add Fee to Structure</div>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <InlineBanner
                type="info"
                title="Create and assign in one step"
                message="New fee items preview affected students, then apply and assign in one step."
              />
              {/* Responsive grid: stacks on mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '12px', marginBottom: '12px' }}>
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
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={handlePreviewOnly} disabled={previewingPlan || adding || isClosedYear} style={{ flex: 1, minWidth: '180px' }}>
                  {previewingPlan && !adding ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Previewing…</> : 'Preview impact'}
                </button>
                <button className="btn btn-primary" onClick={handleAdd} disabled={adding || previewingPlan || isClosedYear} style={{ flex: 1, minWidth: '220px' }}>
                  {adding ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Applying…</> : 'Preview and apply fee plan'}
                </button>
              </div>
              <details style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 800 }}>
                  Advanced options
                </summary>
                <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--gray-50)' }}>
                  <button className="btn btn-secondary" onClick={handleAssign} disabled={assigning || structures.length === 0 || isClosedYear}>
                    {assigning ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Re-syncing…</> : 'Re-sync Fee Assignments'}
                  </button>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
                    Creates fee records for students added after the fee structure was set up. Safe to run multiple times.
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* Structure table */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  {selectedClassName ? `Class ${selectedClassName.name}` : 'Fee Structure'}
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
              <OnboardingEmptyState type="noFeeStructure" />
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

      {classes.length > 0 && !selectedClass && (
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
      <ConfirmModal
        open={!!applyConfirm}
        title="Apply Fee Plan"
        message={
          applyConfirm && (
            <div>
              <div>
                Apply fees to <strong>{applyConfirm.preview?.affected_students || 0}</strong> student(s)
                {selectedClassName ? ` in Class ${selectedClassName.name}` : ''}?
              </div>
              {(applyConfirm.preview?.duplicate_assignments || 0) > 0 && (
                <div style={{ marginTop: 8, color: 'var(--warning-600)' }}>
                  {applyConfirm.preview.duplicate_assignments} existing assignment(s) will be skipped or updated.
                </div>
              )}
              {(applyConfirm.preview?.warnings || []).map((warning, index) => (
                <div key={index} style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}>{warning}</div>
              ))}
            </div>
          )
        }
        confirmLabel="Apply Fee Plan"
        confirmVariant="primary"
        onConfirm={executeApplyPlan}
        onCancel={() => setApplyConfirm(null)}
        loading={adding}
      />
    </div>
  )
}
