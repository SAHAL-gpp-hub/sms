// MarksEntry.jsx — Full rebuild with Subject Manager + per-exam custom marks
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { marksAPI, setupAPI, extractError } from '../../services/api'
import {
  PageHeader, FilterRow, Select, EmptyState,
  TableSkeleton, TabBar, InlineBanner, ConfirmModal,
} from '../../components/UI'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const EXAM_TYPES = ['Unit Test 1', 'Unit Test 2', 'Half-Yearly', 'Annual', 'Practical']

const SUBJECT_TYPES = ['Theory', 'Practical', 'Theory+Practical']

const GRADE_COLORS = {
  A1: { bg: '#dcfce7', color: '#15803d' },
  A2: { bg: '#d1fae5', color: '#065f46' },
  B1: { bg: '#dbeafe', color: '#1d4ed8' },
  B2: { bg: '#e0e7ff', color: '#4338ca' },
  C1: { bg: '#fef3c7', color: '#d97706' },
  C2: { bg: '#ffedd5', color: '#c2410c' },
  D:  { bg: '#fee2e2', color: '#b91c1c' },
  E:  { bg: '#fecdd3', color: '#9f1239' },
  AB: { bg: '#f1f5f9', color: '#64748b' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (defined OUTSIDE MarksEntry to prevent remount on every render)
// ─────────────────────────────────────────────────────────────────────────────

function GradeBadge({ grade }) {
  const s = GRADE_COLORS[grade] || { bg: 'var(--gray-100)', color: 'var(--gray-600)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '32px', height: '20px',
      fontSize: '11px', fontWeight: 800,
      background: s.bg, color: s.color,
      borderRadius: '5px',
    }}>
      {grade}
    </span>
  )
}

// ── Subject Manager ───────────────────────────────────────────────────────────
function SubjectManager({ classId, onSubjectsChanged }) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [editTarget, setEditTarget] = useState(null)   // subject being edited
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [seedingSubjects, setSeedingSubjects] = useState(false)

  // New subject form
  const [newForm, setNewForm] = useState({
    name: '', max_theory: '100', max_practical: '0', subject_type: 'Theory',
  })
  const [addingSubject, setAddingSubject] = useState(false)

  const fetchSubjects = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    try {
      const r = await marksAPI.getSubjects(classId, showInactive)
      setSubjects(r.data)
    } catch {
      toast.error('Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }, [classId, showInactive])

  useEffect(() => { fetchSubjects() }, [fetchSubjects])

  const handleSeedSubjects = async () => {
    setSeedingSubjects(true)
    try {
      const r = await marksAPI.seedSubjects(classId)
      toast.success(r.data.message || 'GSEB subjects loaded')
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSeedingSubjects(false)
    }
  }

  const handleAddSubject = async () => {
    if (!newForm.name.trim()) { toast.error('Subject name is required'); return }
    const maxT = parseInt(newForm.max_theory)
    const maxP = parseInt(newForm.max_practical || '0')
    if (!maxT || maxT <= 0) { toast.error('Max theory marks must be > 0'); return }
    if (maxP < 0) { toast.error('Max practical marks cannot be negative'); return }

    setAddingSubject(true)
    try {
      await marksAPI.createSubject({
        name: newForm.name.trim(),
        class_id: parseInt(classId),
        max_theory: maxT,
        max_practical: maxP,
        subject_type: newForm.subject_type,
      })
      toast.success(`Subject "${newForm.name.trim()}" added`)
      setNewForm({ name: '', max_theory: '100', max_practical: '0', subject_type: 'Theory' })
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setAddingSubject(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    if (!editTarget.name?.trim()) { toast.error('Subject name is required'); return }
    const maxT = parseInt(editTarget.max_theory)
    const maxP = parseInt(editTarget.max_practical || '0')
    if (!maxT || maxT <= 0) { toast.error('Max theory marks must be > 0'); return }

    setSaving(true)
    try {
      await marksAPI.updateSubject(editTarget.id, {
        name:          editTarget.name.trim(),
        max_theory:    maxT,
        max_practical: maxP,
        subject_type:  editTarget.subject_type,
      })
      toast.success('Subject updated')
      setEditTarget(null)
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (subject) => {
    try {
      await marksAPI.updateSubject(subject.id, { is_active: !subject.is_active })
      toast.success(subject.is_active ? 'Subject hidden from grids' : 'Subject restored')
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const r = await marksAPI.deleteSubject(deleteTarget.id)
      if (r.data.soft) {
        toast('Subject has mark history — hidden instead of deleted', { icon: 'ℹ️' })
      } else {
        toast.success(`"${deleteTarget.name}" deleted`)
      }
      setDeleteTarget(null)
      fetchSubjects()
      onSubjectsChanged?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setDeleting(false)
    }
  }

  const activeSubjects   = subjects.filter(s => s.is_active)
  const inactiveSubjects = subjects.filter(s => !s.is_active)

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {activeSubjects.length} active subject{activeSubjects.length !== 1 ? 's' : ''}
            {inactiveSubjects.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                ({inactiveSubjects.length} hidden)
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Add, edit or remove subjects for this class. Changes apply to all future exams.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {inactiveSubjects.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                style={{ accentColor: 'var(--brand-500)' }}
              />
              Show hidden
            </label>
          )}
          <button
            className="btn btn-secondary"
            onClick={handleSeedSubjects}
            disabled={seedingSubjects}
            style={{ fontSize: '12.5px' }}
          >
            {seedingSubjects
              ? <><span className="spinner" style={{ width: '12px', height: '12px' }} /> Loading…</>
              : '📚 Load GSEB Defaults'
            }
          </button>
        </div>
      </div>

      {/* Add subject form */}
      <div style={{
        background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand-700)', marginBottom: '12px' }}>
          Add New Subject
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 90px 90px 160px auto', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Subject Name *</label>
            <input
              className="input"
              value={newForm.name}
              onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mathematics"
              onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
            />
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Max Theory</label>
            <input
              type="number"
              className="input"
              value={newForm.max_theory}
              onChange={e => setNewForm(f => ({ ...f, max_theory: e.target.value }))}
              min="1"
              style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Max Practical</label>
            <input
              type="number"
              className="input"
              value={newForm.max_practical}
              onChange={e => setNewForm(f => ({ ...f, max_practical: e.target.value }))}
              min="0"
              style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Type</label>
            <select
              className="input"
              value={newForm.subject_type}
              onChange={e => setNewForm(f => ({ ...f, subject_type: e.target.value }))}
            >
              {SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAddSubject}
            disabled={addingSubject}
            style={{ alignSelf: 'flex-end' }}
          >
            {addingSubject
              ? <span className="spinner" style={{ width: '13px', height: '13px' }} />
              : <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </>
            }
          </button>
        </div>
      </div>

      {/* Subjects table */}
      <div className="card">
        {loading ? (
          <table className="data-table"><TableSkeleton rows={5} cols={5} /></table>
        ) : subjects.length === 0 ? (
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
            title="No subjects defined"
            description="Add subjects above or load GSEB defaults for this class"
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th style={{ textAlign: 'center' }}>Default Max (T)</th>
                <th style={{ textAlign: 'center' }}>Default Max (P)</th>
                <th style={{ textAlign: 'center' }}>Type</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(subject => (
                <tr key={subject.id} style={{ opacity: subject.is_active ? 1 : 0.55 }}>
                  {editTarget?.id === subject.id ? (
                    // Inline edit row
                    <>
                      <td>
                        <input
                          className="input"
                          value={editTarget.name}
                          onChange={e => setEditTarget(t => ({ ...t, name: e.target.value }))}
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                          autoFocus
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input"
                          value={editTarget.max_theory}
                          onChange={e => setEditTarget(t => ({ ...t, max_theory: e.target.value }))}
                          style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '13px', width: '80px' }}
                          min="1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input"
                          value={editTarget.max_practical}
                          onChange={e => setEditTarget(t => ({ ...t, max_practical: e.target.value }))}
                          style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '13px', width: '80px' }}
                          min="0"
                        />
                      </td>
                      <td>
                        <select
                          className="input"
                          value={editTarget.subject_type}
                          onChange={e => setEditTarget(t => ({ ...t, subject_type: e.target.value }))}
                          style={{ padding: '6px 8px', fontSize: '13px' }}
                        >
                          {SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td />
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={handleSaveEdit}
                            disabled={saving}
                          >
                            {saving ? <span className="spinner" style={{ width: '11px', height: '11px' }} /> : 'Save'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditTarget(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // Normal display row
                    <>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: subject.is_active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {subject.name}
                          </span>
                          {!subject.is_active && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'var(--gray-200)', color: 'var(--gray-500)' }}>
                              HIDDEN
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {subject.max_theory}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: subject.max_practical > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: subject.max_practical > 0 ? 700 : 400 }}>
                        {subject.max_practical > 0 ? subject.max_practical : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                          background: subject.subject_type === 'Theory+Practical' ? 'var(--purple-100)' : 'var(--gray-100)',
                          color: subject.subject_type === 'Theory+Practical' ? 'var(--purple-600)' : 'var(--gray-600)',
                        }}>
                          {subject.subject_type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleActive(subject)}
                          style={{
                            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                            background: subject.is_active ? 'var(--success-100)' : 'var(--gray-100)',
                            color: subject.is_active ? 'var(--success-700)' : 'var(--gray-500)',
                            border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          }}
                          title={subject.is_active ? 'Click to hide from grids' : 'Click to restore'}
                        >
                          {subject.is_active ? '✓ Active' : '○ Hidden'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setEditTarget({ ...subject })}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600,
                              color: 'var(--brand-600)', background: 'var(--brand-50)',
                              border: '1px solid var(--brand-100)', cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(subject)}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600,
                              color: 'var(--danger-600)', background: 'var(--danger-50)',
                              border: '1px solid var(--danger-100)', cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Subject"
        message={
          `Delete "${deleteTarget?.name}"? If marks have been recorded for this subject, it will be hidden instead of permanently deleted to preserve historical data.`
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}

// ── Exam Config Panel ─────────────────────────────────────────────────────────
function ExamConfigPanel({ examId, classId, onConfigSaved }) {
  const [subjects, setSubjects]       = useState([])
  const [configs, setConfigs]         = useState({}) // { subject_id: { max_theory, max_practical } }
  const [useCustom, setUseCustom]     = useState({}) // { subject_id: bool }
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [applyAll, setApplyAll]       = useState('')  // quick-set all to a value

  useEffect(() => {
    if (!examId || !classId) return
    setLoading(true)
    Promise.all([
      marksAPI.getSubjects(classId),
      marksAPI.getExamConfigs(examId),
    ]).then(([subRes, cfgRes]) => {
      const subs = subRes.data
      setSubjects(subs)

      // Build local state from existing configs
      const cfgMap = {}
      const useMap = {}
      cfgRes.data.forEach(c => {
        cfgMap[c.subject_id] = { max_theory: c.max_theory, max_practical: c.max_practical }
        useMap[c.subject_id] = true
      })
      // Defaults for subjects with no override
      subs.forEach(s => {
        if (!cfgMap[s.id]) {
          cfgMap[s.id] = { max_theory: s.max_theory, max_practical: s.max_practical }
          useMap[s.id] = false
        }
      })
      setConfigs(cfgMap)
      setUseCustom(useMap)
    }).catch(() => {
      toast.error('Failed to load exam config')
    }).finally(() => setLoading(false))
  }, [examId, classId])

  const handleApplyAll = (val) => {
    const num = parseInt(val)
    if (!num || num <= 0) return
    const newCfg = { ...configs }
    const newUse = { ...useCustom }
    subjects.forEach(s => {
      newCfg[s.id] = { max_theory: num, max_practical: configs[s.id]?.max_practical ?? 0 }
      newUse[s.id] = true
    })
    setConfigs(newCfg)
    setUseCustom(newUse)
    setApplyAll('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Only send overrides where useCustom is true
      const configsToSend = subjects
        .filter(s => useCustom[s.id])
        .map(s => ({
          subject_id:    s.id,
          max_theory:    parseInt(configs[s.id]?.max_theory) || s.max_theory,
          max_practical: parseInt(configs[s.id]?.max_practical) || 0,
        }))

      await marksAPI.setExamConfigs(examId, configsToSend)
      toast.success(
        configsToSend.length === 0
          ? 'Reverted to subject defaults for all subjects'
          : `Custom marks saved for ${configsToSend.length} subject${configsToSend.length !== 1 ? 's' : ''}`
      )
      onConfigSaved?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleClearAll = async () => {
    setSaving(true)
    try {
      await marksAPI.clearExamConfigs(examId)
      // Reset local state to subject defaults
      const newCfg = {}
      const newUse = {}
      subjects.forEach(s => {
        newCfg[s.id] = { max_theory: s.max_theory, max_practical: s.max_practical }
        newUse[s.id] = false
      })
      setConfigs(newCfg)
      setUseCustom(newUse)
      toast.success('Reverted to subject defaults')
      onConfigSaved?.()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const hasAnyCustom = subjects.some(s => useCustom[s.id])

  if (loading) {
    return (
      <div style={{ padding: '20px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="spinner" /> Loading exam configuration…
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <InlineBanner
        type="warning"
        title="No subjects defined for this class"
        message="Go to the Subjects tab to add subjects first."
      />
    )
  }

  return (
    <div>
      {/* Info */}
      <InlineBanner
        type="info"
        title="Custom marks per exam"
        message="Override the default max marks for this specific exam. Example: set all subjects to 25 for Unit Tests, 50 for Half-Yearly. Leave unchecked to use the subject's default max marks."
      />

      {/* Quick-apply all */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', background: 'var(--gray-50)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px', marginBottom: '16px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Quick-set all theory to:
        </span>
        {[25, 50, 80, 100].map(val => (
          <button
            key={val}
            onClick={() => handleApplyAll(val)}
            style={{
              padding: '5px 12px', borderRadius: '7px',
              fontSize: '12.5px', fontWeight: 700,
              background: 'var(--surface-0)', color: 'var(--brand-700)',
              border: '1.5px solid var(--brand-200)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-50)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-0)' }}
          >
            {val} marks
          </button>
        ))}
        <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>or</span>
        <input
          type="number"
          className="input"
          value={applyAll}
          onChange={e => setApplyAll(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleApplyAll(applyAll)}
          placeholder="Custom…"
          min="1"
          style={{ width: '90px', padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
        />
        {applyAll && (
          <button
            onClick={() => handleApplyAll(applyAll)}
            className="btn btn-primary btn-sm"
          >
            Apply
          </button>
        )}
      </div>

      {/* Subject-by-subject config */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th style={{ textAlign: 'center' }}>Default Max (T)</th>
              <th style={{ textAlign: 'center' }}>Default Max (P)</th>
              <th style={{ textAlign: 'center', width: '120px' }}>Override?</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Custom Max (T)</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Custom Max (P)</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map(s => {
              const isCustom = useCustom[s.id] || false
              const cfg = configs[s.id] || { max_theory: s.max_theory, max_practical: s.max_practical }
              return (
                <tr key={s.id} style={{ background: isCustom ? 'var(--brand-50)' : undefined }}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.name}
                    {isCustom && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'var(--brand-100)', color: 'var(--brand-700)' }}>
                        CUSTOM
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {s.max_theory}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {s.max_practical > 0 ? s.max_practical : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isCustom}
                        onChange={e => setUseCustom(u => ({ ...u, [s.id]: e.target.checked }))}
                        style={{ accentColor: 'var(--brand-500)', width: '15px', height: '15px' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: isCustom ? 'var(--brand-700)' : 'var(--text-tertiary)' }}>
                        {isCustom ? 'Yes' : 'No'}
                      </span>
                    </label>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input"
                      value={cfg.max_theory}
                      onChange={e => setConfigs(c => ({ ...c, [s.id]: { ...c[s.id], max_theory: e.target.value } }))}
                      disabled={!isCustom}
                      min="1"
                      style={{
                        width: '80px', padding: '6px 8px', textAlign: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: '13px',
                        background: isCustom ? 'var(--surface-0)' : 'var(--gray-100)',
                        color: isCustom ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input"
                      value={cfg.max_practical}
                      onChange={e => setConfigs(c => ({ ...c, [s.id]: { ...c[s.id], max_practical: e.target.value } }))}
                      disabled={!isCustom || s.max_practical === 0}
                      min="0"
                      style={{
                        width: '80px', padding: '6px 8px', textAlign: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: '13px',
                        background: (isCustom && s.max_practical > 0) ? 'var(--surface-0)' : 'var(--gray-100)',
                        color: (isCustom && s.max_practical > 0) ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</>
            : 'Save Exam Configuration'
          }
        </button>
        {hasAnyCustom && (
          <button
            className="btn btn-secondary"
            onClick={handleClearAll}
            disabled={saving}
          >
            Reset to Subject Defaults
          </button>
        )}
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {hasAnyCustom
            ? `${subjects.filter(s => useCustom[s.id]).length} subject${subjects.filter(s => useCustom[s.id]).length !== 1 ? 's' : ''} with custom marks`
            : 'Using subject defaults for all subjects'
          }
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MarksEntry page
// ─────────────────────────────────────────────────────────────────────────────
export default function MarksEntry() {
  const [classes, setClasses]         = useState([])
  const [years, setYears]             = useState([])
  const [exams, setExams]             = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedYear, setSelectedYear]   = useState('')
  const [selectedExam, setSelectedExam]   = useState('')

  const [gridData, setGridData]       = useState(null)
  const [localMarks, setLocalMarks]   = useState({})
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [loadingGrid, setLoadingGrid] = useState(false)

  const [results, setResults]         = useState([])
  const [loadingResults, setLoadingResults] = useState(false)

  // Tabs: 'entry' | 'results' | 'subjects' | 'examconfig'
  const [view, setView]               = useState('entry')

  const [showNewExam, setShowNewExam] = useState(false)
  const [newExam, setNewExam]         = useState({ name: 'Unit Test 1', exam_date: '' })
  const [creatingExam, setCreatingExam] = useState(false)

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setSelectedYear(String(curr.id))
    })
  }, [])

  useEffect(() => {
    if (selectedClass && selectedYear) {
      marksAPI.getExams({ class_id: selectedClass, academic_year_id: selectedYear })
        .then(r => setExams(r.data))
    } else {
      setExams([])
    }
  }, [selectedClass, selectedYear])

  useEffect(() => {
    if (selectedExam && selectedClass && view === 'entry') {
      loadGrid()
    }
  }, [selectedExam, selectedClass])

  const loadGrid = useCallback(async () => {
    if (!selectedExam || !selectedClass) return
    setLoadingGrid(true)
    setSaved(false)
    try {
      const r = await marksAPI.getMarksEntry(selectedExam, selectedClass)
      setGridData(r.data)
      // Build local marks state
      const map = {}
      r.data.students.forEach(s => {
        map[s.student_id] = {}
        Object.entries(s.marks).forEach(([subId, m]) => {
          map[s.student_id][subId] = {
            theory:    m.theory    ?? '',
            practical: m.practical ?? '',
            is_absent: m.is_absent || false,
          }
        })
      })
      setLocalMarks(map)
    } catch {
      toast.error('Failed to load marks grid')
    } finally {
      setLoadingGrid(false)
    }
  }, [selectedExam, selectedClass])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleMarkChange = (studentId, subjectId, field, value) => {
    setLocalMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: { ...prev[studentId]?.[subjectId], [field]: value },
      },
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!gridData) return
    setSaving(true)
    try {
      const entries = []
      gridData.students.forEach(s => {
        gridData.subjects.forEach(sub => {
          const m = localMarks[s.student_id]?.[sub.id]
          entries.push({
            student_id:      s.student_id,
            subject_id:      sub.id,
            exam_id:         parseInt(selectedExam),
            theory_marks:    m?.theory !== '' && m?.theory !== undefined ? parseFloat(m.theory) : null,
            practical_marks: m?.practical !== '' && m?.practical !== undefined ? parseFloat(m.practical) : null,
            is_absent:       m?.is_absent || false,
          })
        })
      })
      await marksAPI.bulkSaveMarks(entries)
      setSaved(true)
      toast.success('Marks saved successfully')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleViewResults = async () => {
    setView('results')
    if (!selectedExam || !selectedClass) return
    setLoadingResults(true)
    try {
      const r = await marksAPI.getResults(selectedExam, selectedClass)
      setResults(r.data)
    } catch {
      toast.error('Failed to load results')
    } finally {
      setLoadingResults(false)
    }
  }

  const handleCreateExam = async () => {
    if (!selectedClass || !selectedYear) return
    setCreatingExam(true)
    try {
      await marksAPI.createExam({
        name:             newExam.name,
        class_id:         parseInt(selectedClass),
        academic_year_id: parseInt(selectedYear),
        exam_date:        newExam.exam_date || null,
      })
      const r = await marksAPI.getExams({ class_id: selectedClass, academic_year_id: selectedYear })
      setExams(r.data)
      setShowNewExam(false)
      toast.success(`Exam "${newExam.name}" created`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCreatingExam(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const yearOptions  = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))
  const hasSubjects  = gridData?.subjects?.length > 0
  const hasStudents  = gridData?.students?.length > 0
  const hasCustomConfig = gridData?.subjects?.some(s => s.has_custom_config)
  const examName     = exams.find(e => String(e.id) === selectedExam)?.name || 'Exam'

  // ── Tab definitions ────────────────────────────────────────────────────────
  const mainTabs = [
    { value: 'entry',     label: 'Marks Entry', icon: '📝' },
    { value: 'results',   label: 'Results',      icon: '📊' },
    { value: 'subjects',  label: 'Subjects',     icon: '📚' },
    ...(selectedExam ? [{ value: 'examconfig', label: 'Exam Marks Setup', icon: '⚙️' }] : []),
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Marks Entry"
        subtitle="Enter marks class-wise. Manage subjects dynamically. Set custom max marks per exam."
      />

      {/* Top filters */}
      <FilterRow>
        <Select
          value={selectedClass}
          onChange={e => { setSelectedClass(e.target.value); setSelectedExam(''); setGridData(null); setView('entry') }}
          options={classOptions}
          placeholder="Select class…"
          style={{ flex: 1, minWidth: '180px' }}
        />
        <Select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          options={yearOptions}
          placeholder="Select year…"
          style={{ flex: 1, minWidth: '160px' }}
        />
        <div style={{ flex: 2, minWidth: '200px', display: 'flex', gap: '8px' }}>
          <select
            className="input"
            value={selectedExam}
            onChange={e => { setSelectedExam(e.target.value); setView('entry'); setGridData(null) }}
            style={{ flex: 1 }}
          >
            <option value="">Select exam…</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => setShowNewExam(s => !s)}
            disabled={!selectedClass}
            title="Create new exam"
          >
            + New
          </button>
        </div>
      </FilterRow>

      {/* New exam form */}
      {showNewExam && selectedClass && (
        <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--brand-700)', marginBottom: '12px' }}>
            Create New Exam
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label className="label">Exam Type</label>
              <select className="input" value={newExam.name} onChange={e => setNewExam(n => ({ ...n, name: e.target.value }))}>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ width: '160px' }}>
              <label className="label">Date (optional)</label>
              <input type="date" className="input" value={newExam.exam_date} onChange={e => setNewExam(n => ({ ...n, exam_date: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={handleCreateExam} disabled={creatingExam}>
              {creatingExam ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Creating…</> : 'Create Exam'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowNewExam(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* No class selected — prompt */}
      {!selectedClass && (
        <div className="card">
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            title="Select a class to begin"
            description="Choose a class and academic year from the filters above"
          />
        </div>
      )}

      {/* Main content — class selected */}
      {selectedClass && (
        <>
          {/* Tab bar + contextual actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <TabBar
              tabs={mainTabs}
              active={view}
              onChange={v => {
                if (v === 'results') { handleViewResults(); return }
                if (v === 'entry' && selectedExam) loadGrid()
                setView(v)
              }}
            />

            {/* Contextual right-side actions */}
            {view === 'entry' && hasStudents && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {hasCustomConfig && (
                  <span style={{
                    fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px',
                    background: 'var(--brand-100)', color: 'var(--brand-700)',
                    border: '1px solid var(--brand-200)',
                  }}>
                    ⚙ Custom marks active
                  </span>
                )}
                {saved && (
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--success-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save All Marks'}
                </button>
              </div>
            )}

            {view === 'results' && selectedExam && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={`/api/v1/pdf/report/results?exam_id=${selectedExam}&class_id=${selectedClass}`}
                  target="_blank" rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none', fontSize: '12.5px' }}
                >
                  📋 Class Result PDF
                </a>
                <a
                  href={`/api/v1/pdf/marksheet/class/${selectedClass}?exam_id=${selectedExam}`}
                  target="_blank" rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none', fontSize: '12.5px' }}
                >
                  📄 Marksheets PDF
                </a>
              </div>
            )}
          </div>

          {/* ── TAB: Subjects Manager ── */}
          {view === 'subjects' && (
            <SubjectManager
              classId={selectedClass}
              onSubjectsChanged={() => {
                // Reload grid if an exam is open so the grid reflects subject changes
                if (selectedExam) loadGrid()
              }}
            />
          )}

          {/* ── TAB: Exam Config ── */}
          {view === 'examconfig' && selectedExam && (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Max Marks Setup — {examName}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  Customise the maximum marks for each subject specifically for this exam.
                  These overrides are used in grading, results, and marksheet PDFs.
                </div>
              </div>
              <ExamConfigPanel
                examId={parseInt(selectedExam)}
                classId={parseInt(selectedClass)}
                onConfigSaved={() => {
                  // Reload the grid so the header shows updated max marks
                  if (view === 'entry') loadGrid()
                  else loadGrid() // always refresh so user sees changes when they switch back
                }}
              />
            </div>
          )}

          {view === 'examconfig' && !selectedExam && (
            <InlineBanner
              type="warning"
              title="No exam selected"
              message="Select an exam from the filter above to configure its max marks."
            />
          )}

          {/* ── TAB: Marks Entry ── */}
          {view === 'entry' && (
            <>
              {!selectedExam ? (
                <div className="card">
                  <EmptyState
                    icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    title="Select an exam to enter marks"
                    description="Choose or create an exam using the filters above"
                  />
                </div>
              ) : (
                <div className="card">
                  {loadingGrid ? (
                    <table className="data-table"><TableSkeleton rows={8} cols={6} /></table>
                  ) : !hasSubjects ? (
                    <div style={{ padding: '20px' }}>
                      <InlineBanner
                        type="warning"
                        title="No subjects found for this class"
                        message="Go to the Subjects tab to add subjects or load GSEB defaults."
                      />
                    </div>
                  ) : !hasStudents ? (
                    <EmptyState
                      icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                      title="No students in this class"
                      description="Add students to this class to start entering marks"
                    />
                  ) : (
                    <>
                      <div style={{ padding: '10px 20px', background: 'var(--gray-50)', borderBottom: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span><strong>T</strong> = Theory</span>
                        <span><strong>P</strong> = Practical (where applicable)</span>
                        <span>Check <strong>Abs</strong> to mark absent</span>
                        {hasCustomConfig && (
                          <span style={{ color: 'var(--brand-700)', fontWeight: 700, background: 'var(--brand-50)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--brand-200)' }}>
                            ⚙ Custom max marks active for this exam
                          </span>
                        )}
                        <span style={{ color: 'var(--warning-600)', fontWeight: 600 }}>💡 Scroll right to see all subjects</span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px', minWidth: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{
                                position: 'sticky', left: 0, zIndex: 3,
                                background: 'var(--gray-50)', padding: '10px 16px',
                                textAlign: 'left', fontWeight: 700, fontSize: '11px',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-default)',
                                whiteSpace: 'nowrap', minWidth: '160px',
                                boxShadow: '2px 0 4px rgba(0,0,0,0.04)',
                              }}>
                                Student
                              </th>
                              <th style={{
                                background: 'var(--gray-50)', padding: '10px 12px',
                                fontWeight: 700, fontSize: '11px', textTransform: 'uppercase',
                                letterSpacing: '0.06em', color: 'var(--text-secondary)',
                                borderBottom: '1px solid var(--border-default)', width: '50px',
                              }}>Roll</th>
                              {gridData.subjects.map(sub => (
                                <th key={sub.id} style={{
                                  background: sub.has_custom_config ? 'var(--brand-50)' : 'var(--gray-50)',
                                  padding: '8px 10px',
                                  fontWeight: 700, fontSize: '11px',
                                  color: sub.has_custom_config ? 'var(--brand-700)' : 'var(--text-secondary)',
                                  borderBottom: '1px solid var(--border-default)',
                                  textAlign: 'center',
                                  minWidth: sub.max_practical > 0 ? '160px' : '110px',
                                  whiteSpace: 'nowrap',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    {sub.name}
                                    {sub.has_custom_config && (
                                      <span title="Custom marks for this exam" style={{ fontSize: '10px' }}>⚙</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '10px', fontWeight: 500, marginTop: '2px', color: sub.has_custom_config ? 'var(--brand-600)' : 'var(--text-tertiary)' }}>
                                    T/{sub.max_theory}{sub.max_practical > 0 ? ` · P/${sub.max_practical}` : ''}
                                    {sub.has_custom_config && (
                                      <span style={{ marginLeft: '3px' }}>(custom)</span>
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {gridData.students.map((student, si) => (
                              <tr key={student.student_id} style={{ background: si % 2 === 0 ? 'var(--surface-0)' : 'var(--gray-25)' }}>
                                <td style={{
                                  position: 'sticky', left: 0, zIndex: 2,
                                  background: si % 2 === 0 ? 'var(--surface-0)' : 'var(--gray-25)',
                                  padding: '8px 16px', fontWeight: 600,
                                  color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)',
                                  boxShadow: '2px 0 4px rgba(0,0,0,0.04)', whiteSpace: 'nowrap',
                                }}>
                                  {student.student_name}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                                  {student.roll_number || '—'}
                                </td>
                                {gridData.subjects.map(sub => {
                                  const m = localMarks[student.student_id]?.[sub.id] || {}
                                  return (
                                    <td key={sub.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center', background: sub.has_custom_config && si % 2 === 0 ? '#fafbff' : undefined }}>
                                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                                        <input
                                          type="number"
                                          min="0"
                                          max={sub.max_theory}
                                          value={m.theory ?? ''}
                                          onChange={e => handleMarkChange(student.student_id, sub.id, 'theory', e.target.value)}
                                          disabled={m.is_absent}
                                          placeholder={`/${sub.max_theory}`}
                                          style={{
                                            width: '52px', padding: '5px 4px',
                                            border: '1.5px solid var(--border-default)',
                                            borderRadius: '6px', fontSize: '12px',
                                            textAlign: 'center', outline: 'none',
                                            fontFamily: 'var(--font-mono)',
                                            background: m.is_absent ? 'var(--gray-100)' : 'var(--surface-0)',
                                            color: m.is_absent ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                            transition: 'border-color 0.12s',
                                          }}
                                          onFocus={e => e.target.style.borderColor = 'var(--brand-500)'}
                                          onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                        />
                                        {sub.max_practical > 0 && (
                                          <input
                                            type="number"
                                            min="0"
                                            max={sub.max_practical}
                                            value={m.practical ?? ''}
                                            onChange={e => handleMarkChange(student.student_id, sub.id, 'practical', e.target.value)}
                                            disabled={m.is_absent}
                                            placeholder={`P/${sub.max_practical}`}
                                            style={{
                                              width: '52px', padding: '5px 4px',
                                              border: '1.5px solid var(--border-default)',
                                              borderRadius: '6px', fontSize: '12px',
                                              textAlign: 'center', outline: 'none',
                                              fontFamily: 'var(--font-mono)',
                                              background: m.is_absent ? 'var(--gray-100)' : 'var(--surface-0)',
                                              color: m.is_absent ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                            }}
                                            onFocus={e => e.target.style.borderColor = 'var(--brand-500)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                          />
                                        )}
                                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '1px' }}>
                                          <input
                                            type="checkbox"
                                            checked={m.is_absent || false}
                                            onChange={e => handleMarkChange(student.student_id, sub.id, 'is_absent', e.target.checked)}
                                            style={{ accentColor: 'var(--danger-500)', width: '13px', height: '13px' }}
                                          />
                                          <span style={{ fontSize: '9px', color: 'var(--danger-500)', fontWeight: 700 }}>Abs</span>
                                        </label>
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                          {gridData.students.length} student{gridData.students.length !== 1 ? 's' : ''} · {gridData.subjects.length} subject{gridData.subjects.length !== 1 ? 's' : ''}
                        </span>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                          {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save All Marks'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── TAB: Results ── */}
          {view === 'results' && (
            <div className="card">
              {loadingResults ? (
                <table className="data-table"><TableSkeleton rows={6} cols={8} /></table>
              ) : results.length === 0 ? (
                <EmptyState
                  icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  title="No results yet"
                  description="Save marks in the Entry tab to generate results"
                />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Student</th>
                      <th>Roll</th>
                      <th>Total</th>
                      <th style={{ textAlign: 'center' }}>%</th>
                      <th style={{ textAlign: 'center' }}>CGPA</th>
                      <th style={{ textAlign: 'center' }}>Grade</th>
                      <th style={{ textAlign: 'center' }}>Result</th>
                      <th style={{ textAlign: 'center' }}>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.student_id}>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '22px', borderRadius: '6px',
                            fontSize: '11px', fontWeight: 800,
                            background: r.class_rank === 1 ? '#fef3c7' : r.class_rank <= 3 ? 'var(--gray-100)' : 'transparent',
                            color: r.class_rank === 1 ? '#b45309' : 'var(--text-secondary)',
                          }}>
                            #{r.class_rank}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.student_name}</td>
                        <td style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{r.roll_number || '—'}</td>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {Math.round(r.total_marks)}/{Math.round(r.max_marks)}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--brand-600)' }}>
                          {Number(r.percentage).toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.cgpa}</td>
                        <td style={{ textAlign: 'center' }}><GradeBadge grade={r.grade} /></td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11.5px', fontWeight: 800,
                            padding: '3px 9px', borderRadius: '20px',
                            background: r.result === 'PASS' ? 'var(--success-100)' : 'var(--danger-100)',
                            color: r.result === 'PASS' ? 'var(--success-700)' : 'var(--danger-700)',
                          }}>
                            {r.result}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <a
                            href={`/api/v1/pdf/marksheet/student/${r.student_id}?exam_id=${selectedExam}&class_id=${selectedClass}`}
                            target="_blank" rel="noreferrer"
                            style={{ fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)', textDecoration: 'none' }}
                          >
                            📄 PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}