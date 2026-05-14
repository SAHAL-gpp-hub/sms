import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { extractError, notificationAPI } from '../../services/api'

const typeLabel = {
  payment_confirmed: 'Payment',
  fee_due: 'Fee Due',
  low_attendance: 'Low Attendance',
  result_published: 'Result',
  test: 'Test',
}

const statusColor = {
  queued: '#64748b',
  pending: '#64748b',
  sending: '#2563eb',
  retry: '#d97706',
  sent: '#15803d',
  failed: '#dc2626',
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:8, padding:'14px 16px' }}>
      <div style={{ fontSize:11, color:'#64748b', fontWeight:800, textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:900, color, marginTop:4 }}>{value}</div>
    </div>
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

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:16, alignItems:'flex-start', marginBottom:18, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:900, color:'#0f172a' }}>Notification Centre</h1>
          <p style={{ margin:'4px 0 0', color:'#64748b', fontSize:13, fontWeight:600 }}>
            WhatsApp and SMS delivery logs for parent messages
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={() => previewBlast('fees')} disabled={busy === 'preview-fees'} style={buttonStyle('#0d7377')}>
            {busy === 'preview-fees' ? 'Previewing…' : 'Preview Fee Reminders'}
          </button>
          <button onClick={() => previewBlast('attendance')} disabled={busy === 'preview-attendance'} style={buttonStyle('#334155')}>
            {busy === 'preview-attendance' ? 'Previewing…' : 'Preview Attendance Alerts'}
          </button>
        </div>
      </div>

      {preview && (
        <div style={{ background:'white', border:'1px solid #cbd5e1', borderRadius:10, padding:14, marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:12, fontWeight:900, color:'#0f172a', textTransform:'uppercase', letterSpacing:'0.05em' }}>Send Preview</div>
              <div style={{ fontSize:14, color:'#334155', marginTop:4, fontWeight:700 }}>
                {preview.recipient_count} recipient{preview.recipient_count !== 1 ? 's' : ''} · {preview.excluded_count} excluded
              </div>
              {preview.provider_warning && (
                <div style={{ color:'#b45309', fontSize:12, marginTop:6, fontWeight:700 }}>{preview.provider_warning}</div>
              )}
              {preview.sample_message && (
                <div style={{ color:'#64748b', fontSize:12, marginTop:8 }}>Sample: {preview.sample_message}</div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button onClick={() => setPreview(null)} style={buttonStyle('#64748b')}>Cancel</button>
              <button
                onClick={() => trigger(preview.kind)}
                disabled={busy === preview.kind || preview.recipient_count === 0 || !preview.provider_ready}
                style={{ ...buttonStyle('#dc2626'), opacity: preview.recipient_count === 0 || !preview.provider_ready ? 0.55 : 1 }}
              >
                {busy === preview.kind ? 'Sending…' : `Send to ${preview.recipient_count}`}
              </button>
            </div>
          </div>
          {preview.recipients?.length > 0 && (
            <div style={{ marginTop:12, maxHeight:180, overflow:'auto', borderTop:'1px solid #e2e8f0' }}>
              {preview.recipients.slice(0, 20).map(r => (
                <div key={`${r.student_id}-${r.phone}`} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'8px 0', borderBottom:'1px solid #f1f5f9', fontSize:12 }}>
                  <strong>{r.student_name}</strong>
                  <span style={{ color:'#64748b' }}>{r.phone}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:14 }}>
        <Stat label="Shown" value={stats.total} color="#0f172a" />
        <Stat label="Sent" value={stats.sent} color="#15803d" />
        <Stat label="Queued" value={stats.queued} color="#2563eb" />
        <Stat label="Failed" value={stats.failed} color="#dc2626" />
      </div>

      <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:8, padding:14, marginBottom:14, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
        <select value={filters.notification_type} onChange={e => setFilters(f => ({ ...f, notification_type:e.target.value }))} style={inputStyle}>
          <option value="">All types</option>
          <option value="payment_confirmed">Payment</option>
          <option value="fee_due">Fee due</option>
          <option value="low_attendance">Low attendance</option>
          <option value="test">Test</option>
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status:e.target.value }))} style={inputStyle}>
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="retry">Retry</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select value={filters.channel} onChange={e => setFilters(f => ({ ...f, channel:e.target.value }))} style={inputStyle}>
          <option value="">All channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
        <div style={{ display:'flex', gap:8 }}>
          <input value={testForm.phone} onChange={e => setTestForm(f => ({ ...f, phone:e.target.value }))} placeholder="Test phone" style={{ ...inputStyle, flex:1 }} />
          <select value={testForm.channel} onChange={e => setTestForm(f => ({ ...f, channel:e.target.value }))} style={{ ...inputStyle, width:105 }}>
            <option value="whatsapp">WA</option>
            <option value="sms">SMS</option>
          </select>
          <button onClick={sendTest} disabled={busy === 'test'} style={buttonStyle('#2563eb')}>Test</button>
        </div>
      </div>

      <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:850 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Type','Channel','Phone','Status','Message','Created'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={emptyStyle}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="6" style={emptyStyle}>No notifications yet</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} style={{ borderTop:'1px solid #eef2f7' }}>
                  <td style={tdStyle}>{typeLabel[row.notification_type] || row.notification_type}</td>
                  <td style={tdStyle}>{row.channel}</td>
                  <td style={tdStyle}>{row.recipient_phone}</td>
                  <td style={tdStyle}>
                    <span style={{ color:statusColor[row.status] || '#64748b', fontWeight:900 }}>{row.status}</span>
                    {row.error_message && <div style={{ color:'#dc2626', fontSize:11, marginTop:3 }}>{row.error_message}</div>}
                  </td>
                  <td style={{ ...tdStyle, maxWidth:340 }}>{row.message_preview || row.template_name || '—'}</td>
                  <td style={tdStyle}>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  height:38, border:'1px solid #cbd5e1', borderRadius:8, padding:'0 10px',
  fontSize:13, fontWeight:700, color:'#0f172a', background:'white',
}

const buttonStyle = (bg) => ({
  height:38, border:0, borderRadius:8, padding:'0 13px', background:bg,
  color:'white', fontSize:13, fontWeight:900, cursor:'pointer', whiteSpace:'nowrap',
})

const thStyle = {
  textAlign:'left', padding:'11px 12px', fontSize:11, color:'#64748b',
  fontWeight:900, textTransform:'uppercase', letterSpacing:'0.04em',
}

const tdStyle = {
  padding:'12px', fontSize:13, color:'#0f172a', verticalAlign:'top',
}

const emptyStyle = {
  padding:28, textAlign:'center', color:'#64748b', fontWeight:700,
}
