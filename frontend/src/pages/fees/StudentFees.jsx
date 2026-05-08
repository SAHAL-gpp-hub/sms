// StudentFees.jsx — Fully responsive
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { feeAPI, formatINR, extractError } from '../../services/api'
import { PageHeader, EmptyState, LoadingPage } from '../../components/UI'

const PAYMENT_MODES = ['Cash', 'Cheque', 'DD', 'UPI']

const buildPaymentForm = (feeItem) => ({
  amount_paid: feeItem?.balance ? Number(feeItem.balance).toFixed(2) : '',
  mode: 'Cash',
  payment_date: new Date().toISOString().split('T')[0],
  collected_by: '',
})

function LedgerItem({ item, onPay }) {
  const balance = parseFloat(item.balance || 0)
  const paid    = parseFloat(item.paid_amount || 0)
  const total   = parseFloat(item.net_amount || 0)
  const paidPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0
  const isPaid  = balance <= 0
  const isArrear = item.invoice_type === 'arrear'

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.fee_head_name}</span>
            {isArrear && (
              <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '1px 7px', borderRadius: '20px', background: 'var(--warning-100)', color: 'var(--warning-700)' }}>
                Arrear
              </span>
            )}
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px', background: isPaid ? 'var(--success-100)' : 'var(--danger-100)', color: isPaid ? 'var(--success-700)' : 'var(--danger-700)' }}>
              {isPaid ? 'Paid' : 'Due'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px', flexWrap: 'wrap' }}>
            <span>Billed: <strong style={{ color: 'var(--text-secondary)' }}>{formatINR(total)}</strong></span>
            <span>Paid: <strong style={{ color: 'var(--success-700)' }}>{formatINR(paid)}</strong></span>
            <span>Balance: <strong style={{ color: balance > 0 ? 'var(--danger-600)' : 'var(--success-700)' }}>{formatINR(balance)}</strong></span>
            {item.source_invoice_id && <span>Source invoice: <strong style={{ color: 'var(--text-secondary)' }}>#{item.source_invoice_id}</strong></span>}
          </div>
        </div>
        {!isPaid && (
          <button
            onClick={() => onPay(item)}
            style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, background: 'var(--brand-600)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0, touchAction: 'manipulation', minHeight: '36px' }}
          >
            Pay
          </button>
        )}
      </div>
      <div style={{ height: '5px', background: 'var(--gray-100)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${paidPct}%`, background: isPaid ? 'var(--success-500)' : 'var(--brand-500)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

function PaymentModal({ item, onClose, onSuccess }) {
  const [form, setForm] = useState(() => buildPaymentForm(item))

  const [saving, setSaving] = useState(false)

  const itemId = item?.student_fee_id
  const itemBalance = item?.balance
  const balance = item ? parseFloat(item.balance) : 0

  useEffect(() => {
    if (itemId) {
      setForm(buildPaymentForm({ balance: itemBalance }))
    }
  }, [itemId, itemBalance])

  const handleSubmit = async () => {

    const amt = parseFloat(form.amount_paid)

    if (!amt || amt <= 0) {

      toast.error('Amount must be > ₹0')

      return

    }

    if (amt > balance) {

      toast.error('Amount cannot exceed balance')

      return

    }

    if (!item?.student_fee_id) {

      toast.error('Invalid fee record')

      return

    }

    setSaving(true)

    try {

      await feeAPI.recordPayment({
        student_fee_id: item.student_fee_id,
        amount_paid: amt,
        mode: form.mode,
        payment_date: form.payment_date,
        collected_by: form.collected_by || null,

      })
      toast.success(`Payment of ${formatINR(amt)} recorded`)
      onSuccess()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--surface-0)', borderRadius: '16px 16px 0 0', padding: '24px 20px 28px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-default)', borderBottom: 'none' }} className="payment-modal-inner">
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Record Payment</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          {item.fee_head_name} — Balance: <strong style={{ color: 'var(--danger-600)' }}>{formatINR(balance)}</strong>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" className="input" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} placeholder="0.00" min="0.01" step="0.01" max={balance} autoFocus inputMode="decimal" />
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Max: {formatINR(balance)}</div>
          </div>

          <div>
            <label className="label">Payment Mode *</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PAYMENT_MODES.map(m => (
                <button key={m} type="button" onClick={() => setForm(f => ({ ...f, mode: m }))}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', background: form.mode === m ? 'var(--brand-600)' : 'var(--surface-0)', color: form.mode === m ? 'white' : 'var(--text-secondary)', border: `1.5px solid ${form.mode === m ? 'var(--brand-600)' : 'var(--border-default)'}`, transition: 'all 0.12s', touchAction: 'manipulation', minHeight: '40px', flex: '1 0 auto' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Payment Date *</label>
            <input type="date" className="input" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>

          <div>
            <label className="label">Collected By</label>
            <input type="text" className="input" value={form.collected_by} onChange={e => setForm(f => ({ ...f, collected_by: e.target.value }))} placeholder="Staff name (optional)" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleSubmit} disabled={saving}>
            {saving ? <><span className="spinner" style={{ width: '15px', height: '15px' }} /> Processing…</> : 'Confirm Payment'}
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
      <style>{`
        @media (min-width: 640px) {
          .payment-modal-inner {
            border-radius: 16px !important;
            border-bottom: 1px solid var(--border-default) !important;
          }
        }
      `}</style>
    </div>
  )
}

export default function StudentFees() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ledger, setLedger]       = useState(null)
  const [payments, setPayments]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [payTarget, setPayTarget] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [l, p] = await Promise.all([feeAPI.getLedger(id), feeAPI.getPayments(id)])
      setLedger(l.data)
      setPayments(p.data)
    } catch {
      toast.error('Failed to load fee data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  if (loading) return <LoadingPage />
  if (!ledger) return (
    <div>
      <PageHeader title="Fee Ledger" back={() => navigate(-1)} />
      <EmptyState icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.5} /></svg>} title="Student not found" />
    </div>
  )

  const totalDue     = parseFloat(ledger.total_due || 0)
  const totalPaid    = parseFloat(ledger.total_paid || 0)
  const totalBalance = parseFloat(ledger.total_balance || 0)
  const collectionPct = totalDue > 0 ? Math.min((totalPaid / totalDue) * 100, 100) : 0

  return (
    <div style={{ maxWidth: '760px' }}>
      <PageHeader title={ledger.student_name} subtitle="Fee Ledger & Payment History" back={() => navigate(-1)} />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
        {[
          { label: 'Total Billed', value: formatINR(totalDue),     color: 'var(--text-primary)' },
          { label: 'Total Paid',   value: formatINR(totalPaid),    color: 'var(--success-600)' },
          { label: 'Balance Due',  value: formatINR(totalBalance),  color: totalBalance > 0 ? 'var(--danger-600)' : 'var(--success-600)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--surface-0)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '12px 14px', boxShadow: 'var(--shadow-xs)' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '5px' }}>{c.label}</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: c.color, letterSpacing: '-0.02em', wordBreak: 'break-all' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      {totalDue > 0 && (
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '14px 16px', marginBottom: '14px', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Collection Progress</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: collectionPct >= 100 ? 'var(--success-600)' : 'var(--text-primary)' }}>{collectionPct.toFixed(1)}%</span>
          </div>
          <div style={{ height: '8px', background: 'var(--gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${collectionPct}%`, background: collectionPct >= 100 ? 'var(--success-500)' : 'var(--brand-500)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}

      {/* Fee breakdown */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div className="card-header">
          <div className="card-title">Fee Breakdown</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{ledger.items?.length || 0} items</div>
        </div>
        {!ledger.items?.length ? (
          <EmptyState
            icon={<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
            title="No fees assigned yet"
            description="Set up fee structure and assign fees to students"
          />
        ) : (
          ledger.items.map(item => (
            <LedgerItem key={item.student_fee_id} item={item} onPay={setPayTarget} />
          ))
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Payment History</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{payments.length} transaction{payments.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table" style={{ minWidth: '440px' }}>
              <thead>
                <tr>
                  <th>Receipt No.</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Collected By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td><span className="mono" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{p.receipt_number}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{p.payment_date}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success-700)' }}>{formatINR(p.amount_paid)}</td>
                    <td><span style={{ fontSize: '11.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--gray-100)', color: 'var(--text-secondary)' }}>{p.mode}</span></td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>{p.collected_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaymentModal item={payTarget} onClose={() => setPayTarget(null)} onSuccess={() => { setPayTarget(null); fetchData() }} />
    </div>
  )
}
