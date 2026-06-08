import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { extractError, notificationAPI, setupAPI, studentAPI } from '../../services/api'
import { EmptyState, Field, PageHeader, ResponsiveTable, SectionPanel, Skeleton } from '../../components/UI'

// ── Type / status meta ────────────────────────────────────────────────────────
const typeLabel = {
  payment_confirmed: 'Payment',
  fee_due:           'Fee Due',
  low_attendance:    'Low Attendance',
  result_published:  'Result',
  test:              'Test',
  registration_invite: 'Reg. Invite',
  custom_message:    'Custom',
}

const typeTone = {
  payment_confirmed:   { color: '#0f766e', bg: '#ecfdf5' },
  fee_due:             { color: '#b45309', bg: '#fffbeb' },
  low_attendance:      { color: '#7c3aed', bg: '#f5f3ff' },
  result_published:    { color: '#2563eb', bg: '#eff6ff' },
  test:                { color: '#475569', bg: '#f8fafc' },
  registration_invite: { color: '#0369a1', bg: '#f0f9ff' },
  custom_message:      { color: '#be185d', bg: '#fdf2f8' },
}

const statusLabel = { queued: 'Queued', pending: 'Pending', sending: 'Sending', retry: 'Retry', sent: 'Sent', failed: 'Failed' }

// ── Small shared UI ───────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function Badge({ tone = 'slate', children }) {
  const palette = {
    slate:   { color: '#334155', bg: '#f8fafc',  border: '#e2e8f0' },
    success: { color: '#166534', bg: '#f0fdf4',  border: '#bbf7d0' },
    warning: { color: '#b45309', bg: '#fffbeb',  border: '#fde68a' },
    danger:  { color: '#b91c1c', bg: '#fff1f2',  border: '#fecdd3' },
    info:    { color: '#1d4ed8', bg: '#eff6ff',  border: '#bfdbfe' },
    violet:  { color: '#6d28d9', bg: '#f5f3ff',  border: '#ddd6fe' },
    pink:    { color: '#be185d', bg: '#fdf2f8',  border: '#fbcfe8' },
  }
  const c = palette[tone] || palette.slate
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
      border: `1px solid ${c.border}`, color: c.color, background: c.bg,
      fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

// ── Custom Message Composer ───────────────────────────────────────────────────
const MSG_LIMIT = 1000

const RECIPIENT_TYPES = [
  { value: 'all_students', label: 'All Students',   desc: 'Every active student\'s guardian phone' },
  { value: 'all_parents',  label: 'All Parents',    desc: 'Same as All Students — guardian contacts' },
  { value: 'class',        label: 'Specific Class', desc: 'All guardians in one class' },
  { value: 'student',      label: 'Specific Student', desc: 'One student\'s guardian' },
]

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms',      label: 'SMS' },
  { value: 'both',     label: 'Both' },
]

function CustomMessageComposer({ onSent }) {
  const [form, setForm] = useState({
    recipient_type: 'all_students',
    class_id: '',
    student_id: '',
    channel: 'whatsapp',
    message: '',
  })
  const [classes, setClasses]     = useState([])
  const [students, setStudents]   = useState([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')

  // Load classes once
  useEffect(() => {
    setLoadingClasses(true)
    setupAPI.getClasses()
      .then(r => setClasses(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  // Load students when class changes (for student picker)
  useEffect(() => {
    if (form.recipient_type !== 'student') return
    if (!form.class_id) { setStudents([]); return }
    setLoadingStudents(true)
    studentAPI.list({ class_id: form.class_id, page_size: 200 })
      .then(r => setStudents(r.data?.items || r.data || []))
      .catch(() => {})
      .finally(() => setLoadingStudents(false))
  }, [form.recipient_type, form.class_id])

  const setField = (key, value) => {
    setError('')
    setResult(null)
    setForm(f => ({ ...f, [key]: value }))
  }

  const recipientLabel = useMemo(() => {
    const rt = RECIPIENT_TYPES.find(r => r.value === form.recipient_type)
    if (!rt) return ''
    if (form.recipient_type === 'class') {
      const cls = classes.find(c => String(c.id) === String(form.class_id))
      return cls ? `${rt.label}: ${cls.name}` : rt.label
    }
    if (form.recipient_type === 'student') {
      const s = students.find(s => String(s.id) === String(form.student_id))
      return s ? `${rt.label}: ${s.name_en || s.name}` : rt.label
    }
    return rt.label
  }, [form, classes, students])

  const canSubmit = useMemo(() => {
    if (!form.message.trim()) return false
    if (form.message.length > MSG_LIMIT) return false
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
      toast.success(`Custom message sent — ${res.data.sent} delivered`)
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

  const charsLeft = MSG_LIMIT - form.message.length
  const charsColor = charsLeft < 0 ? '#dc2626' : charsLeft < 100 ? '#d97706' : '#64748b'

  return (
    <div>
      {/* ── Confirm overlay ── */}
      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirmOpen(false)} />
          <div style={{
            position: 'relative', background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440,
            border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Confirm Send</div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 1.6 }}>
              Send a custom message to <strong>{recipientLabel}</strong> via <strong style={{ textTransform: 'capitalize' }}>{form.channel}</strong>?
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {form.message.trim()}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleConfirm}
                style={{ ...buttonStyle('#2563eb'), flex: 1 }}
              >
                Yes, Send Now
              </button>
              <button onClick={() => setConfirmOpen(false)} style={{ ...buttonStyle('#64748b') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {/* Recipient type */}
        <Field label="Recipients">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {RECIPIENT_TYPES.map(rt => {
              const active = form.recipient_type === rt.value
              return (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => { setField('recipient_type', rt.value); setField('class_id', ''); setField('student_id', '') }}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
                    border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                    background: active ? '#eff6ff' : 'white',
                    color: active ? '#1d4ed8' : '#475569',
                    boxShadow: active ? '0 1px 4px rgba(37,99,235,0.15)' : 'none',
                  }}
                >
                  {rt.label}
                </button>
              )
            })}
          </div>
          {form.recipient_type && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: '#64748b' }}>
              {RECIPIENT_TYPES.find(r => r.value === form.recipient_type)?.desc}
            </div>
          )}
        </Field>

        {/* Class picker */}
        {(form.recipient_type === 'class' || form.recipient_type === 'student') && (
          <Field label="Class" required>
            <select
              value={form.class_id}
              onChange={e => { setField('class_id', e.target.value); setField('student_id', '') }}
              style={inputStyle}
              disabled={loadingClasses}
            >
              <option value="">{loadingClasses ? 'Loading…' : 'Select class'}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}

        {/* Student picker */}
        {form.recipient_type === 'student' && (
          <Field label="Student" required>
            <select
              value={form.student_id}
              onChange={e => setField('student_id', e.target.value)}
              style={inputStyle}
              disabled={!form.class_id || loadingStudents}
            >
              <option value="">
                {!form.class_id ? 'Select a class first' : loadingStudents ? 'Loading…' : 'Select student'}
              </option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name_en || s.name}</option>)}
            </select>
          </Field>
        )}

        {/* Channel */}
        <Field label="Channel">
          <div style={{ display: 'flex', gap: 8 }}>
            {CHANNEL_OPTIONS.map(opt => {
              const active = form.channel === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setField('channel', opt.value)}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
                    border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                    background: active ? '#eff6ff' : 'white',
                    color: active ? '#1d4ed8' : '#475569',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Message */}
        <Field label="Message" hint={`${form.message.length} / ${MSG_LIMIT} characters`}>
          <textarea
            value={form.message}
            onChange={e => setField('message', e.target.value)}
            placeholder="Type your message here…"
            rows={5}
            maxLength={MSG_LIMIT + 50}
            style={{
              ...inputStyle,
              minHeight: 110,
              resize: 'vertical',
              padding: '10px 12px',
              lineHeight: 1.6,
            }}
          />
          <div style={{ fontSize: 11.5, color: charsColor, fontWeight: 700, marginTop: 4, textAlign: 'right' }}>
            {charsLeft < 0 ? `${Math.abs(charsLeft)} over limit` : `${charsLeft} remaining`}
          </div>
        </Field>

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff1f2', border: '1px solid #fecdd3', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#15803d', lineHeight: 1.6 }}>
            <strong>Done.</strong> {result.sent} message{result.sent !== 1 ? 's' : ''} sent
            {result.failed > 0 && <span style={{ color: '#b45309' }}> · {result.failed} failed (missing phone numbers)</span>}
          </div>
        )}

        {/* Send button */}
        <button
          type="button"
          disabled={!canSubmit || sending}
          onClick={() => setConfirmOpen(true)}
          style={{
            ...buttonStyle(canSubmit && !sending ? '#2563eb' : '#94a3b8'),
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
            opacity: canSubmit && !sending ? 1 : 0.7, cursor: canSubmit && !sending ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? (
            <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Sending…</>
          ) : (
            <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Send Custom Message</>
          )}
        </button>
      </div>
    </div>
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
    const confirmed = window.confirm(
      `Send ${preview.recipient_count} ${preview.notification_type} notification${preview.recipient_count !== 1 ? 's' : ''}?` +
      (preview.excluded_count ? `\n${preview.excluded_count} recipient${preview.excluded_count !== 1 ? 's are' : ' is'} excluded.` : '')
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
      toast.success('Notification queued for retry')
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBusy('')
    }
  }

  const summaryCards = [
    { label: 'Shown',  value: stats.total,  color: '#0f172a' },
    { label: 'Sent',   value: stats.sent,   color: '#15803d' },
    { label: 'Queued', value: stats.queued, color: '#2563eb' },
    { label: 'Failed', value: stats.failed, color: '#dc2626' },
  ]

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <PageHeader
        title="Notifications"
        subtitle="Monitor WhatsApp and SMS delivery, compose custom messages, and retry failed sends from one place."
        actions={(
          <>
            <button onClick={() => previewBlast('fees')} disabled={busy === 'preview-fees'} style={buttonStyle('#0d7377')}>
              {busy === 'preview-fees' ? 'Previewing…' : 'Preview Fee Reminders'}
            </button>
            <button onClick={() => previewBlast('attendance')} disabled={busy === 'preview-attendance'} style={buttonStyle('#334155')}>
              {busy === 'preview-attendance' ? 'Previewing…' : 'Preview Attendance Alerts'}
            </button>
          </>
        )}
      />

      {/* ── Hero + Composer row ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 0.7fr)', gap: 16, marginBottom: 16 }}>

        {/* Hero panel */}
        <SectionPanel bodyStyle={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: 760 }}>
              <div className="dashboard-kicker">Delivery operations</div>
              <h2 style={{ margin: 0, fontSize: 'clamp(24px, 3vw, 36px)', lineHeight: 1.04, letterSpacing: '-0.05em', color: '#0f172a', fontWeight: 900 }}>
                A cleaner view of every message the school sends.
              </h2>
              <p style={{ margin: '12px 0 0', color: '#475569', fontSize: 14.5, lineHeight: 1.7, maxWidth: 640 }}>
                Preview fee reminders and attendance alerts, send custom messages to any group, and inspect delivery outcomes with rich status cues.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <Badge tone="info">{stats.total} visible</Badge>
                <Badge tone="success">{stats.sent} sent</Badge>
                <Badge tone="warning">{stats.queued} queued</Badge>
                <Badge tone="danger">{stats.failed} failed</Badge>
              </div>
            </div>
          </div>
        </SectionPanel>

        {/* Provider snapshot */}
        <SectionPanel
          title="Provider snapshot"
          subtitle="Preview batch exposes sending state and a sample message before you commit."
          bodyStyle={{ padding: 16, display: 'grid', gap: 12 }}
        >
          {preview ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone={preview.provider_ready ? 'success' : 'warning'}>{preview.provider_ready ? 'Ready' : 'Check provider'}</Badge>
                <Badge tone={preview.kind === 'fees' ? 'violet' : 'info'}>{preview.kind === 'fees' ? 'Fee reminders' : 'Attendance alerts'}</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <Stat label="Recipients" value={preview.recipient_count} color="#0f172a" />
                <Stat label="Excluded"   value={preview.excluded_count}  color="#b45309" />
              </div>
              {preview.provider_warning && (
                <div style={{ padding: 12, borderRadius: 12, border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
                  {preview.provider_warning}
                </div>
              )}
              {preview.sample_message && (
                <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: 12.5, lineHeight: 1.6 }}>
                  <strong style={{ color: '#0f172a' }}>Sample:</strong> {preview.sample_message}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setPreview(null)} style={buttonStyle('#64748b')}>Dismiss</button>
                <button
                  onClick={() => trigger(preview.kind)}
                  disabled={busy === preview.kind || preview.recipient_count === 0 || !preview.provider_ready}
                  style={{ ...buttonStyle('#dc2626'), opacity: preview.recipient_count === 0 || !preview.provider_ready ? 0.55 : 1 }}
                >
                  {busy === preview.kind ? 'Sending…' : `Send ${preview.recipient_count}`}
                </button>
              </div>
              {preview.recipients?.length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'grid', gap: 8, maxHeight: 210, overflow: 'auto' }}>
                  {preview.recipients.slice(0, 10).map(r => (
                    <div key={`${r.student_id}-${r.phone}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: '#fff' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.student_name}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>{r.phone}</div>
                      </div>
                      <Badge tone="slate">Target</Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={(<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 10h8m-8 4h5m1 8l-3-3H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2h-3l-3 3z" /></svg>)}
              title="No preview loaded"
              description="Run a preview to inspect recipients, exclusions, and the message body before sending."
            />
          )}
        </SectionPanel>
      </div>

      {/* ── Custom Message Composer ────────────────────────────────────────── */}
      <SectionPanel
        title="Custom Message"
        subtitle="Send a free-form WhatsApp or SMS message to any group of recipients. Every send is logged."
        bodyStyle={{ padding: 20 }}
        style={{ marginBottom: 16 }}
      >
        <CustomMessageComposer onSent={load} />
      </SectionPanel>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        {summaryCards.map(card => <Stat key={card.label} label={card.label} value={card.value} color={card.color} />)}
      </div>

      {/* ── Delivery controls ─────────────────────────────────────────────── */}
      <SectionPanel
        title="Delivery controls"
        subtitle={`${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'} applied.`}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Type">
            <select value={filters.notification_type} onChange={e => setFilters(f => ({ ...f, notification_type: e.target.value }))} style={inputStyle}>
              <option value="">All types</option>
              <option value="payment_confirmed">Payment</option>
              <option value="fee_due">Fee due</option>
              <option value="low_attendance">Low attendance</option>
              <option value="result_published">Result</option>
              <option value="custom_message">Custom message</option>
              <option value="registration_invite">Registration invite</option>
              <option value="test">Test</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              <option value="">All statuses</option>
              <option value="queued">Queued</option>
              <option value="pending">Pending</option>
              <option value="sending">Sending</option>
              <option value="retry">Retry</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </Field>
          <Field label="Channel">
            <select value={filters.channel} onChange={e => setFilters(f => ({ ...f, channel: e.target.value }))} style={inputStyle}>
              <option value="">All channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={!activeFilterCount}
              onClick={() => setFilters({ notification_type: '', status: '', channel: '' })}
              style={{ ...buttonStyle('#64748b'), opacity: activeFilterCount ? 1 : 0.55 }}
            >
              Clear filters
            </button>
          </div>
        </div>
      </SectionPanel>

      {/* ── Delivery log ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <SectionPanel
          title="Delivery log"
          subtitle="Recent notification records with status, phone, and retry actions."
          actions={<Badge tone="slate">{rows.length} rows</Badge>}
          bodyStyle={{ padding: 0 }}
        >
          <ResponsiveTable>
            <thead>
              <tr>
                {['Type', 'Channel', 'Phone', 'Status', 'Message', 'Created', 'Action'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 7 }).map((__, ci) => (
                      <td key={ci} style={tdStyle}><Skeleton height="14px" width={ci === 4 ? '92%' : '70%'} /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={emptyStyle}>
                    <EmptyState
                      icon={(<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 8h10M7 12h10M7 16h6m-9 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>)}
                      title="No notifications yet"
                      description="Delivery records will appear here once the first message is queued."
                    />
                  </td>
                </tr>
              ) : rows.map((row, index) => {
                const typeMeta = typeTone[row.notification_type] || typeTone.test
                const isRetryable = ['failed', 'retry'].includes(row.status)
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid #eef2f7', background: index % 2 === 0 ? '#fff' : '#fcfdff' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: typeMeta.bg, color: typeMeta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {typeLabel[row.notification_type] || row.notification_type}
                        </span>
                        <span style={{ fontSize: 11.5, color: '#64748b' }}>{row.template_name || ''}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <Badge tone={row.channel === 'sms' ? 'warning' : 'info'}>{row.channel}</Badge>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.recipient_phone}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <Badge tone={row.status === 'sent' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'retry' ? 'warning' : 'slate'}>
                          {statusLabel[row.status] || row.status}
                        </Badge>
                        {row.error_message && <div style={{ color: '#dc2626', fontSize: 11.5, lineHeight: 1.5 }}>{row.error_message}</div>}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 360 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
                          {row.message_preview || row.template_name || '—'}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    <td style={tdStyle}>
                      {isRetryable ? (
                        <button
                          onClick={() => retryNotification(row)}
                          disabled={busy === `retry-${row.id}`}
                          style={{ ...buttonStyle('#d97706'), height: 32, padding: '0 10px', fontSize: 11.5 }}
                        >
                          {busy === `retry-${row.id}` ? 'Retrying…' : 'Retry'}
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </ResponsiveTable>
        </SectionPanel>
      </div>
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  minHeight: 40,
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '0 11px',
  fontSize: 13,
  fontWeight: 700,
  color: '#0f172a',
  background: 'white',
  fontFamily: 'inherit',
}

const buttonStyle = (bg) => ({
  minHeight: 40,
  border: 0,
  borderRadius: 10,
  padding: '0 14px',
  background: bg,
  color: 'white',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
  fontFamily: 'inherit',
})

const thStyle = {
  textAlign: 'left',
  padding: '12px',
  fontSize: 11,
  color: '#64748b',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
}

const tdStyle = {
  padding: '12px',
  fontSize: 13,
  color: '#0f172a',
  verticalAlign: 'top',
  borderBottom: '1px solid #eef2f7',
}

const emptyStyle = {
  padding: 0,
  textAlign: 'center',
  color: '#64748b',
  fontWeight: 700,
}