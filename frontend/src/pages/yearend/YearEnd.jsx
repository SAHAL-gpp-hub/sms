// frontend/src/pages/yearend/YearEnd.jsx
// Full rebuild covering every planning-doc requirement:
//   • Draft → Activate year lifecycle
//   • Pre-promotion validation gate
//   • Per-student candidate list with suggested actions
//   • Bulk promotion with student_actions overrides
//   • Undo promotion
//   • Mark locking
//   • Clone fee structure / subjects
//   • Academic calendar (holiday CRUD + seed)
//   • Audit log viewer
//   • Enrollment backfill (one-time)
//   • TC generation
//
// FIX: PromotionTab now owns its own Source Academic Year selector and fetches
//      classes scoped to that year via setupAPI.getClasses(sourceYearId).
//      This decouples the promotion workflow from the globally-active year so
//      promotions can be run even after a new year has been activated.

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { clearYearCache, marksAPI, setupAPI, yearendAPI, extractError } from '../../services/api'
import {
  PageHeader, TabBar, EmptyState, InlineBanner,
  ConfirmModal, Select,
} from '../../components/UI'

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — editorial charcoal + saffron accent palette
// ─────────────────────────────────────────────────────────────────────────────
const YE_CSS = `
  .ye-root { font-family: var(--font-sans); }

  /* Section cards */
  .ye-card {
    background: var(--surface-0);
    border: 1px solid var(--border-default);
    border-radius: 14px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    margin-bottom: 14px;
  }
  .ye-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--gray-50);
  }
  .ye-card-icon {
    width: 34px; height: 34px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
    background: var(--brand-100); color: var(--brand-700);
  }
  .ye-card-title { font-size: 14px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em; }
  .ye-card-sub   { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
  .ye-card-body  { padding: 20px; }

  /* Year status pill */
  .ye-status-draft    { background:#fef3c7; color:#b45309; border:1px solid #fde68a; }
  .ye-status-active   { background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; }
  .ye-status-closed   { background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; }
  .ye-status-pill {
    font-size:10.5px; font-weight:800; padding:2px 9px;
    border-radius:20px; text-transform:uppercase; letter-spacing:0.05em;
  }

  /* Candidate action selector */
  .ye-action-btn {
    padding: 4px 10px; border-radius: 6px; font-size: 11.5px;
    font-weight: 700; border: 1.5px solid; cursor: pointer;
    font-family: var(--font-sans); transition: all 0.12s; white-space: nowrap;
    touch-action: manipulation;
  }
  .ye-action-promoted   { background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; }
  .ye-action-retained   { background:#fef3c7; color:#b45309; border-color:#fde68a; }
  .ye-action-graduated  { background:#f0fdf4; color:#15803d; border-color:#bbf7d0; }
  .ye-action-transferred{ background:#faf5ff; color:#7c3aed; border-color:#e9d5ff; }
  .ye-action-dropped    { background:#fff1f2; color:#be123c; border-color:#fecdd3; }
  .ye-action-on_hold    { background:#f8fafc; color:#64748b; border-color:#cbd5e1; }
  .ye-action-active.ye-action-promoted   { background:#1d4ed8; color:white; border-color:#1d4ed8; }
  .ye-action-active.ye-action-retained   { background:#b45309; color:white; border-color:#b45309; }
  .ye-action-active.ye-action-graduated  { background:#15803d; color:white; border-color:#15803d; }
  .ye-action-active.ye-action-transferred{ background:#7c3aed; color:white; border-color:#7c3aed; }
  .ye-action-active.ye-action-dropped    { background:#be123c; color:white; border-color:#be123c; }
  .ye-action-active.ye-action-on_hold    { background:#64748b; color:white; border-color:#64748b; }

  /* Candidate row flags */
  .ye-flag { display:inline-flex; align-items:center; gap:3px; font-size:10.5px; font-weight:700; padding:1px 7px; border-radius:20px; }
  .ye-flag-dues { background:#fee2e2; color:#b91c1c; }
  .ye-flag-att  { background:#fef3c7; color:#b45309; }
  .ye-flag-nomarks { background:#f1f5f9; color:#64748b; }

  /* Audit log */
  .ye-audit-row { display:flex; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-subtle); align-items:flex-start; }
  .ye-audit-op { font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px; background:var(--brand-50); color:var(--brand-700); white-space:nowrap; }
  .ye-audit-success { background:#dcfce7; color:#15803d; }
  .ye-audit-failed  { background:#fee2e2; color:#b91c1c; }
  .ye-audit-partial { background:#fef3c7; color:#b45309; }

  /* Calendar event type */
  .ye-evt-holiday    { background:#fee2e2; color:#b91c1c; }
  .ye-evt-exam_period{ background:#eff6ff; color:#1d4ed8; }
  .ye-evt-term_start { background:#f0fdf4; color:#15803d; }
  .ye-evt-event      { background:#faf5ff; color:#7c3aed; }

  /* Two-column grid on wider screens */
  .ye-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:700px) { .ye-grid-2 { grid-template-columns:1fr; } }

  /* Responsive form row */
  .ye-form-row { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; }
  .ye-form-row > * { flex:1; min-width:140px; }

  /* Step badge */
  .ye-step-badge {
    width:26px; height:26px; border-radius:50%; background:var(--brand-600);
    color:white; font-size:12px; font-weight:900; display:flex;
    align-items:center; justify-content:center; flex-shrink:0;
  }

  /* Scrollable table wrapper */
  .ye-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .ye-table-wrap::-webkit-scrollbar { height:3px; }
`

if (typeof document !== 'undefined' && !document.getElementById('ye-css')) {
  const s = document.createElement('style')
  s.id = 'ye-css'
  s.textContent = YE_CSS
  document.head.appendChild(s)
}

const ACTIONS = ['promoted', 'retained', 'graduated', 'transferred', 'dropped', 'on_hold']
const ACTION_LABELS = {
  promoted: 'Promote', retained: 'Retain', graduated: 'Graduate',
  transferred: 'Transfer', dropped: 'Drop', on_hold: 'Hold',
  suggested: 'Use Suggestions',
}
const ALL_CLASS_ACTIONS = ['suggested', ...ACTIONS]
const formatClassOptionLabel = (cls) => {
  const name = String(cls?.name || '').trim()
  const division = cls?.division ? ` — Div ${cls.division}` : ''
  return `${name || 'Unnamed class'}${division}`
}
const normalizeClassDisplayName = (name) => {
  const raw = String(name || '').trim()
  const match = raw.match(/^(standard|std\.?|class|grade)\s+(.+)$/i)
  return match ? match[2].trim() : raw
}
const sortClassGroups = (a, b) => {
  const order = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const ai = order.indexOf(a.name)
  const bi = order.indexOf(b.name)
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  return a.name.localeCompare(b.name, undefined, { numeric: true })
}
const candidateFlagCounts = (candidates = []) => candidates.reduce((acc, c) => {
  if (c.flags?.has_pending_dues) acc.dues += 1
  if (c.flags?.low_attendance) acc.lowAttendance += 1
  if (c.flags?.no_marks_entered) acc.noMarks += 1
  return acc
}, { dues: 0, lowAttendance: 0, noMarks: 0 })
const totalFlagCount = (counts) => counts.dues + counts.lowAttendance + counts.noMarks
const statusMeta = {
  pending: { label: 'Pending', color: 'var(--text-tertiary)', bg: '#94a3b8' },
  loading: { label: 'Previewing', color: 'var(--brand-600)', bg: 'var(--brand-500)' },
  running: { label: 'Running', color: 'var(--brand-600)', bg: 'var(--brand-500)' },
  done:    { label: 'Done', color: 'var(--success-700)', bg: 'var(--success-500)' },
  failed:  { label: 'Failed', color: 'var(--danger-700)', bg: 'var(--danger-500)' },
}

function YeCard({ icon, title, sub, children, badge, right }) {
  return (
    <div className="ye-card">
      <div className="ye-card-header">
        <div className="ye-card-icon">{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ye-card-title">{title}</div>
          {sub && <div className="ye-card-sub">{sub}</div>}
        </div>
        {badge}
        {right}
      </div>
      <div className="ye-card-body">{children}</div>
    </div>
  )
}

function StatusPill({ status }) {
  const cls = `ye-status-pill ye-status-${status}`
  const labels = { draft: 'Draft', active: 'Active', closed: 'Closed' }
  return <span className={cls}>{labels[status] || status}</span>
}

function Spinner({ size = 14 }) {
  return <span className="spinner" style={{ width: size, height: size }} />
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Academic Year Lifecycle
// ─────────────────────────────────────────────────────────────────────────────
function YearLifecycleTab({ years, onRefresh }) {
  const [form, setForm] = useState({ label: '', start_date: '', end_date: '' })
  const [creating, setCreating] = useState(false)
  const [activating, setActivating] = useState(null)

  const handleCreate = async () => {
    if (!form.label || !form.start_date || !form.end_date) {
      toast.error('All fields required')
      return
    }
    if (form.start_date >= form.end_date) {
      toast.error('End date must be after start date')
      return
    }
    setCreating(true)
    try {
      const r = await yearendAPI.createNewYear(form)
      toast.success(`${r.data.label} created as Draft`)
      setForm({ label: '', start_date: '', end_date: '' })
      onRefresh()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCreating(false)
    }
  }

  const handleActivate = async (yearId, label) => {
    setActivating(yearId)
    try {
      await yearendAPI.activateYear(yearId, false)
      clearYearCache()
      toast.success(`${label} is now Active`)
      onRefresh()
    } catch (err) {
      const msg = extractError(err)
      if (msg.includes('No classes') || msg.includes('No fee') || msg.includes('No subject')) {
        toast.error(`Validation: ${msg}. Use force-activate if intentional.`)
      } else {
        toast.error(msg)
      }
    } finally {
      setActivating(null)
    }
  }

  const handleForceActivate = async (yearId, label) => {
    setActivating(yearId)
    try {
      await yearendAPI.activateYear(yearId, true)
      clearYearCache()
      toast.success(`${label} force-activated`)
      onRefresh()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setActivating(null)
    }
  }

  return (
    <div>
      <YeCard icon="📅" title="Create Academic Year" sub="New years start as Draft — configure classes, fees, subjects, then activate">
        <div className="ye-form-row" style={{ marginBottom: 14 }}>
          <div>
            <label className="label">Year Label *</label>
            <input className="input" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. 2026-27" />
          </div>
          <div>
            <label className="label">Start Date *</label>
            <input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">End Date *</label>
            <input type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreate} disabled={creating}>
          {creating ? <><Spinner /> Creating…</> : '+ Create Draft Year'}
        </button>
      </YeCard>

      <YeCard icon="🗂" title="All Academic Years" sub="Draft → Active → Closed lifecycle">
        {years.length === 0 ? (
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            title="No years yet"
          />
        ) : (
          <div>
            {years.map(y => (
              <div key={y.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{y.label}</span>
                    <StatusPill status={y.status} />
                    {y.is_current && <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--brand-600)', color: 'white', padding: '1px 7px', borderRadius: 20 }}>CURRENT</span>}
                    {y.is_upcoming && <span style={{ fontSize: 10, fontWeight: 800, background: '#7c3aed', color: 'white', padding: '1px 7px', borderRadius: 20 }}>UPCOMING</span>}
                  </div>
                </div>
                {y.status === 'draft' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-success btn-sm"
                      disabled={activating === y.id}
                      onClick={() => handleActivate(y.id, y.label)}
                    >
                      {activating === y.id ? <Spinner /> : '✓ Activate'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={activating === y.id}
                      onClick={() => handleForceActivate(y.id, y.label)}
                      title="Skip validation checks"
                    >
                      Force
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </YeCard>

      <YeCard icon="🔧" title="Backfill Enrollments" sub="One-time migration — run once after deploying the new schema">
        <InlineBanner type="info" message="Creates Enrollment records for all existing students. Safe to run multiple times (idempotent)." />
        <button
          className="btn btn-secondary"
          style={{ marginTop: 12, width: '100%' }}
          onClick={async () => {
            try {
              const r = await yearendAPI.backfillEnrollments()
              toast.success(`Backfill complete — ${r.data.created} created, ${r.data.skipped} skipped`)
            } catch (err) {
              toast.error(extractError(err))
            }
          }}
        >
          Run Enrollment Backfill
        </button>
      </YeCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Bulk Promotion
//
// KEY FIX: This tab now owns a "Source Academic Year" selector. When changed,
// it fetches classes scoped to that year via setupAPI.getClasses(sourceYearId).
// This means promotion always operates on the correct year's class list,
// independent of whichever year is globally active.
// ─────────────────────────────────────────────────────────────────────────────
function PromotionTab({ years, onRefresh }) {
  const [promotionMode, setPromotionMode] = useState('single')

  // ── Source-year-scoped class state ──────────────────────────────────────────
  const [selectedSourceYear, setSelectedSourceYear] = useState('')
  const [sourceClasses, setSourceClasses]           = useState([])
  const [loadingClasses, setLoadingClasses]         = useState(false)
  const [allClassRows, setAllClassRows]             = useState([])
  const [previewingAll, setPreviewingAll]           = useState(false)
  const [runningAll, setRunningAll]                 = useState(false)
  const [allRunResult, setAllRunResult]             = useState(null)

  // ── Promotion selectors ─────────────────────────────────────────────────────
  const [selectedClass, setSelectedClass]     = useState('')
  const [selectedNewYear, setSelectedNewYear] = useState('')
  const [previewData, setPreviewData]         = useState(null)
  const [validation, setValidation]           = useState(null)
  const [candidates, setCandidates]           = useState(null)
  const [studentActions, setStudentActions]   = useState({})
  const [rollStrategy, setRollStrategy]       = useState('sequential')
  const [forcePromote, setForcePromote]       = useState(false)
  const [promoting, setPromoting]             = useState(false)
  const [undoing, setUndoing]                 = useState(false)
  const [confirmPromote, setConfirmPromote]   = useState(false)
  const [result, setResult]                   = useState(null)
  const [phase, setPhase]                     = useState('setup') // setup | review | done

  // ── Fetch classes whenever source year changes ──────────────────────────────
  useEffect(() => {
    if (!selectedSourceYear) {
      setSourceClasses([])
      setSelectedClass('')
      setAllClassRows([])
      return
    }
    setLoadingClasses(true)
    setSelectedClass('')
    setAllClassRows([])
    setAllRunResult(null)
    setPhase('setup')
    setResult(null)
    setCandidates(null)
    setPreviewData(null)
    setValidation(null)
    setupAPI.getClasses(parseInt(selectedSourceYear))
      .then(r => setSourceClasses(r.data || []))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoadingClasses(false))
  }, [selectedSourceYear])

  useEffect(() => {
    if (promotionMode !== 'all' || !selectedSourceYear || !selectedNewYear || sourceClasses.length === 0) {
      if (promotionMode === 'all') setAllClassRows([])
      return
    }

    let cancelled = false
    const buildPreview = async () => {
      setPreviewingAll(true)
      setAllRunResult(null)

      const candidateResults = await Promise.allSettled(
        sourceClasses.map(cls => yearendAPI.getCandidates(cls.id))
      )
      if (cancelled) return

      const groups = new Map()
      sourceClasses.forEach((cls, idx) => {
        const name = normalizeClassDisplayName(cls.name)
        const key = name || `class-${cls.id}`
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            name,
            included: true,
            expanded: false,
            action: 'suggested',
            status: 'pending',
            error: '',
            results: [],
            divisions: [],
          })
        }

        const settled = candidateResults[idx]
        const candidates = settled.status === 'fulfilled'
          ? settled.value.data?.candidates || []
          : []
        const flagCounts = candidateFlagCounts(candidates)
        groups.get(key).divisions.push({
          classId: cls.id,
          division: cls.division || 'A',
          originalName: cls.name,
          candidates,
          flagCounts,
          studentCount: candidates.length,
          previewError: settled.status === 'rejected' ? extractError(settled.reason) : '',
        })
      })

      setAllClassRows(
        Array.from(groups.values())
          .map(group => ({
            ...group,
            divisions: group.divisions.sort((a, b) => String(a.division).localeCompare(String(b.division), undefined, { numeric: true })),
          }))
          .sort(sortClassGroups)
      )
      setPreviewingAll(false)
    }

    buildPreview().catch(err => {
      if (!cancelled) {
        setPreviewingAll(false)
        toast.error(extractError(err))
      }
    })

    return () => { cancelled = true }
  }, [promotionMode, selectedSourceYear, selectedNewYear, sourceClasses])

  const fetchPreview = useCallback(async () => {
    if (!selectedClass || !selectedNewYear) return
    try {
      const r = await yearendAPI.previewPromotion(selectedClass, selectedNewYear)
      setPreviewData(r.data)
      setValidation(r.data.validation)
    } catch (err) {
      toast.error(extractError(err))
    }
  }, [selectedClass, selectedNewYear])

  const fetchCandidates = useCallback(async () => {
    if (!selectedClass) return
    try {
      const r = await yearendAPI.getCandidates(selectedClass)
      const list = r.data.candidates || []
      setCandidates(list)
      const actions = {}
      list.forEach(c => { actions[c.student_id] = c.suggested_action })
      setStudentActions(actions)
    } catch (err) {
      toast.error(extractError(err))
    }
  }, [selectedClass])

  const handleReview = async () => {
    await fetchPreview()
    await fetchCandidates()
    setPhase('review')
    setResult(null)
  }

  const handlePromote = async () => {
    if (!selectedClass || !selectedNewYear) return
    setPromoting(true)
    try {
      const r = await yearendAPI.promoteClass(selectedClass, {
        new_academic_year_id: parseInt(selectedNewYear),
        student_actions: studentActions,
        roll_strategy:   rollStrategy,
        force:           forcePromote,
      })
      setResult({ type: 'success', data: r.data })
      setPhase('done')
      toast.success(`Promotion complete — ${r.data.promoted} promoted`)
      onRefresh?.()
    } catch (err) {
      const msg = extractError(err)
      setResult({ type: 'error', message: msg })
      toast.error(msg)
    } finally {
      setPromoting(false)
      setConfirmPromote(false)
    }
  }

  const handleUndo = async () => {
    if (!selectedClass || !selectedNewYear) return
    setUndoing(true)
    try {
      const r = await yearendAPI.undoPromotion(selectedClass, parseInt(selectedNewYear))
      toast.success(`Undo complete — ${r.data.undone} records reversed`)
      setPhase('setup')
      setResult(null)
      setCandidates(null)
      setValidation(null)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setUndoing(false)
    }
  }

  const setAll = (action) => {
    const actions = {}
    candidates?.forEach(c => { actions[c.student_id] = action })
    setStudentActions(actions)
  }

  const updateAllClassRow = (key, updater) => {
    setAllClassRows(rows => rows.map(row => row.key === key ? updater(row) : row))
  }

  const toggleAllRows = (included) => {
    setAllClassRows(rows => rows.map(row => ({ ...row, included })))
  }

  const handleRunAllClasses = async () => {
    const selectedRows = allClassRows.filter(row => row.included)
    if (!selectedRows.length || !selectedNewYear) return

    setRunningAll(true)
    setAllRunResult(null)
    const failures = []
    let done = 0

    for (const row of selectedRows) {
      updateAllClassRow(row.key, current => ({ ...current, status: 'running', error: '', results: [] }))
      const rowResults = []
      const rowFailures = []

      for (const div of row.divisions) {
        try {
          const studentActionsForClass = {}
          div.candidates.forEach(c => {
            studentActionsForClass[c.student_id] = row.action === 'suggested'
              ? c.suggested_action
              : row.action
          })
          const r = await yearendAPI.promoteClass(div.classId, {
            new_academic_year_id: parseInt(selectedNewYear),
            student_actions: studentActionsForClass,
            roll_strategy: rollStrategy,
            force: forcePromote,
          })
          rowResults.push({ division: div.division, data: r.data })
        } catch (err) {
          const message = extractError(err)
          rowFailures.push(`Div ${div.division}: ${message}`)
        }
      }

      if (rowFailures.length > 0) {
        failures.push({ className: row.name, messages: rowFailures })
        updateAllClassRow(row.key, current => ({
          ...current,
          status: 'failed',
          error: rowFailures.join(' · '),
          results: rowResults,
        }))
      } else {
        done += 1
        updateAllClassRow(row.key, current => ({ ...current, status: 'done', results: rowResults }))
      }
    }

    setAllRunResult({ done, failed: failures.length, failures, total: selectedRows.length })
    setRunningAll(false)
    onRefresh?.()
  }

  // Target years = any year that isn't the source year
  const targetYears = years.filter(y => String(y.id) !== selectedSourceYear && (y.status === 'draft' || y.status === 'active'))
  const classOptions = sourceClasses.map(c => ({ value: String(c.id), label: formatClassOptionLabel(c) }))
  const yearOptions  = targetYears.map(y => ({
    value: String(y.id),
    label: y.label + (y.is_current ? ' (Current)' : y.status === 'draft' ? ' (Draft)' : ''),
  }))

  const sourceYearLabel = years.find(y => String(y.id) === selectedSourceYear)?.label
  const selectedAllRows = allClassRows.filter(row => row.included)
  const allClassTotals = selectedAllRows.reduce((acc, row) => {
    row.divisions.forEach(div => {
      acc.students += div.studentCount
      acc.flags += totalFlagCount(div.flagCounts)
    })
    return acc
  }, { students: 0, flags: 0 })

  return (
    <div>
      {/* Step 1 — Source year + class + target year */}
      <YeCard
        icon="🎓"
        title="Bulk Promotion"
        sub={promotionMode === 'all'
          ? 'Promote students across all standards and divisions in one operation'
          : 'Select the source year first — classes are loaded for that year specifically'}
      >
        <div style={{
          display: 'inline-flex',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 16,
          background: 'var(--surface-0)',
        }}>
          {[
            { value: 'single', label: 'Single class' },
            { value: 'all', label: 'All classes' },
          ].map(mode => (
            <button
              key={mode.value}
              type="button"
              onClick={() => {
                setPromotionMode(mode.value)
                setPhase('setup')
                setResult(null)
                setValidation(null)
                setCandidates(null)
                setAllRunResult(null)
              }}
              style={{
                border: 0,
                padding: '7px 18px',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                color: promotionMode === mode.value ? 'var(--brand-700)' : 'var(--text-secondary)',
                background: promotionMode === mode.value ? 'var(--brand-50)' : 'transparent',
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* ── Source Academic Year — NEW ─────────────────────────────────── */}
        <div style={{ marginBottom: 14 }}>
          <label className="label">
            Source Academic Year
            <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--brand-600)', background: 'var(--brand-50)', padding: '1px 7px', borderRadius: 20 }}>
              Step 1
            </span>
          </label>
          <select
            className="input"
            value={selectedSourceYear}
            onChange={e => setSelectedSourceYear(e.target.value)}
          >
            <option value="">Select the year students are currently in…</option>
            {years.map(y => (
              <option key={y.id} value={String(y.id)}>
                {y.label}
                {y.is_current ? ' (Current)' : ''}
                {` — ${y.status}`}
              </option>
            ))}
          </select>
          {selectedSourceYear && (
            <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              {loadingClasses
                ? '⏳ Loading classes…'
                : `${sourceClasses.length} class${sourceClasses.length !== 1 ? 'es' : ''} found for ${sourceYearLabel}`}
            </div>
          )}
        </div>

        {/* ── Class + Target Year + Roll Strategy ──────────────────────── */}
        <div className="ye-form-row" style={{ marginBottom: 14 }}>
          {promotionMode === 'single' && (
            <div>
              <label className="label">
                From Class
                <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--brand-600)', background: 'var(--brand-50)', padding: '1px 7px', borderRadius: 20 }}>
                  Step 2
                </span>
              </label>
              <select
                className="input"
                value={selectedClass}
                disabled={!selectedSourceYear || loadingClasses || sourceClasses.length === 0}
                onChange={e => {
                  setSelectedClass(e.target.value)
                  setPhase('setup')
                  setResult(null)
                  setCandidates(null)
                  setPreviewData(null)
                  setValidation(null)
                }}
              >
                <option value="">
                  {!selectedSourceYear
                    ? 'Select source year first…'
                    : loadingClasses
                    ? 'Loading…'
                    : sourceClasses.length === 0
                    ? 'No classes in this year'
                    : 'Select class…'}
                </option>
                {classOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">
              Into Academic Year
              <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--brand-600)', background: 'var(--brand-50)', padding: '1px 7px', borderRadius: 20 }}>
                {promotionMode === 'all' ? 'Step 2' : 'Step 3'}
              </span>
            </label>
            <select
              className="input"
              value={selectedNewYear}
              disabled={!selectedSourceYear}
              onChange={e => {
                setSelectedNewYear(e.target.value)
                setPhase('setup')
                setResult(null)
                setPreviewData(null)
                setValidation(null)
              }}
            >
              <option value="">Select target year…</option>
              {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Roll Strategy</label>
            <select className="input" value={rollStrategy} onChange={e => setRollStrategy(e.target.value)}>
              <option value="sequential">Sequential (keep order)</option>
              <option value="alphabetical">Alphabetical (A–Z)</option>
              <option value="carry_forward">Carry Forward (same numbers)</option>
            </select>
          </div>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
          <input type="checkbox" checked={forcePromote} onChange={e => setForcePromote(e.target.checked)} />
          Force promotion when preflight has blocking issues
        </label>

        {promotionMode === 'single' && phase === 'setup' && (
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!selectedClass || !selectedNewYear}
            onClick={handleReview}
          >
            Review Candidates →
          </button>
        )}

        {/* Validation banner */}
        {promotionMode === 'single' && validation && (
          <div style={{ marginTop: 14 }}>
            {validation.errors?.length > 0 && (
              <InlineBanner type="danger" title="Blocking issues" message={validation.errors.join(' · ')} />
            )}
            {validation.warnings?.length > 0 && (
              <InlineBanner type="warning" message={validation.warnings.join(' · ')} />
            )}
            {validation.can_proceed && validation.errors?.length === 0 && (
              <InlineBanner type="success" message="Preflight checks passed — ready to promote." />
            )}
          </div>
        )}
      </YeCard>

      {promotionMode === 'all' && selectedSourceYear && selectedNewYear && (
        <YeCard
          icon="📋"
          title={`Class preview — ${allClassRows.length} classes · ${allClassTotals.students} students`}
          sub={`${selectedAllRows.length} classes checked · ${allClassRows.length - selectedAllRows.length} excluded`}
          right={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => toggleAllRows(true)} disabled={runningAll}>Select all</button>
              <button className="btn btn-secondary btn-sm" onClick={() => toggleAllRows(false)} disabled={runningAll}>Deselect all</button>
            </div>
          }
        >
          {previewingAll ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Spinner /> Loading class previews…
            </div>
          ) : allClassRows.length === 0 ? (
            <EmptyState
              icon="🎓"
              title="No classes found"
              description="Choose a source year with configured classes to build the bulk promotion preview."
            />
          ) : (
            <>
              <InlineBanner
                type="info"
                message={`Showing ${allClassRows.length} class${allClassRows.length !== 1 ? 'es' : ''} for ${sourceYearLabel}. Uncheck any class to exclude it from the bulk run.`}
              />
              <div className="ye-table-wrap">
                <table className="data-table" style={{ minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedAllRows.length === allClassRows.length}
                          onChange={e => toggleAllRows(e.target.checked)}
                          disabled={runningAll}
                        />
                      </th>
                      <th>Class</th>
                      <th>Divisions</th>
                      <th style={{ textAlign: 'right' }}>Students</th>
                      <th style={{ textAlign: 'center' }}>Flags</th>
                      <th style={{ textAlign: 'center' }}>Default action</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allClassRows.map(row => {
                      const students = row.divisions.reduce((sum, div) => sum + div.studentCount, 0)
                      const flags = row.divisions.reduce((sum, div) => sum + totalFlagCount(div.flagCounts), 0)
                      const meta = statusMeta[row.status] || statusMeta.pending
                      return (
                        <>
                          <tr key={row.key} style={{ opacity: row.included ? 1 : 0.45 }}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={row.included}
                                disabled={runningAll}
                                onChange={e => updateAllClassRow(row.key, current => ({ ...current, included: e.target.checked }))}
                              />
                            </td>
                            <td style={{ fontWeight: 800 }}>{row.name}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {row.divisions.map(div => (
                                  <span key={div.classId} className="ye-flag ye-flag-nomarks">Div {div.division}</span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{students}</td>
                            <td style={{ textAlign: 'center' }}>
                              {flags > 0
                                ? <span className="ye-flag ye-flag-dues">{flags} flags</span>
                                : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <select
                                className="input"
                                value={row.action}
                                disabled={runningAll}
                                onChange={e => updateAllClassRow(row.key, current => ({ ...current, action: e.target.value }))}
                                style={{ maxWidth: 140, padding: '5px 8px', fontSize: 12, margin: '0 auto' }}
                              >
                                {ALL_CLASS_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
                              </select>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: meta.color, fontSize: 12, fontWeight: 800 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.bg, display: 'inline-block' }} />
                                {meta.label}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => updateAllClassRow(row.key, current => ({ ...current, expanded: !current.expanded }))}
                              >
                                {row.expanded ? 'Hide' : 'Preview'}
                              </button>
                            </td>
                          </tr>
                          {row.expanded && (
                            <tr key={`${row.key}-expanded`}>
                              <td colSpan="8" style={{ background: 'var(--surface-1)', padding: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                  Per-division breakdown
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                                  {row.divisions.map(div => (
                                    <div
                                      key={div.classId}
                                      style={{
                                        background: 'var(--surface-0)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 8,
                                        padding: 10,
                                      }}
                                    >
                                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Division {div.division}</div>
                                      {[
                                        ['Students', div.studentCount, 'var(--text-primary)'],
                                        ['Pending dues', div.flagCounts.dues, 'var(--warning-600)'],
                                        ['Low attendance', div.flagCounts.lowAttendance, 'var(--warning-600)'],
                                        ['No marks', div.flagCounts.noMarks, 'var(--danger-700)'],
                                      ].map(([label, value, color]) => (
                                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                          <span>{label}</span>
                                          <span style={{ fontWeight: 800, color: value > 0 ? color : 'var(--text-primary)' }}>{value}</span>
                                        </div>
                                      ))}
                                      {div.previewError && (
                                        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--danger-700)' }}>{div.previewError}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {row.error && (
                                  <InlineBanner type="danger" message={row.error} />
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                paddingTop: 14,
                marginTop: 14,
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}><strong>{selectedAllRows.length}</strong> classes selected</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}><strong>{allClassTotals.students}</strong> students</span>
                <span style={{ fontSize: 12.5, color: 'var(--warning-600)' }}><strong>{allClassTotals.flags}</strong> flags</span>
                <div style={{ flex: 1 }} />
                <button
                  className="btn btn-success"
                  disabled={runningAll || selectedAllRows.length === 0}
                  onClick={handleRunAllClasses}
                >
                  {runningAll ? <><Spinner /> Running…</> : `▶ Run promotion for ${selectedAllRows.length} class${selectedAllRows.length !== 1 ? 'es' : ''}`}
                </button>
              </div>
            </>
          )}
        </YeCard>
      )}

      {promotionMode === 'all' && allRunResult && (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: allRunResult.failed ? 'var(--warning-50)' : 'var(--success-50)',
          border: `1px solid ${allRunResult.failed ? 'var(--warning-100)' : 'var(--success-100)'}`,
        }}>
          <div style={{ fontWeight: 900, color: allRunResult.failed ? 'var(--warning-600)' : 'var(--success-700)', marginBottom: 8 }}>
            Promotion run complete — {allRunResult.done} done, {allRunResult.failed} failed
          </div>
          {allRunResult.failures.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {allRunResult.failures.map(f => (
                <div key={f.className} style={{ fontSize: 12.5, color: 'var(--danger-700)' }}>
                  <strong>{f.className}:</strong> {f.messages.join(' · ')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Candidate list */}
      {promotionMode === 'single' && phase !== 'setup' && candidates && (
        <YeCard
          icon="👥"
          title={`Candidate List — ${candidates.length} students`}
          sub="Review and override suggested actions before running"
          right={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ACTIONS.map(a => (
                <button
                  key={a}
                  className={`ye-action-btn ye-action-${a}`}
                  onClick={() => setAll(a)}
                  style={{ fontSize: 10 }}
                >
                  All {ACTION_LABELS[a]}
                </button>
              ))}
            </div>
          }
        >
          {previewData && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                ['Total', previewData.total_candidates || 0],
                ['Promote', previewData.candidate_summary?.promoted || 0],
                ['Retain', previewData.candidate_summary?.retained || 0],
                ['Graduate', previewData.candidate_summary?.graduated || 0],
                ['Hold', previewData.candidate_summary?.on_hold || 0],
              ].map(([label, value]) => (
                <span key={label} className="ye-action-btn ye-action-promoted" style={{ cursor: 'default' }}>
                  {label}: {value}
                </span>
              ))}
            </div>
          )}
          <div className="ye-table-wrap">
            <table className="data-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll</th>
                  <th style={{ textAlign: 'center' }}>Exam Result</th>
                  <th style={{ textAlign: 'center' }}>Att %</th>
                  <th style={{ textAlign: 'right' }}>Dues</th>
                  <th>Flags</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.student_id}>
                    <td style={{ fontWeight: 600 }}>{c.student_name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>{c.roll_number || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{c.exam_result}</span>
                      {c.percentage != null && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>({c.percentage?.toFixed(0)}%)</span>}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: c.attendance_pct < 75 ? 'var(--danger-600)' : 'var(--text-secondary)' }}>
                      {c.attendance_pct != null ? `${c.attendance_pct.toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: c.pending_dues > 0 ? 'var(--danger-600)' : 'var(--text-tertiary)', fontSize: 12 }}>
                      {c.pending_dues > 0 ? `₹${c.pending_dues.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.flags?.has_pending_dues && <span className="ye-flag ye-flag-dues">Dues</span>}
                        {c.flags?.low_attendance   && <span className="ye-flag ye-flag-att">Low Att.</span>}
                        {c.flags?.no_marks_entered && <span className="ye-flag ye-flag-nomarks">No Marks</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {ACTIONS.map(a => (
                          <button
                            key={a}
                            className={`ye-action-btn ye-action-${a}${studentActions[c.student_id] === a ? ' ye-action-active' : ''}`}
                            onClick={() => setStudentActions(prev => ({ ...prev, [c.student_id]: a }))}
                            style={{ fontSize: 10, padding: '3px 8px' }}
                          >
                            {ACTION_LABELS[a]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary counts */}
          {candidates.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              {ACTIONS.map(a => {
                const count = Object.values(studentActions).filter(v => v === a).length
                if (!count) return null
                return (
                  <div key={a} className={`ye-action-btn ye-action-${a}`} style={{ cursor: 'default', fontSize: 11 }}>
                    {count} {ACTION_LABELS[a]}
                  </div>
                )
              })}
            </div>
          )}

          {/* Execute */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              className="btn btn-success"
              style={{ flex: 1, minWidth: 160 }}
              disabled={promoting || (!validation?.can_proceed && !forcePromote)}
              onClick={() => setConfirmPromote(true)}
            >
              {promoting ? <><Spinner /> Promoting…</> : `▶ Run Promotion (${candidates.length} students)`}
            </button>
            <button className="btn btn-secondary" onClick={() => setPhase('setup')}>← Back</button>
          </div>
        </YeCard>
      )}

      {/* Result card */}
      {result && (
        <div style={{
          padding: 16, borderRadius: 12, marginTop: 0,
          background: result.type === 'success' ? 'var(--success-50)' : 'var(--danger-50)',
          border: `1px solid ${result.type === 'success' ? 'var(--success-100)' : 'var(--danger-100)'}`,
        }}>
          {result.type === 'success' ? (
            <>
              <div style={{ fontWeight: 800, color: 'var(--success-700)', marginBottom: 8 }}>
                ✅ Promotion complete
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                {Object.entries(result.data).filter(([k, v]) => typeof v === 'number' && v > 0 && !['total_processed'].includes(k)).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'white', color: 'var(--success-700)', border: '1px solid var(--success-100)' }}>
                    {v} {k}
                  </span>
                ))}
              </div>
              {result.data.errors?.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--danger-700)' }}>
                  {result.data.errors.length} skipped: {result.data.errors.map(e => e.student_name || e.student_id).join(', ')}
                </div>
              )}
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 10 }}
                disabled={undoing}
                onClick={handleUndo}
              >
                {undoing ? <><Spinner size={12} /> Undoing…</> : '↩ Undo This Promotion'}
              </button>
            </>
          ) : (
            <div style={{ fontWeight: 700, color: 'var(--danger-700)' }}>❌ {result.message}</div>
          )}
        </div>
      )}
      <ConfirmModal
        open={confirmPromote}
        title={forcePromote ? 'Force Promotion' : 'Run Promotion'}
        message={
          forcePromote
            ? 'This will run promotion even though preflight found blocking issues. Confirm that missing marks, duplicate runs, and mappings have been reviewed.'
            : 'This will create target-year enrollments, update student class/year placement, and carry forward arrears where needed.'
        }
        confirmLabel={forcePromote ? 'Force Promote' : 'Run Promotion'}
        confirmVariant={forcePromote ? 'danger' : 'success'}
        loading={promoting}
        onConfirm={handlePromote}
        onCancel={() => setConfirmPromote(false)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Year-End Operations (lock, clone, TC)
// ─────────────────────────────────────────────────────────────────────────────
function OperationsTab({ years }) {
  const [lockYear, setLockYear]       = useState('')
  const [locking, setLocking]         = useState(false)
  const [unlockYear, setUnlockYear]   = useState('')
  const [unlocking, setUnlocking]     = useState(false)
  const [cloneFrom, setCloneFrom]     = useState('')
  const [cloneTo, setCloneTo]         = useState('')
  const [cloningFees, setCloningFees] = useState(false)
  const [cloningSubs, setCloningSubs] = useState(false)
  const [confirmOp, setConfirmOp]     = useState(null)

  const yearOptions = years.map(y => ({
    value: String(y.id),
    label: y.label + (y.is_current ? ' (Current)' : ` (${y.status})`),
  }))

  const handleLockMarks = async () => {
    if (!lockYear) { toast.error('Select a year'); return }
    setLocking(true)
    try {
      const r = await yearendAPI.lockMarks(parseInt(lockYear))
      toast.success(`${r.data.locked} mark records locked`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLocking(false)
      setConfirmOp(null)
    }
  }

  const handleUnlockMarks = async () => {
    if (!unlockYear) { toast.error('Select a year'); return }
    setUnlocking(true)
    try {
      const r = await marksAPI.unlockMarks(unlockYear)
      toast.success(`${r.data.unlocked} mark records unlocked`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setUnlocking(false)
      setConfirmOp(null)
    }
  }

  const handleCloneFees = async () => {
    if (!cloneFrom || !cloneTo) { toast.error('Select both years'); return }
    setCloningFees(true)
    try {
      const r = await yearendAPI.cloneFees(parseInt(cloneFrom), parseInt(cloneTo))
      toast.success(`Fee structure cloned — ${r.data.created} created, ${r.data.skipped} skipped`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCloningFees(false)
      setConfirmOp(null)
    }
  }

  const handleCloneSubjects = async () => {
    if (!cloneFrom || !cloneTo) { toast.error('Select both years'); return }
    setCloningSubs(true)
    try {
      const r = await yearendAPI.cloneSubjects(parseInt(cloneFrom), parseInt(cloneTo))
      toast.success(`Subjects cloned — ${r.data.created} created, ${r.data.skipped} skipped`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCloningSubs(false)
      setConfirmOp(null)
    }
  }

  return (
    <div className="ye-grid-2">
      <YeCard icon="🔒" title="Lock Exam Marks" sub="Prevents editing after year closes. Idempotent — safe to run twice.">
        <InlineBanner type="warning" message="Run this before promotion. Marks cannot be edited after locking without admin override." />
        <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
          <div>
          <label className="label">Academic Year</label>
          <select className="input" style={{ marginBottom: 12 }} value={lockYear} onChange={e => setLockYear(e.target.value)}>
            <option value="">Select year…</option>
            {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setConfirmOp('lock')} disabled={locking || !lockYear}>
            {locking ? <><Spinner /> Locking…</> : '🔒 Lock All Marks'}
          </button>
          </div>
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <label className="label">Admin Unlock Override</label>
            <select className="input" style={{ marginBottom: 12 }} value={unlockYear} onChange={e => setUnlockYear(e.target.value)}>
              <option value="">Select year…</option>
              {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setConfirmOp('unlock')} disabled={unlocking || !unlockYear}>
              {unlocking ? <><Spinner /> Unlocking…</> : 'Unlock Marks'}
            </button>
          </div>
        </div>
      </YeCard>

      <YeCard icon="📋" title="Clone Fees & Subjects" sub="Copy structure from one year to the next. Use at year start.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="label">From Year</label>
            <select className="input" value={cloneFrom} onChange={e => setCloneFrom(e.target.value)}>
              <option value="">Select source year…</option>
              {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To Year (target)</label>
            <select className="input" value={cloneTo} onChange={e => setCloneTo(e.target.value)}>
              <option value="">Select target year…</option>
              {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setConfirmOp('fees')} disabled={cloningFees || !cloneFrom || !cloneTo || cloneFrom === cloneTo}>
              {cloningFees ? <><Spinner /> Cloning…</> : 'Clone Fees'}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmOp('subjects')} disabled={cloningSubs || !cloneFrom || !cloneTo || cloneFrom === cloneTo}>
              {cloningSubs ? <><Spinner /> Cloning…</> : 'Clone Subjects'}
            </button>
          </div>
          {cloneFrom === cloneTo && cloneFrom !== '' && <InlineBanner type="danger" message="Source and target years must be different." />}
        </div>
      </YeCard>

      <YeCard icon="📄" title="Transfer Certificates" sub="Generate TC PDFs for leaving students">
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Go to <strong>Students</strong>, find the student, click <strong>TC</strong>. The PDF opens for printing.
          The TC now includes attendance percentage (using the calendar-aware working day count).
        </p>
        <a href="/students" className="btn btn-secondary" style={{ display: 'inline-flex', marginTop: 12, textDecoration: 'none' }}>
          Go to Students →
        </a>
      </YeCard>
      <ConfirmModal
        open={!!confirmOp}
        title={confirmOp === 'lock' ? 'Lock Marks' : confirmOp === 'unlock' ? 'Unlock Marks' : confirmOp === 'fees' ? 'Clone Fee Structure' : 'Clone Subjects'}
        message={
          confirmOp === 'lock'
            ? 'This locks all currently entered marks for the selected year and prevents normal mark edits afterward.'
            : confirmOp === 'unlock'
            ? 'This admin override unlocks all marks for the selected year so they can be edited again.'
            : 'This copies setup data into the target year and skips records that already exist.'
        }
        confirmLabel={confirmOp === 'lock' ? 'Lock Marks' : confirmOp === 'unlock' ? 'Unlock Marks' : 'Continue'}
        confirmVariant={confirmOp === 'lock' ? 'danger' : confirmOp === 'unlock' ? 'secondary' : 'primary'}
        loading={locking || unlocking || cloningFees || cloningSubs}
        onConfirm={confirmOp === 'lock' ? handleLockMarks : confirmOp === 'unlock' ? handleUnlockMarks : confirmOp === 'fees' ? handleCloneFees : handleCloneSubjects}
        onCancel={() => setConfirmOp(null)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Academic Calendar
// ─────────────────────────────────────────────────────────────────────────────
function CalendarTab({ years }) {
  const [selectedYear, setSelectedYear] = useState('')
  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [form, setForm] = useState({
    event_type: 'holiday', title: '', start_date: '', end_date: '',
    description: '', affects_attendance: true,
  })
  const [adding, setAdding] = useState(false)

  const fetchEvents = useCallback(async () => {
    if (!selectedYear) return
    setLoading(true)
    try {
      const r = await yearendAPI.getCalendar(selectedYear)
      setEvents(r.data)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleAdd = async () => {
    if (!form.title || !form.start_date || !form.end_date) {
      toast.error('Title, start and end date required')
      return
    }
    setAdding(true)
    try {
      await yearendAPI.addCalendarEvent(selectedYear, form)
      toast.success('Event added')
      setForm({ event_type: 'holiday', title: '', start_date: '', end_date: '', description: '', affects_attendance: true })
      fetchEvents()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (eventId) => {
    try {
      await yearendAPI.deleteCalendarEvent(eventId)
      toast.success('Event deleted')
      fetchEvents()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  const handleSeedHolidays = async () => {
    setSeeding(true)
    try {
      const r = await yearendAPI.seedHolidays(selectedYear)
      toast.success(`Seeded ${r.data.seeded} standard Gujarat holidays`)
      fetchEvents()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSeeding(false)
    }
  }

  const yearOptions = years.map(y => ({ value: String(y.id), label: y.label }))
  const TYPE_LABELS = { holiday: 'Holiday', exam_period: 'Exam Period', term_start: 'Term', event: 'Event' }
  const TYPES = Object.keys(TYPE_LABELS)

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">Academic Year</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="input" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ flex: 1 }}>
            <option value="">Select year…</option>
            {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {selectedYear && (
            <button className="btn btn-secondary" onClick={handleSeedHolidays} disabled={seeding}>
              {seeding ? <Spinner /> : '🇮🇳 Seed Gujarat Holidays'}
            </button>
          )}
        </div>
      </div>

      {selectedYear && (
        <>
          <YeCard icon="➕" title="Add Calendar Event" sub="Holidays and exam periods affect attendance working-day count">
            <div className="ye-form-row" style={{ marginBottom: 10 }}>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label className="label">Title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Diwali Vacation" />
              </div>
              <div>
                <label className="label">Start Date *</label>
                <input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">End Date *</label>
                <input type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.affects_attendance} onChange={e => setForm(f => ({ ...f, affects_attendance: e.target.checked }))} style={{ accentColor: 'var(--brand-500)' }} />
                Affects attendance denominator
              </label>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdd} disabled={adding}>
              {adding ? <><Spinner /> Adding…</> : '+ Add Event'}
            </button>
          </YeCard>

          <YeCard icon="📆" title={`Events (${events.length})`}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}><Spinner /> Loading…</div>
            ) : events.length === 0 ? (
              <EmptyState icon="📅" title="No events yet" description="Seed standard holidays or add manually" />
            ) : (
              <div>
                {events.map(ev => {
                  const typeClass = `ye-flag ye-evt-${ev.event_type}`
                  return (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                      <span className={typeClass}>{TYPE_LABELS[ev.event_type] || ev.event_type}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                          {ev.start_date} → {ev.end_date}
                          {ev.affects_attendance && <span style={{ marginLeft: 6, color: 'var(--brand-600)', fontWeight: 700 }}>· affects attendance</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--danger-600)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                      >
                        Delete
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </YeCard>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Audit Log
// ─────────────────────────────────────────────────────────────────────────────
function AuditLogTab({ years }) {
  const [logs, setLogs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [opFilter, setOpFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [offset, setOffset]     = useState(0)
  const LIMIT = 25

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: LIMIT, offset }
      if (opFilter)   params.operation        = opFilter
      if (yearFilter) params.academic_year_id = yearFilter
      const r = await yearendAPI.getAuditLog(params)
      setLogs(r.data.logs)
      setTotal(r.data.total)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [opFilter, yearFilter, offset])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const OPS = ['bulk_promote', 'lock_marks', 'clone_fees', 'clone_subjects', 'undo_promotion', 'activate_year']
  const yearOptions = years.map(y => ({ value: String(y.id), label: y.label }))
  const formatPayload = (payload) => {
    if (!payload) return ''
    if (typeof payload === 'string') return payload
    try {
      return JSON.stringify(payload, null, 2)
    } catch {
      return String(payload)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="input" style={{ flex: 1, minWidth: 160 }} value={opFilter} onChange={e => { setOpFilter(e.target.value); setOffset(0) }}>
          <option value="">All operations</option>
          {OPS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="input" style={{ flex: 1, minWidth: 160 }} value={yearFilter} onChange={e => { setYearFilter(e.target.value); setOffset(0) }}>
          <option value="">All years</option>
          {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(opFilter || yearFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setOpFilter(''); setYearFilter(''); setOffset(0) }}>Clear</button>
        )}
      </div>

      <div className="ye-card" style={{ marginBottom: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">Audit Log</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{total} entries</span>
        </div>
        <div style={{ padding: '0 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}><Spinner /> Loading…</div>
          ) : logs.length === 0 ? (
            <EmptyState icon="📋" title="No audit entries" description="Operations will appear here once run" />
          ) : (
            logs.map(log => (
              <div key={log.id} className="ye-audit-row">
                <div>
                  <span className={`ye-audit-op ${log.result === 'success' ? 'ye-audit-success' : log.result === 'failed' ? 'ye-audit-failed' : 'ye-audit-partial'}`}>
                    {log.operation}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {log.affected_count != null ? `${log.affected_count} records affected` : '—'}
                    {log.error_detail && <span style={{ color: 'var(--danger-600)', marginLeft: 8 }}>{log.error_detail}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{log.created_at?.split('T')[0]} {log.created_at?.split('T')[1]?.slice(0, 8)}</div>
                  {log.payload && (
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 800, color: 'var(--brand-600)' }}>
                        Payload
                      </summary>
                      <pre style={{
                        marginTop: 6,
                        padding: 10,
                        maxHeight: 220,
                        overflow: 'auto',
                        borderRadius: 8,
                        background: 'var(--gray-50)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                      }}>{formatPayload(log.payload)}</pre>
                    </details>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap',
                  background: log.result === 'success' ? '#dcfce7' : log.result === 'failed' ? '#fee2e2' : '#fef3c7',
                  color:      log.result === 'success' ? '#15803d' : log.result === 'failed' ? '#b91c1c' : '#b45309',
                }}>
                  {log.result}
                </span>
              </div>
            ))
          )}
        </div>
        {total > LIMIT && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-secondary btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>← Prev</button>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
            <button className="btn btn-secondary btn-sm" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
//
// NOTE: `classes` is no longer fetched here for promotion — PromotionTab
// fetches its own classes per source year. The root fetch of classes is kept
// for any other tabs that may need it, but is not passed to PromotionTab.
// ─────────────────────────────────────────────────────────────────────────────
export default function YearEnd() {
  const [tab, setTab]                   = useState('lifecycle')
  const [years, setYears]               = useState([])
  const [currentYear, setCurrentYear]   = useState(null)

  const loadData = useCallback(async () => {
    const yearRes = await yearendAPI.getYears()
    setYears(yearRes.data)
    const curr = yearRes.data.find(y => y.is_current)
    if (curr) setCurrentYear(curr)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const tabs = [
    { value: 'lifecycle',  label: 'Year Lifecycle', icon: '📅' },
    { value: 'promotion',  label: 'Promotion',       icon: '🎓' },
    { value: 'operations', label: 'Operations',      icon: '⚙️'  },
    { value: 'calendar',   label: 'Calendar',        icon: '📆' },
    { value: 'audit',      label: 'Audit Log',       icon: '📋' },
  ]

  return (
    <div className="ye-root">
      <PageHeader
        title="Year-End Management"
        subtitle="Draft → Activate → Promote → Lock → Close"
      />

      {currentYear && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: 20, marginBottom: 18, fontSize: 13, fontWeight: 700, color: 'var(--brand-700)' }}>
          <span style={{ width: 7, height: 7, background: 'var(--success-500)', borderRadius: '50%' }} />
          Current Year: {currentYear.label}
        </div>
      )}

      <div style={{ marginBottom: 18, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'lifecycle'  && <YearLifecycleTab  years={years} onRefresh={loadData} />}
      {tab === 'promotion'  && <PromotionTab       years={years} onRefresh={loadData} />}
      {tab === 'operations' && <OperationsTab      years={years} />}
      {tab === 'calendar'   && <CalendarTab        years={years} />}
      {tab === 'audit'      && <AuditLogTab        years={years} />}
    </div>
  )
}
