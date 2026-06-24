import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { extractError, notificationAPI, setupAPI, studentAPI } from '../../services/api'
import { EmptyState, Field, PageHeader, ResponsiveTable, SectionPanel, Skeleton } from '../../components/UI'

// ── Type / status meta ────────────────────────────────────────────────────────
const typeLabel = {
  payment_confirmed:   'Payment',
  fee_due:             'Fee Due',
  low_attendance:      'Low Attendance',
  result_published:    'Result',
  test:                'Test',
  registration_invite: 'Reg. Invite',
  custom_message:      'Custom',
}

const typeBadge = {
  payment_confirmed:   'teal',
  fee_due:             'amber',
  low_attendance:      'violet',
  result_published:    'blue',
  test:                'slate',
  registration_invite: 'blue',
  custom_message:      'pink',
}

const statusBadge = {
  sent:    'success',
  failed:  'danger',
  queued:  'info',
  pending: 'slate',
  sending: 'info',
  retry:   'warning',
}

const statusDot = {
  sent:    '#1D9E75',
  failed:  '#E24B4A',
  queued:  '#378ADD',
  pending: '#888780',
  sending: '#378ADD',
  retry:   '#BA7517',
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const tokens = {
  radius: { sm: 8, md: 10, lg: 14, xl: 18 },
  color: {
    surface:  '#ffffff',
    page:     '#f6f7f9',
    border:   '#e8eaed',
    borderMd: '#d1d5db',
    text:     '#0f172a',
    muted:    '#64748b',
    subtle:   '#94a3b8',
    // semantic
    blue:   { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    green:  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    amber:  { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    red:    { bg: '#fff1f2', text: '#b91c1c', border: '#fecdd3' },
    violet: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    teal:   { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
    pink:   { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
    slate:  { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
  },
}

const badgePalette = {
  teal:    tokens.color.teal,
  amber:   tokens.color.amber,
  violet:  tokens.color.violet,
  blue:    tokens.color.blue,
  pink:    tokens.color.pink,
  slate:   tokens.color.slate,
  success: tokens.color.green,
  danger:  tokens.color.red,
  warning: tokens.color.amber,
  info:    tokens.color.blue,
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function Badge({ tone = 'slate', dot, children }) {
  const c = badgePalette[tone] || badgePalette.slate
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      border: `1px solid ${c.border}`,
      background: c.bg, color: c.text,
      fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      whiteSpace: 'nowrap', lineHeight: 1,
    }}>
      {dot && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: dot, flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  )
}

function MetricCard({ label, value, color = tokens.color.text }) {
  return (
    <div style={{
      background: tokens.color.surface,
      border: `1px solid ${tokens.color.border}`,
      borderRadius: tokens.radius.lg,
      padding: '16px 18px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color, marginTop: 4, lineHeight: 1, letterSpacing: '-0.5px' }}>
        {value}
      </div>
    </div>
  )
}

function Card({ children, style, noPad }) {
  return (
    <div style={{
      background: tokens.color.surface,
      border: `1px solid ${tokens.color.border}`,
      borderRadius: tokens.radius.xl,
      overflow: 'hidden',
      ...style,
    }}>
      {noPad ? children : <div style={{ padding: '20px' }}>{children}</div>}
    </div>
  )
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '16px 20px', borderBottom: `1px solid ${tokens.color.border}`,
      gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: tokens.color.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: tokens.color.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  )
}

function Btn({ onClick, disabled, children, variant = 'default', size = 'md', style: extraStyle }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: 'none', borderRadius: tokens.radius.md,
    fontFamily: 'inherit', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1, transition: 'opacity .12s',
    whiteSpace: 'nowrap',
  }
  const sizes = {
    sm: { height: 30, padding: '0 10px', fontSize: 12 },
    md: { height: 38, padding: '0 14px', fontSize: 13 },
    lg: { height: 44, padding: '0 18px', fontSize: 14 },
  }
  const variants = {
    default: { background: tokens.color.surface, color: tokens.color.text, boxShadow: `inset 0 0 0 1px ${tokens.color.borderMd}` },
    primary: { background: '#1e293b', color: '#fff' },
    danger:  { background: '#dc2626', color: '#fff' },
    ghost:   { background: 'transparent', color: tokens.color.muted, boxShadow: `inset 0 0 0 1px ${tokens.color.border}` },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
    >
      {children}
    </button>
  )
}

function TogglePill({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              height: 32, padding: '0 12px', borderRadius: 999,
              border: `1px solid ${active ? '#1e293b' : tokens.color.border}`,
              background: active ? '#1e293b' : tokens.color.surface,
              color: active ? '#fff' : tokens.color.muted,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all .1s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Custom Message Composer ───────────────────────────────────────────────────
const MSG_LIMIT = 1000

const RECIPIENT_TYPES = [
  { value: 'all_students',      label: 'All students' },
  { value: 'all_parents',       label: 'All parents' },
  { value: 'class',             label: 'Specific class' },
  { value: 'student',           label: 'Specific student' },
]

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms',      label: 'SMS' },
  { value: 'both',     label: 'Both' },
]

function ComposerField({ label, hint, children }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </label>
        {hint && <span style={{ fontSize: 11, color: tokens.color.subtle }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function CustomMessageComposer({ onSent }) {
  const [form, setForm] = useState({
    recipient_type: 'all_students',
    class_id: '',
    student_id: '',
    channel: 'whatsapp',
    message: '',
  })
  const [classes, setClasses]           = useState([])
  const [students, setStudents]         = useState([])
  const [loadingClasses, setLoadingClasses]   = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [confirmOpen, setConfirmOpen]   = useState(false)
  const [sending, setSending]           = useState(false)
  const [result, setResult]             = useState(null)
  const [error, setError]               = useState('')

  useEffect(() => {
    setLoadingClasses(true)
    setupAPI.getClasses()
      .then(r => setClasses(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  useEffect(() => {
    if (form.recipient_type !== 'student') return
    if (!form.class_id) { setStudents([]); return }
    setLoadingStudents(true)
    studentAPI.list({ class_id: form.class_id, page_size: 200 })
      .then(r => setStudents(r.data?.items || r.data || []))
      .catch(() => {})
      .finally(() => setLoadingStudents(false))
  }, [form.recipient_type, form.class_id])

  const set = (key, value) => {
    setError('')
    setResult(null)
    setForm(f => ({ ...f, [key]: value }))
  }

  const recipientLabel = useMemo(() => {
    const rt = RECIPIENT_TYPES.find(r => r.value === form.recipient_type)
    if (!rt) return ''
    if (form.recipient_type === 'class') {
      const cls = classes.find(c => String(c.id) === String(form.class_id))
      return cls ? `${rt.label} — ${cls.name}` : rt.label
    }
    if (form.recipient_type === 'student') {
      const s = students.find(s => String(s.id) === String(form.student_id))
      return s ? `${rt.label} — ${s.name_en || s.name}` : rt.label
    }
    return rt.label
  }, [form, classes, students])

  const canSubmit = useMemo(() => {
    if (!form.message.trim() || form.message.length > MSG_LIMIT) return false
    if (form.recipient_type === 'class' && !form.class_id) return false
    if (form.recipient_type === 'student' && !form.student_id) return false
    return true
  }, [form])

  const handleConfirm = async () => {
    setSending(true)
    setConfirmOpen(false)
    setError('')
    try {
      const payload = {
        recipient_type: form.recipient_type,
        channel: form.channel,
        message: form.message.trim(),
        ...(form.recipient_type === 'class'   ? { class_id:   Number(form.class_id) }   : {}),
        ...(form.recipient_type === 'student' ? { student_id: Number(form.student_id) } : {}),
      }
      const res = await notificationAPI.sendCustomMessage(payload)
      setResult(res.data)
      toast.success(`${res.data.sent} message${res.data.sent !== 1 ? 's' : ''} sent`)
      setForm(f => ({ ...f, message: '', class_id: '', student_id: '' }))
      onSent?.()
    } catch (err) {
      const msg = extractError(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const charsLeft  = MSG_LIMIT - form.message.length
  const charsColor = charsLeft < 0 ? '#dc2626' : charsLeft < 100 ? '#d97706' : tokens.color.subtle

  const selectStyle = {
    width: '100%', height: 38,
    border: `1px solid ${tokens.color.borderMd}`,
    borderRadius: tokens.radius.md,
    padding: '0 11px', fontSize: 13,
    color: tokens.color.text, background: tokens.color.surface,
    fontFamily: 'inherit', fontWeight: 600, outline: 'none',
  }

  return (
    <>
      {/* Confirm modal */}
      {confirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setConfirmOpen(false)}
          />
          <div style={{
            position: 'relative', background: tokens.color.surface,
            borderRadius: tokens.radius.xl, padding: 28,
            width: '100%', maxWidth: 440,
            border: `1px solid ${tokens.color.border}`,
            boxShadow: '0 24px 64px rgba(15,23,42,0.16)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: tokens.color.text, marginBottom: 6 }}>
              Send this message?
            </div>
            <div style={{ fontSize: 13, color: tokens.color.muted, marginBottom: 16, lineHeight: 1.6 }}>
              To <strong style={{ color: tokens.color.text }}>{recipientLabel}</strong> via{' '}
              <strong style={{ color: tokens.color.text, textTransform: 'capitalize' }}>{form.channel}</strong>
            </div>
            <div style={{
              padding: '12px 14px', borderRadius: tokens.radius.md,
              background: tokens.color.page, border: `1px solid ${tokens.color.border}`,
              fontSize: 13, color: tokens.color.text, lineHeight: 1.65,
              marginBottom: 22, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {form.message.trim()}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="primary" onClick={handleConfirm} style={{ flex: 1, justifyContent: 'center' }}>
                Confirm &amp; send
              </Btn>
              <Btn variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        <ComposerField label="Recipients">
          <TogglePill
            options={RECIPIENT_TYPES}
            value={form.recipient_type}
            onChange={v => { set('recipient_type', v); set('class_id', ''); set('student_id', '') }}
          />
        </ComposerField>

        {(form.recipient_type === 'class' || form.recipient_type === 'student') && (
          <ComposerField label="Class">
            <select
              value={form.class_id}
              onChange={e => { set('class_id', e.target.value); set('student_id', '') }}
              disabled={loadingClasses}
              style={selectStyle}
            >
              <option value="">{loadingClasses ? 'Loading…' : 'Select class'}</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.division ? `${c.name} — ${c.division}` : c.name}
                </option>
              ))}
            </select>
          </ComposerField>
        )}

        {form.recipient_type === 'student' && (
          <ComposerField label="Student">
            <select
              value={form.student_id}
              onChange={e => set('student_id', e.target.value)}
              disabled={!form.class_id || loadingStudents}
              style={selectStyle}
            >
              <option value="">
                {!form.class_id ? 'Select a class first' : loadingStudents ? 'Loading…' : 'Select student'}
              </option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name_en || s.name}</option>
              ))}
            </select>
          </ComposerField>
        )}

        <ComposerField label="Channel">
          <TogglePill
            options={CHANNEL_OPTIONS}
            value={form.channel}
            onChange={v => set('channel', v)}
          />
        </ComposerField>

        <ComposerField
          label="Message"
          hint={`${form.message.length} / ${MSG_LIMIT}`}
        >
          <textarea
            value={form.message}
            onChange={e => set('message', e.target.value)}
            placeholder="Type your message…"
            rows={5}
            maxLength={MSG_LIMIT + 50}
            style={{
              width: '100%', minHeight: 120, resize: 'vertical',
              border: `1px solid ${tokens.color.borderMd}`,
              borderRadius: tokens.radius.md, padding: '10px 12px',
              fontSize: 13, color: tokens.color.text,
              background: tokens.color.surface, fontFamily: 'inherit',
              fontWeight: 500, lineHeight: 1.65, outline: 'none',
            }}
          />
          <div style={{ fontSize: 11.5, color: charsColor, fontWeight: 700, textAlign: 'right' }}>
            {charsLeft < 0 ? `${Math.abs(charsLeft)} over limit` : `${charsLeft} remaining`}
          </div>
        </ComposerField>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: tokens.radius.md,
            background: tokens.color.red.bg,
            border: `1px solid ${tokens.color.red.border}`,
            color: tokens.color.red.text,
            fontSize: 13, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{
            padding: '12px 14px', borderRadius: tokens.radius.md,
            background: tokens.color.green.bg,
            border: `1px solid ${tokens.color.green.border}`,
            fontSize: 13, color: tokens.color.green.text, lineHeight: 1.6,
          }}>
            <strong>Done.</strong> {result.sent} message{result.sent !== 1 ? 's' : ''} sent
            {result.failed > 0 && (
              <span style={{ color: tokens.color.amber.text }}> · {result.failed} failed (missing numbers)</span>
            )}
          </div>
        )}

        <Btn
          variant="primary"
          disabled={!canSubmit || sending}
          onClick={() => setConfirmOpen(true)}
          style={{
            width: '100%', justifyContent: 'center',
            height: 44, fontSize: 14,
          }}
        >
          {sending ? (
            <>
              <span style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
              Sending…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send message
            </>
          )}
        </Btn>
      </div>
    </>
  )
}

// ── Delivery Log (card rows + pagination) ─────────────────────────────────────
const PAGE_SIZE = 10

function LogRow({ row, busy, onRetry }) {
  const isRetryable = ['failed', 'retry'].includes(row.status)
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) auto',
      gap: 12,
      padding: '13px 18px',
      borderBottom: `1px solid ${tokens.color.border}`,
      alignItems: 'start',
    }}>
      {/* Left: main info */}
      <div style={{ minWidth: 0 }}>
        {/* Row 1: badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <Badge tone={typeBadge[row.notification_type] || 'slate'}>
            {typeLabel[row.notification_type] || row.notification_type}
          </Badge>
          <Badge tone={row.channel === 'sms' ? 'amber' : 'info'}>
            {row.channel}
          </Badge>
          <Badge tone={statusBadge[row.status] || 'slate'} dot={statusDot[row.status]}>
            {row.status}
          </Badge>
        </div>
        {/* Row 2: phone + date */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: tokens.color.text, fontVariantNumeric: 'tabular-nums' }}>
            {row.recipient_phone}
          </span>
          <span style={{ fontSize: 12, color: tokens.color.subtle }}>
            {row.created_at
              ? new Date(row.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
              : '—'}
          </span>
        </div>
        {/* Row 3: message preview */}
        <div style={{
          fontSize: 12.5, color: tokens.color.muted, lineHeight: 1.5,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {row.message_preview || row.template_name || '—'}
        </div>
        {row.error_message && (
          <div style={{ fontSize: 11.5, color: tokens.color.red.text, marginTop: 4, lineHeight: 1.4 }}>
            {row.error_message}
          </div>
        )}
      </div>
      {/* Right: action */}
      <div style={{ paddingTop: 2 }}>
        {isRetryable ? (
          <Btn size="sm" disabled={busy === `retry-${row.id}`} onClick={() => onRetry(row)}>
            {busy === `retry-${row.id}` ? 'Retrying…' : 'Retry'}
          </Btn>
        ) : null}
      </div>
    </div>
  )
}

function DeliveryLog({ rows, loading, filters, setFilters, activeFilterCount, busy, onRetry, selectStyle }) {
  const [page, setPage] = useState(1)

  // Reset to page 1 whenever filters or rows change
  useEffect(() => { setPage(1) }, [filters, rows.length])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Build page number list with ellipsis
  const pageNums = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const near = new Set([1, totalPages, page, page - 1, page + 1].filter(n => n >= 1 && n <= totalPages))
    const sorted = [...near].sort((a, b) => a - b)
    const result = []
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) result.push('…')
      result.push(n)
    })
    return result
  }, [totalPages, page])

  return (
    <Card noPad style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: 16 }}>
      <CardHeader
        title="Delivery log"
        subtitle={`${rows.length} record${rows.length !== 1 ? 's' : ''}${activeFilterCount ? ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : ''}`}
        action={
          activeFilterCount > 0 ? (
            <Btn size="sm" variant="ghost" onClick={() => setFilters({ notification_type: '', status: '', channel: '' })}>
              Clear filters
            </Btn>
          ) : null
        }
      />

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 10, padding: '12px 18px',
        borderBottom: `1px solid ${tokens.color.border}`,
        flexShrink: 0,
      }}>
        <select value={filters.notification_type} onChange={e => setFilters(f => ({ ...f, notification_type: e.target.value }))} style={selectStyle}>
          <option value="">All types</option>
          <option value="payment_confirmed">Payment</option>
          <option value="fee_due">Fee due</option>
          <option value="low_attendance">Low attendance</option>
          <option value="result_published">Result</option>
          <option value="custom_message">Custom</option>
          <option value="registration_invite">Reg. invite</option>
          <option value="test">Test</option>
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={selectStyle}>
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="queued">Queued</option>
          <option value="pending">Pending</option>
          <option value="sending">Sending</option>
          <option value="retry">Retry</option>
          <option value="failed">Failed</option>
        </select>
        <select value={filters.channel} onChange={e => setFilters(f => ({ ...f, channel: e.target.value }))} style={selectStyle}>
          <option value="">All channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading ? (
          Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} style={{ padding: '14px 18px', borderBottom: `1px solid ${tokens.color.border}`, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <Skeleton height="20px" width="72px" />
                <Skeleton height="20px" width="60px" />
                <Skeleton height="20px" width="50px" />
              </div>
              <Skeleton height="13px" width="45%" />
              <Skeleton height="12px" width="80%" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div style={{ padding: '48px 20px' }}>
            <EmptyState
              title="No notifications yet"
              description="Delivery records appear here once the first message is queued."
            />
          </div>
        ) : pageRows.map(row => (
          <LogRow key={row.id} row={row} busy={busy} onRetry={onRetry} />
        ))}
      </div>

      {/* Pagination */}
      {!loading && rows.length > PAGE_SIZE && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px', borderTop: `1px solid ${tokens.color.border}`,
          flexShrink: 0, gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: tokens.color.muted }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <Btn size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              ‹ Prev
            </Btn>
            {pageNums.map((n, i) =>
              n === '…' ? (
                <span key={`ellipsis-${i}`} style={{ padding: '0 4px', fontSize: 13, color: tokens.color.subtle }}>…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{
                    width: 30, height: 30, borderRadius: tokens.radius.md,
                    border: n === page ? 'none' : `1px solid ${tokens.color.border}`,
                    background: n === page ? tokens.color.text : 'transparent',
                    color: n === page ? tokens.color.surface : tokens.color.muted,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {n}
                </button>
              )
            )}
            <Btn size="sm" variant="ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              Next ›
            </Btn>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Notifications() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ notification_type: '', status: '', channel: '' })
  const [busy, setBusy]       = useState('')
  const [preview, setPreview] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    notificationAPI.list(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
      .then(r => setRows(r.data || []))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total:  rows.length,
    sent:   rows.filter(r => r.status === 'sent').length,
    failed: rows.filter(r => r.status === 'failed').length,
    queued: rows.filter(r => ['queued', 'pending', 'retry', 'sending'].includes(r.status)).length,
  }), [rows])

  const activeFilterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters])

  const previewBlast = async (kind) => {
    try {
      setBusy(`preview-${kind}`)
      const res = kind === 'fees'
        ? await notificationAPI.previewFeeReminders()
        : await notificationAPI.previewLowAttendance({})
      setPreview({ kind, ...res.data })
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBusy('')
    }
  }

  const trigger = async (kind) => {
    if (!preview || preview.kind !== kind) {
      toast.error('Preview recipients before sending')
      return
    }
    const count    = preview.recipient_count
    const excluded = preview.excluded_count
    const confirmed = window.confirm(
      `Send to ${count} recipient${count !== 1 ? 's' : ''}?` +
      (excluded ? `\n${excluded} excluded.` : '')
    )
    if (!confirmed) return
    try {
      setBusy(kind)
      const res = kind === 'fees'
        ? await notificationAPI.triggerFeeReminders()
        : await notificationAPI.triggerLowAttendance({})
      toast.success(`${res.data.queued || 0} notification${res.data.queued === 1 ? '' : 's'} queued`)
      setPreview(null)
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBusy('')
    }
  }

  const retryNotification = async (row) => {
    try {
      setBusy(`retry-${row.id}`)
      await notificationAPI.retry(row.id)
      toast.success('Queued for retry')
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBusy('')
    }
  }

  const selectStyle = {
    height: 38, border: `1px solid ${tokens.color.borderMd}`,
    borderRadius: tokens.radius.md, padding: '0 10px',
    fontSize: 13, fontWeight: 600, color: tokens.color.text,
    background: tokens.color.surface, fontFamily: 'inherit', outline: 'none',
    width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .notif-grid-2 { grid-template-columns: 1fr !important; }
          .notif-metrics { grid-template-columns: repeat(2, 1fr) !important; }
          .notif-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .notif-filters { grid-template-columns: 1fr 1fr !important; }
          .notif-header-actions { flex-direction: column; align-items: flex-start !important; gap: 10px !important; }
        }
        @media (max-width: 400px) {
          .notif-metrics { grid-template-columns: 1fr 1fr !important; }
          .notif-filters { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '20px 16px 0', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* ── Page header ── */}
        <div className="notif-header-actions" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: tokens.color.text, letterSpacing: '-0.4px', margin: 0 }}>
              Notifications
            </h1>
            <p style={{ fontSize: 13.5, color: tokens.color.muted, marginTop: 4 }}>
              WhatsApp &amp; SMS delivery, custom messages, and batch blasts.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn
              onClick={() => previewBlast('fees')}
              disabled={busy === 'preview-fees'}
            >
              {busy === 'preview-fees' ? 'Previewing…' : 'Preview fee reminders'}
            </Btn>
            <Btn
              onClick={() => previewBlast('attendance')}
              disabled={busy === 'preview-attendance'}
            >
              {busy === 'preview-attendance' ? 'Previewing…' : 'Preview attendance alerts'}
            </Btn>
          </div>
        </div>

        {/* ── Metric row ── */}
        <div
          className="notif-metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 10, marginBottom: 16, flexShrink: 0,
          }}
        >
          <MetricCard label="Total"  value={stats.total}  color={tokens.color.text} />
          <MetricCard label="Sent"   value={stats.sent}   color="#15803d" />
          <MetricCard label="Queued" value={stats.queued} color="#1d4ed8" />
          <MetricCard label="Failed" value={stats.failed} color="#b91c1c" />
        </div>

        {/* ── Hero + Provider row ── */}
        <div
          className="notif-grid-2"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(280px,0.65fr)', gap: 14, marginBottom: 14, flexShrink: 0 }}
        >
          {/* Hero */}
          <Card style={{ border: `1px solid ${tokens.color.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: tokens.color.subtle, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Delivery operations
            </div>
            <h2 style={{
              margin: 0, fontSize: 'clamp(20px, 2.8vw, 32px)',
              fontWeight: 800, lineHeight: 1.07,
              letterSpacing: '-0.06em', color: tokens.color.text,
            }}>
              Every message the school sends, in one place.
            </h2>
            <p style={{ margin: '12px 0 0', color: tokens.color.muted, fontSize: 14, lineHeight: 1.7, maxWidth: 560 }}>
              Preview fee reminders and attendance alerts, compose custom messages
              for any group, and diagnose delivery failures — without leaving this page.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 18 }}>
              <Badge tone="slate">{stats.total} visible</Badge>
              <Badge tone="success" dot={statusDot.sent}>{stats.sent} sent</Badge>
              <Badge tone="warning" dot={statusDot.queued}>{stats.queued} queued</Badge>
              <Badge tone="danger"  dot={statusDot.failed}>{stats.failed} failed</Badge>
            </div>
          </Card>

          {/* Provider snapshot */}
          <Card noPad>
            <CardHeader
              title="Batch preview"
              subtitle="See recipients before sending"
            />
            <div style={{ padding: 16 }}>
              {preview ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Badge tone={preview.provider_ready ? 'success' : 'warning'}>
                      {preview.provider_ready ? 'Provider ready' : 'Check provider'}
                    </Badge>
                    <Badge tone={preview.kind === 'fees' ? 'violet' : 'info'}>
                      {preview.kind === 'fees' ? 'Fee reminders' : 'Attendance alerts'}
                    </Badge>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Recipients', value: preview.recipient_count, color: tokens.color.text },
                      { label: 'Excluded',   value: preview.excluded_count,  color: tokens.color.amber.text },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: tokens.color.page,
                        border: `1px solid ${tokens.color.border}`,
                        borderRadius: tokens.radius.md, padding: '10px 12px',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {preview.provider_warning && (
                    <div style={{
                      padding: '10px 12px', borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.amber.border}`,
                      background: tokens.color.amber.bg,
                      color: tokens.color.amber.text,
                      fontSize: 12.5, fontWeight: 600, lineHeight: 1.5,
                    }}>
                      {preview.provider_warning}
                    </div>
                  )}

                  {preview.sample_message && (
                    <div style={{
                      padding: '10px 12px', borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.border}`,
                      background: tokens.color.page,
                      fontSize: 12.5, lineHeight: 1.6, color: tokens.color.muted,
                    }}>
                      <strong style={{ color: tokens.color.text }}>Sample: </strong>
                      {preview.sample_message}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn size="sm" variant="ghost" onClick={() => setPreview(null)}>Dismiss</Btn>
                    <Btn
                      size="sm"
                      variant="danger"
                      disabled={busy === preview.kind || preview.recipient_count === 0 || !preview.provider_ready}
                      onClick={() => trigger(preview.kind)}
                    >
                      {busy === preview.kind ? 'Sending…' : `Send to ${preview.recipient_count}`}
                    </Btn>
                  </div>

                  {preview.recipients?.length > 0 && (
                    <div style={{
                      borderTop: `1px solid ${tokens.color.border}`,
                      paddingTop: 10, maxHeight: 200, overflowY: 'auto',
                      display: 'grid', gap: 6,
                    }}>
                      {preview.recipients.slice(0, 10).map(r => (
                        <div key={`${r.student_id}-${r.phone}`} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          gap: 8, padding: '7px 10px',
                          borderRadius: tokens.radius.md,
                          background: tokens.color.surface,
                          border: `1px solid ${tokens.color.border}`,
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: tokens.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.student_name}
                            </div>
                            <div style={{ fontSize: 11.5, color: tokens.color.muted }}>{r.phone}</div>
                          </div>
                          <Badge tone="slate">Target</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '28px 0', color: tokens.color.muted }}>
                  <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 10h8m-8 4h5m1 8l-3-3H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2h-3l-3 3z" />
                  </svg>
                  <div style={{ fontSize: 13, fontWeight: 600, color: tokens.color.text, marginBottom: 4 }}>No preview loaded</div>
                  <div style={{ fontSize: 12, lineHeight: 1.55 }}>Run a preview to see recipients and a sample message before sending.</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Custom Message Composer ── */}
        <Card noPad style={{ marginBottom: 14, flexShrink: 0 }}>
          <CardHeader
            title="Custom message"
            subtitle="Send a free-form message to any group — every send is logged below"
          />
          <div style={{ padding: 20 }}>
            <CustomMessageComposer onSent={load} />
          </div>
        </Card>

        {/* ── Delivery log ── */}
        <DeliveryLog
          rows={rows}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          activeFilterCount={activeFilterCount}
          busy={busy}
          onRetry={retryNotification}
          selectStyle={selectStyle}
        />

      </div>
    </div>
  )
}