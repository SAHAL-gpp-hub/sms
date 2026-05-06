// frontend/src/pages/setup/ClassManagement.jsx
// Manage classes and their divisions per academic year
// Backend: POST /setup/classes, DELETE /setup/classes/{id}, GET /setup/classes

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { setupAPI, classAPI, extractError } from '../../services/api'
import {
  PageHeader, FilterRow, Select, EmptyState,
  TableSkeleton, ConfirmModal, InlineBanner,
} from '../../components/UI'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STANDARD_NAMES = [
  'Nursery', 'LKG', 'UKG',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
]

const DIVISIONS = ['A', 'B', 'C', 'D', 'E']

const CLASS_ORDER_MAP = Object.fromEntries(
  ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
    .map((n, i) => [n, i])
)

function sortClasses(classes) {
  return [...classes].sort((a, b) => {
    const ai = CLASS_ORDER_MAP[a.name] ?? 99
    const bi = CLASS_ORDER_MAP[b.name] ?? 99
    if (ai !== bi) return ai - bi
    return (a.division || '').localeCompare(b.division || '')
  })
}

function groupByStandard(classes) {
  const groups = {}
  for (const cls of classes) {
    if (!groups[cls.name]) groups[cls.name] = []
    groups[cls.name].push(cls)
  }
  return groups
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ClassManagement() {
  const [years, setYears]               = useState([])
  const [selectedYear, setSelectedYear] = useState('')
  const [classes, setClasses]           = useState([])
  const [loading, setLoading]           = useState(false)
  const [creating, setCreating]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [showBulk, setShowBulk]         = useState(false)
  const [bulkCreating, setBulkCreating] = useState(false)

  // Form state
  const [form, setForm] = useState({ name: '', standard: '', division: 'A' })
  const [formError, setFormError] = useState('')

  // Bulk selection
  const [bulkDivision, setBulkDivision] = useState('A')
  const [bulkSelected, setBulkSelected] = useState(new Set(STANDARD_NAMES))

  // Load years on mount
  useEffect(() => {
    setupAPI.getAcademicYears().then(r => {
      const ys = r.data || []
      setYears(ys)
      const curr = ys.find(y => y.is_current)
      if (curr) setSelectedYear(String(curr.id))
    }).catch(() => toast.error('Failed to load academic years'))
  }, [])

  // Load classes when year changes
  const fetchClasses = useCallback(async () => {
    if (!selectedYear) { setClasses([]); return }
    setLoading(true)
    try {
      const r = await setupAPI.getClasses(parseInt(selectedYear))
      setClasses(sortClasses(r.data || []))
    } catch {
      toast.error('Failed to load classes')
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  // ── Create single class ──────────────────────────────────────────────────
  const handleCreate = async () => {
    const name = (form.name || form.standard || '').trim()
    if (!name)          { setFormError('Please select or enter a class name'); return }
    if (!form.division) { setFormError('Select a division'); return }
    if (!selectedYear)  { setFormError('Select an academic year first'); return }
    setFormError('')

    // Check duplicate
    const exists = classes.find(
      c => c.name.toLowerCase() === name.toLowerCase() &&
           c.division === form.division
    )
    if (exists) {
      setFormError(`Class ${name} — Div ${form.division} already exists`)
      return
    }

    setCreating(true)
    try {
      await classAPI.create({
        name,
        division: form.division,
        academic_year_id: parseInt(selectedYear),
      })
      toast.success(`Class ${name} — Div ${form.division} created`)
      setForm({ name: '', standard: '', division: 'A' })
      fetchClasses()
    } catch (err) {
      const msg = extractError(err)
      if (msg.toLowerCase().includes('already exists') || msg.includes('409')) {
        setFormError(`Class ${name} — Div ${form.division} already exists`)
      } else {
        toast.error(msg)
      }
    } finally {
      setCreating(false)
    }
  }

  // ── Delete class ─────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await classAPI.delete(deleteTarget.id)
      toast.success(`Class ${deleteTarget.name} — Div ${deleteTarget.division} deleted`)
      setDeleteTarget(null)
      fetchClasses()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setDeleting(false)
    }
  }

  // ── Bulk create all standards ─────────────────────────────────────────────
  const handleBulkCreate = async () => {
    if (!selectedYear) { toast.error('Select an academic year first'); return }
    if (bulkSelected.size === 0) { toast.error('Select at least one standard'); return }
    setBulkCreating(true)

    const toCreate = [...bulkSelected].filter(name => {
      const existing = classes.find(
        c => c.name.toLowerCase() === name.toLowerCase() &&
             c.division === bulkDivision
      )
      return !existing
    })

    if (toCreate.length === 0) {
      toast('All selected classes already exist for this division', { icon: 'ℹ️' })
      setBulkCreating(false)
      return
    }

    let created = 0
    let errors = 0
    for (const name of toCreate) {
      try {
        await classAPI.create({
          name,
          division: bulkDivision,
          academic_year_id: parseInt(selectedYear),
        })
        created++
      } catch {
        errors++
      }
    }

    if (created > 0) toast.success(`Created ${created} class${created !== 1 ? 'es' : ''}`)
    if (errors > 0) toast.error(`${errors} failed — may already exist`)
    setShowBulk(false)
    fetchClasses()
    setBulkCreating(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const yearOptions = years.map(y => ({
    value: String(y.id),
    label: y.label + (y.is_current ? ' (Current)' : ` — ${y.status}`),
  }))
  const groups = groupByStandard(classes)
  const totalDivisions = classes.length
  const uniqueStandards = Object.keys(groups).length

  const selectedYearLabel = years.find(y => String(y.id) === selectedYear)?.label

  return (
    <div style={{ maxWidth: '900px' }}>
      <PageHeader
        title="Class Management"
        subtitle="Create standards and divisions for each academic year"
      />

      {/* Year selector */}
      <FilterRow>
        <Select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          options={yearOptions}
          placeholder="Select academic year…"
          style={{ flex: 1, minWidth: '200px' }}
          label="Academic Year"
        />
        {selectedYear && (
          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowBulk(true)}
              title="Create all GSEB standards at once"
            >
              Bulk Create
            </button>
          </div>
        )}
      </FilterRow>

      {!selectedYear && (
        <div className="card">
          <EmptyState
            icon={
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            title="Select an academic year"
            description="Choose a year from the dropdown to manage its classes"
          />
        </div>
      )}

      {selectedYear && (
        <>
          {/* Add class form */}
          <div className="card" style={{ marginBottom: '14px' }}>
            <div className="card-header">
              <div className="card-title">Add Class / Division</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {selectedYearLabel}
              </div>
            </div>
            <div style={{ padding: '18px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                marginBottom: '12px',
              }}>
                {/* Standard — dropdown of known names */}
                <div>
                  <label className="label">Standard *</label>
                  <select
                    className="input"
                    value={form.name}
                    onChange={e => {
                      setForm(f => ({ ...f, name: e.target.value, standard: e.target.value }))
                      setFormError('')
                    }}
                  >
                    <option value="">Select standard…</option>
                    {STANDARD_NAMES.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                    <option value="__custom__">Custom name…</option>
                  </select>
                </div>

                {/* Custom name input (shown when Custom selected) */}
                {form.name === '__custom__' && (
                  <div>
                    <label className="label">Custom Name *</label>
                    <input
                      className="input"
                      value={form.standard}
                      onChange={e => setForm(f => ({ ...f, standard: e.target.value }))}
                      placeholder="e.g. Pre-Primary"
                      autoFocus
                    />
                  </div>
                )}

                {/* Division */}
                <div>
                  <label className="label">Division *</label>
                  <select
                    className="input"
                    value={form.division}
                    onChange={e => {
                      setForm(f => ({ ...f, division: e.target.value }))
                      setFormError('')
                    }}
                  >
                    {DIVISIONS.map(d => (
                      <option key={d} value={d}>Division {d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formError && (
                <div style={{
                  padding: '8px 12px', borderRadius: '8px',
                  background: 'var(--danger-50)', border: '1px solid var(--danger-100)',
                  color: 'var(--danger-700)', fontSize: '13px', fontWeight: 600,
                  marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                  </svg>
                  {formError}
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleCreate}
                disabled={creating || !selectedYear}
              >
                {creating
                  ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Creating…</>
                  : '+ Add Class'
                }
              </button>
            </div>
          </div>

          {/* Stats bar */}
          {!loading && classes.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '14px',
            }}>
              {[
                { label: 'Standards', value: uniqueStandards, color: 'var(--brand-700)', bg: 'var(--brand-50)', border: 'var(--brand-200)' },
                { label: 'Sections',  value: totalDivisions,  color: 'var(--success-700)', bg: 'var(--success-50)', border: 'var(--success-100)' },
              ].map(s => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 14px', borderRadius: '20px',
                  background: s.bg, border: `1px solid ${s.border}`,
                }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: s.color, letterSpacing: '-0.03em' }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Classes list — grouped by standard */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                Classes in {selectedYearLabel}
              </div>
              {!loading && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  {classes.length} section{classes.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {loading ? (
              <table className="data-table">
                <TableSkeleton rows={6} cols={4} />
              </table>
            ) : classes.length === 0 ? (
              <EmptyState
                icon={
                  <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                title="No classes yet"
                description={`Add classes above or use Bulk Create to set up all GSEB standards for ${selectedYearLabel}`}
                action={
                  <button className="btn btn-primary btn-sm" onClick={() => setShowBulk(true)}>
                    Bulk Create All Standards
                  </button>
                }
              />
            ) : (
              <div>
                {Object.entries(groups).map(([stdName, stdClasses], gi) => (
                  <div key={stdName}>
                    {/* Group header */}
                    <div style={{
                      padding: '8px 16px',
                      background: 'var(--gray-50)',
                      borderTop: gi > 0 ? '1px solid var(--border-subtle)' : 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: 'var(--text-secondary)',
                      }}>
                        Standard {stdName}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        padding: '1px 7px', borderRadius: '20px',
                        background: 'var(--brand-100)', color: 'var(--brand-700)',
                      }}>
                        {stdClasses.length} div{stdClasses.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Division rows */}
                    {stdClasses.map((cls, ci) => (
                      <div key={cls.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '11px 16px',
                        borderBottom: ci < stdClasses.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: ci % 2 === 0 ? 'var(--surface-0)' : 'var(--gray-25)',
                        gap: '12px',
                      }}>
                        {/* Division badge */}
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px',
                          background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px', fontWeight: 900, color: 'var(--brand-700)',
                          flexShrink: 0,
                        }}>
                          {cls.division || 'A'}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                            {cls.name} — Division {cls.division}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                            ID: {cls.id} · Year: {selectedYearLabel}
                          </div>
                        </div>

                        {/* Full display label */}
                        <span style={{
                          fontSize: '12px', fontWeight: 700,
                          padding: '4px 12px', borderRadius: '20px',
                          background: 'var(--gray-100)', color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          display: 'none', // hide on mobile
                        }}
                          className="class-label-desktop"
                        >
                          Std {cls.name} — Div {cls.division}
                        </span>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(cls)}
                          style={{
                            padding: '5px 12px', borderRadius: '7px',
                            fontSize: '12px', fontWeight: 600,
                            color: 'var(--danger-600)', background: 'var(--danger-50)',
                            border: '1px solid var(--danger-100)',
                            cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            flexShrink: 0, touchAction: 'manipulation',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Bulk Create Modal ─────────────────────────────────────────────── */}
      {showBulk && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0',
        }}>
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
            }}
            onClick={() => !bulkCreating && setShowBulk(false)}
          />
          <div style={{
            position: 'relative',
            background: 'var(--surface-0)',
            borderRadius: '20px 20px 0 0',
            padding: '24px 20px 28px',
            width: '100%', maxWidth: '520px',
            border: '1px solid var(--border-default)',
            borderBottom: 'none',
            boxShadow: 'var(--shadow-xl)',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--gray-300)' }} />
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Bulk Create Standards
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
              Create all selected standards for <strong>{selectedYearLabel}</strong>. Existing ones are skipped.
            </p>

            {/* Division selector */}
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Division for all selected standards</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DIVISIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setBulkDivision(d)}
                    style={{
                      padding: '7px 16px', borderRadius: '8px',
                      fontSize: '13px', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      background: bulkDivision === d ? 'var(--brand-600)' : 'var(--surface-0)',
                      color: bulkDivision === d ? 'white' : 'var(--text-secondary)',
                      border: `1.5px solid ${bulkDivision === d ? 'var(--brand-600)' : 'var(--border-default)'}`,
                      transition: 'all 0.12s',
                    }}
                  >
                    Division {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Standards toggle */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="label" style={{ margin: 0 }}>Standards to create</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setBulkSelected(new Set(STANDARD_NAMES))}
                    style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    All
                  </button>
                  <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                  <button
                    type="button"
                    onClick={() => setBulkSelected(new Set())}
                    style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    None
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {STANDARD_NAMES.map(name => {
                  const selected = bulkSelected.has(name)
                  // Check if this class/division combo already exists
                  const alreadyExists = classes.some(
                    c => c.name.toLowerCase() === name.toLowerCase() && c.division === bulkDivision
                  )
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        const next = new Set(bulkSelected)
                        if (next.has(name)) next.delete(name)
                        else next.add(name)
                        setBulkSelected(next)
                      }}
                      title={alreadyExists ? `Std ${name} Div ${bulkDivision} already exists — will be skipped` : ''}
                      style={{
                        padding: '5px 12px', borderRadius: '7px',
                        fontSize: '12.5px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        transition: 'all 0.12s', touchAction: 'manipulation',
                        background: alreadyExists
                          ? 'var(--gray-50)'
                          : selected ? 'var(--brand-600)' : 'var(--surface-0)',
                        color: alreadyExists
                          ? 'var(--text-tertiary)'
                          : selected ? 'white' : 'var(--text-secondary)',
                        border: `1.5px solid ${
                          alreadyExists ? 'var(--border-default)'
                          : selected ? 'var(--brand-600)' : 'var(--border-default)'
                        }`,
                        opacity: alreadyExists ? 0.6 : 1,
                        position: 'relative',
                      }}
                    >
                      {name}
                      {alreadyExists && (
                        <span style={{
                          marginLeft: '4px', fontSize: '9px', fontWeight: 800,
                          color: 'var(--success-600)',
                        }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
                {bulkSelected.size} standard{bulkSelected.size !== 1 ? 's' : ''} selected ·
                <span style={{ color: 'var(--success-600)', marginLeft: '4px' }}>
                  + = already exists, will be skipped
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
                onClick={handleBulkCreate}
                disabled={bulkCreating || bulkSelected.size === 0}
              >
                {bulkCreating
                  ? <><span className="spinner" style={{ width: '15px', height: '15px' }} /> Creating…</>
                  : `Create ${bulkSelected.size} Standard${bulkSelected.size !== 1 ? 's' : ''}`
                }
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowBulk(false)}
                disabled={bulkCreating}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Class"
        message={
          deleteTarget
            ? `Delete Standard ${deleteTarget.name} — Division ${deleteTarget.division}? This will also delete linked subjects, exams, and attendance records for this class.`
            : ''
        }
        confirmLabel="Delete Class"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      <style>{`
        @media (min-width: 480px) {
          .class-label-desktop { display: inline-flex !important; }
        }
        @media (min-width: 640px) {
          [style*="border-radius: 20px 20px 0 0"] {
            border-radius: 16px !important;
            border-bottom: 1px solid var(--border-default) !important;
          }
        }
      `}</style>
    </div>
  )
}
