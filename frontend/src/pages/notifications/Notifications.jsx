import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { extractError, notificationAPI } from '../../services/api'
import { EmptyState, Field, PageHeader, ResponsiveTable, SectionPanel, Skeleton } from '../../components/UI'

const typeLabel = {
  payment_confirmed: 'Payment',
  fee_due: 'Fee Due',
  low_attendance: 'Low Attendance',
  result_published: 'Result',
  test: 'Test',
}

const typeTone = {
  payment_confirmed: { color: '#0f766e', bg: '#ecfdf5' },
  fee_due: { color: '#b45309', bg: '#fffbeb' },
  low_attendance: { color: '#7c3aed', bg: '#f5f3ff' },
  result_published: { color: '#2563eb', bg: '#eff6ff' },
  test: { color: '#475569', bg: '#f8fafc' },
}

const statusColor = {
  queued: '#64748b',
  pending: '#64748b',
  sending: '#2563eb',
  retry: '#d97706',
  sent: '#15803d',
  failed: '#dc2626',
}

const statusLabel = {
  queued: 'Queued',
  pending: 'Pending',
  sending: 'Sending',
  retry: 'Retry',
  sent: 'Sent',
  failed: 'Failed',
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:14, padding:'14px 16px', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
      <div style={{ fontSize:11, color:'#64748b', fontWeight:800, textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:900, color, marginTop:4 }}>{value}</div>
    </div>
  )
}

function Badge({ tone = 'slate', children }) {
  const palette = {
    slate: { color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
    success: { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
    warning: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    danger: { color: '#b91c1c', bg: '#fff1f2', border: '#fecdd3' },
    info: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    violet: { color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  }
  const color = palette[tone] || palette.slate
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
      border: `1px solid ${color.border}`, color: color.color, background: color.bg, fontSize: 11,
      fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export default function Notifications() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ notification_type:'', status:'', channel:'' })
  const [testForm, setTestForm] = useState({ phone:'', channel:'whatsapp' })
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    notificationAPI.list(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)))
      .then(r => setRows(r.data || []))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total: rows.length,
    sent: rows.filter(r => r.status === 'sent').length,
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

  const sendTest = async () => {
    if (!testForm.phone.trim()) { toast.error('Enter a phone number'); return }
    try {
      setBusy('test')
      await notificationAPI.sendTest(testForm)
      toast.success('Test notification queued')
      setTestForm(f => ({ ...f, phone:'' }))
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBusy('')
    }
  }

  const summaryCards = [
    { label: 'Shown', value: stats.total, color: '#0f172a' },
    { label: 'Sent', value: stats.sent, color: '#15803d' },
    { label: 'Queued', value: stats.queued, color: '#2563eb' },
    { label: 'Failed', value: stats.failed, color: '#dc2626' },
  ]

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

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Monitor WhatsApp and SMS delivery, preview school-wide sends, and retry failed messages from one place."
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 0.7fr)', gap: 16, marginBottom: 16 }}>
        <SectionPanel
          className="notifications-hero-panel"
          bodyStyle={{ padding: 20 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: 760 }}>
              <div className="dashboard-kicker">Delivery operations</div>
              <h2 style={{ margin: 0, fontSize: 'clamp(24px, 3vw, 36px)', lineHeight: 1.04, letterSpacing: '-0.05em', color: '#0f172a', fontWeight: 900 }}>
                A cleaner view of every message the school sends.
              </h2>
              <p style={{ margin: '12px 0 0', color: '#475569', fontSize: 14.5, lineHeight: 1.7, maxWidth: 640 }}>
                Preview fee reminders and attendance alerts, send test messages, and inspect delivery outcomes with richer status cues.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <Badge tone="info">{stats.total} visible</Badge>
                <Badge tone="success">{stats.sent} sent</Badge>
                <Badge tone="warning">{stats.queued} queued</Badge>
                <Badge tone="danger">{stats.failed} failed</Badge>
              </div>
            </div>

            <div style={{ minWidth: 240, maxWidth: 320, width: '100%', padding: 14, borderRadius: 16, border: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quick send</div>
              <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Test a delivery path</div>
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <Field label="Phone">
                  <input
                    value={testForm.phone}
                    onChange={e => setTestForm(f => ({ ...f, phone:e.target.value }))}
                    placeholder="Test phone"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Channel">
                  <select
                    value={testForm.channel}
                    onChange={e => setTestForm(f => ({ ...f, channel:e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                  </select>
                </Field>
                <button onClick={sendTest} disabled={busy === 'test'} style={{ ...buttonStyle('#2563eb'), width: '100%' }}>
                  {busy === 'test' ? 'Sending…' : 'Send Test Message'}
                </button>
              </div>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Provider snapshot"
          subtitle="A preview batch exposes the sending state and a sample message from the current template."
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
                <Stat label="Excluded" value={preview.excluded_count} color="#b45309" />
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
              icon={(
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 10h8m-8 4h5m1 8l-3-3H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2h-3l-3 3z" />
                </svg>
              )}
              title="No preview loaded"
              description="Run a preview to inspect recipients, exclusions, and the message body before sending."
            />
          )}
        </SectionPanel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>
        {summaryCards.map(card => <Stat key={card.label} label={card.label} value={card.value} color={card.color} />)}
      </div>

      <SectionPanel
        title="Delivery controls"
        subtitle={`${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'} applied.`}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Type">
            <select value={filters.notification_type} onChange={e => setFilters(f => ({ ...f, notification_type:e.target.value }))} style={inputStyle}>
              <option value="">All types</option>
              <option value="payment_confirmed">Payment</option>
              <option value="fee_due">Fee due</option>
              <option value="low_attendance">Low attendance</option>
              <option value="result_published">Result</option>
              <option value="test">Test</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status:e.target.value }))} style={inputStyle}>
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
            <select value={filters.channel} onChange={e => setFilters(f => ({ ...f, channel:e.target.value }))} style={inputStyle}>
              <option value="">All channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
          </Field>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button
              type="button"
              disabled={!activeFilterCount}
              onClick={() => setFilters({ notification_type:'', status:'', channel:'' })}
              style={{ ...buttonStyle('#64748b'), opacity: activeFilterCount ? 1 : 0.55 }}
            >
              Clear filters
            </button>
          </div>
        </div>
      </SectionPanel>

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
                {['Type','Channel','Phone','Status','Message','Created','Action'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <td key={cellIndex} style={tdStyle}><Skeleton height="14px" width={cellIndex === 4 ? '92%' : '70%'} /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={emptyStyle}>
                    <EmptyState
                      icon={(
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 8h10M7 12h10M7 16h6m-9 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      )}
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
                        <Badge tone="slate">{typeLabel[row.notification_type] || row.notification_type}</Badge>
                        <span style={{ fontSize: 11.5, color: '#64748b' }}>{row.template_name || 'Template not recorded'}</span>
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
                        {row.error_message && <div style={{ color:'#dc2626', fontSize:11.5, lineHeight: 1.5 }}>{row.error_message}</div>}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 360 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <span style={{ fontSize: 12.5, color: typeMeta.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {row.notification_type}
                        </span>
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
