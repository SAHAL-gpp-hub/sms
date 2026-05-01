// YearEnd.jsx — Fully responsive
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { setupAPI, yearendAPI, classAPI, extractError } from '../../services/api'
import { PageHeader, ConfirmModal, EmptyState, InlineBanner } from '../../components/UI'

const STANDARD_NAMES = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10']

function StepCard({ step, icon, title, description, children }) {
  return (
    <div className="card" style={{ marginBottom: '14px' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--gray-50)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'var(--brand-600)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 900, flexShrink: 0, boxShadow: '0 3px 8px rgba(37,99,235,0.25)' }}>
          {step}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '16px' }}>{icon}</span>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>{description}</div>
        </div>
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </div>
  )
}

export default function YearEnd() {
  const [classes, setClasses]         = useState([])
  const [years, setYears]             = useState([])
  const [currentYear, setCurrentYear] = useState(null)

  const [newYear, setNewYear]           = useState({ label: '', start_date: '', end_date: '' })
  const [creatingYear, setCreatingYear] = useState(false)

  const [classYear, setClassYear]           = useState('')
  const [classesForYear, setClassesForYear] = useState([])
  const [newClass, setNewClass]             = useState({ name: '', division: 'A' })
  const [addingClass, setAddingClass]       = useState(false)
  const [deleteClassTarget, setDeleteClassTarget] = useState(null)
  const [deletingClass, setDeletingClass]   = useState(false)

  const [selectedClass, setSelectedClass]     = useState('')
  const [selectedNewYear, setSelectedNewYear] = useState('')
  const [promoting, setPromoting]             = useState(false)
  const [promoteResult, setPromoteResult]     = useState(null)
  const [confirmPromote, setConfirmPromote]   = useState(false)

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setCurrentYear(curr)
    })
  }, [])

  useEffect(() => {
    if (classYear) setupAPI.getClasses(classYear).then(r => setClassesForYear(r.data))
    else setClassesForYear([])
  }, [classYear])

  const handleCreateYear = async () => {
    if (!newYear.label)      { toast.error('Please enter a year label (e.g. 2026-27)'); return }
    if (!newYear.start_date) { toast.error('Please enter a start date'); return }
    if (!newYear.end_date)   { toast.error('Please enter an end date'); return }
    if (newYear.start_date >= newYear.end_date) { toast.error('End date must be after start date'); return }
    setCreatingYear(true)
    try {
      const r = await yearendAPI.createNewYear(newYear)
      toast.success(`Academic year ${r.data.label} created`)
      setNewYear({ label: '', start_date: '', end_date: '' })
      const yearsRes = await setupAPI.getAcademicYears()
      setYears(yearsRes.data)
      const curr = yearsRes.data.find(y => y.is_current)
      if (curr) setCurrentYear(curr)
      await setupAPI.getClasses().then(res => setClasses(res.data))
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCreatingYear(false)
    }
  }

  const handleAddClass = async () => {
    if (!classYear)     { toast.error('Please select an academic year'); return }
    if (!newClass.name) { toast.error('Please select a standard'); return }
    setAddingClass(true)
    try {
      await classAPI.create({ ...newClass, academic_year_id: parseInt(classYear) })
      toast.success(`Class ${newClass.name} — Division ${newClass.division} added`)
      const r = await setupAPI.getClasses(classYear)
      setClassesForYear(r.data)
      setNewClass({ name: '', division: 'A' })
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setAddingClass(false)
    }
  }

  const handleDeleteClassConfirm = async () => {
    if (!deleteClassTarget) return
    setDeletingClass(true)
    try {
      await classAPI.delete(deleteClassTarget.id)
      setClassesForYear(prev => prev.filter(x => x.id !== deleteClassTarget.id))
      toast.success(`Class removed`)
      setDeleteClassTarget(null)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setDeletingClass(false)
    }
  }

  const handlePromote = async () => {
    setConfirmPromote(false)
    setPromoting(true)
    setPromoteResult(null)
    try {
      const r = await yearendAPI.promoteClass(selectedClass, selectedNewYear)
      setPromoteResult({ type: 'success', data: r.data })
      toast.success(`${r.data.promoted} students promoted`)
    } catch (err) {
      const msg = err?.response?.data?.detail || extractError(err)
      setPromoteResult({ type: 'error', message: msg })
      toast.error(msg)
    } finally {
      setPromoting(false)
    }
  }

  const selectedClassName = classes.find(c => String(c.id) === selectedClass)?.name
  const yearOptions   = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))
  const classOptions  = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))

  return (
    <div>
      <PageHeader
        title="Year-End Management"
        subtitle="Create new year, manage classes, promote students, issue TCs"
      />

      {currentYear && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 12px', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: '20px', marginBottom: '18px', fontSize: '13px', fontWeight: 700, color: 'var(--brand-700)' }}>
          <span style={{ width: '7px', height: '7px', background: 'var(--brand-500)', borderRadius: '50%' }} />
          Current Year: {currentYear.label}
        </div>
      )}

      {/* Step 1 */}
      <StepCard step="1" icon="📅" title="Create New Academic Year" description="Set up the next year. It becomes active and classes are auto-created.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label className="label">Year Label *</label>
            <input className="input" type="text" value={newYear.label} onChange={e => setNewYear(y => ({ ...y, label: e.target.value }))} placeholder="e.g. 2026-27" />
          </div>
          <div>
            <label className="label">Start Date *</label>
            <input className="input" type="date" value={newYear.start_date} onChange={e => setNewYear(y => ({ ...y, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">End Date *</label>
            <input className="input" type="date" value={newYear.end_date} onChange={e => setNewYear(y => ({ ...y, end_date: e.target.value }))} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleCreateYear} disabled={creatingYear || !newYear.label} style={{ width: '100%' }}>
          {creatingYear ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Creating…</> : 'Create New Academic Year'}
        </button>
      </StepCard>

      {/* Step 2 */}
      <StepCard step="2" icon="🏫" title="Manage Class Divisions" description="Add or remove class divisions for a given year (e.g. Class 5A, 5B).">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label className="label">Academic Year</label>
            <select className="input" value={classYear} onChange={e => setClassYear(e.target.value)}>
              <option value="">Select year…</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (Current)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Standard</label>
            <select className="input" value={newClass.name} onChange={e => setNewClass(c => ({ ...c, name: e.target.value }))}>
              <option value="">Select…</option>
              {STANDARD_NAMES.map(n => <option key={n} value={n}>Std {n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Division</label>
            <select className="input" value={newClass.division} onChange={e => setNewClass(c => ({ ...c, division: e.target.value }))}>
              {['A','B','C','D','E'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleAddClass} disabled={!classYear || !newClass.name || addingClass} style={{ width: '100%', marginBottom: '14px' }}>
          {addingClass ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Adding…</> : '+ Add Division'}
        </button>

        {classYear && classesForYear.length === 0 && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>No classes found for this year. Add divisions above.</p>
        )}

        {classesForYear.length > 0 && (
          <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="data-table" style={{ minWidth: '300px' }}>
                <thead>
                  <tr>
                    <th>Standard</th>
                    <th>Division</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...classesForYear]
                    .sort((a, b) => STANDARD_NAMES.indexOf(a.name) - STANDARD_NAMES.indexOf(b.name) || a.division.localeCompare(b.division))
                    .map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>Std {c.name}</td>
                        <td><span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--brand-50)', color: 'var(--brand-700)', border: '1px solid var(--brand-200)' }}>Div {c.division}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => setDeleteClassTarget(c)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)', cursor: 'pointer', fontFamily: 'var(--font-sans)', touchAction: 'manipulation' }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </StepCard>

      {/* Step 3 */}
      <StepCard step="3" icon="🎓" title="Bulk Student Promotion" description="Move all active students in a class to the next standard in the new academic year.">
        <InlineBanner type="warning" title="Irreversible action" message="This moves ALL active students from the selected class. Run only after the academic year has ended." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', margin: '14px 0' }}>
          <div>
            <label className="label">Promote From Class</label>
            <select className="input" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setPromoteResult(null) }}>
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>Class {c.name} — {c.division}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Into Academic Year</label>
            <select className="input" value={selectedNewYear} onChange={e => { setSelectedNewYear(e.target.value); setPromoteResult(null) }}>
              <option value="">Select target year…</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (Current)' : ''}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-success" onClick={() => setConfirmPromote(true)} disabled={promoting || !selectedClass || !selectedNewYear} style={{ width: '100%' }}>
          {promoting ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Promoting…</> : 'Promote Students'}
        </button>

        {promoteResult && (
          <div style={{ marginTop: '14px', padding: '14px', borderRadius: '10px', background: promoteResult.type === 'success' ? 'var(--success-50)' : 'var(--danger-50)', border: `1px solid ${promoteResult.type === 'success' ? 'var(--success-100)' : 'var(--danger-100)'}`, fontSize: '13.5px', color: promoteResult.type === 'success' ? 'var(--success-700)' : 'var(--danger-700)', fontWeight: 600 }}>
            {promoteResult.type === 'success'
              ? `✅ ${promoteResult.data.promoted} students promoted from Std ${promoteResult.data.from_class} → Std ${promoteResult.data.to_class}`
              : `❌ ${promoteResult.message}`}
          </div>
        )}
      </StepCard>

      {/* Step 4 */}
      <StepCard step="4" icon="📄" title="Transfer Certificates" description="Generate TCs for leaving students from the Students page.">
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
          Go to the <strong>Students</strong> page, find the student, and click the <strong>TC</strong> button. The TC PDF opens in a new tab ready for printing.
        </p>
        <a href="/students" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex' }}>Go to Students →</a>
      </StepCard>

      {/* Academic Years list */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Academic Years</div>
        </div>
        {years.length === 0 ? (
          <EmptyState
            icon={<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            title="No academic years yet"
            description="Create the first academic year using Step 1 above"
          />
        ) : (
          <div style={{ padding: '4px 0' }}>
            {years.map(y => (
              <div key={y.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: y.is_current ? 'var(--success-500)' : 'var(--gray-300)', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{y.label}</span>
                </div>
                {y.is_current && <span className="badge badge-success">Current</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmPromote}
        title="Confirm Promotion"
        message={`Promote ALL active students in Class ${selectedClassName || ''} to the next standard? This action moves their class and academic year.`}
        confirmLabel="Yes, Promote"
        confirmVariant="success"
        onConfirm={handlePromote}
        onCancel={() => setConfirmPromote(false)}
        loading={promoting}
      />
      <ConfirmModal
        open={!!deleteClassTarget}
        title="Remove Class Division"
        message={`Remove Class ${deleteClassTarget?.name} — Division ${deleteClassTarget?.division}? Students must be moved first.`}
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={handleDeleteClassConfirm}
        onCancel={() => setDeleteClassTarget(null)}
        loading={deletingClass}
      />
    </div>
  )
}