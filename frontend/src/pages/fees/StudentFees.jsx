// StudentFees.jsx — Fully responsive
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { feeAPI, formatINR, extractPaymentError } from '../../services/api'
import { PageHeader, EmptyState, LoadingPage } from '../../components/UI'
import { ReceiptModal } from '../../components/fees/ReceiptModal'

const PAYMENT_MODES = ['Cash', 'Cheque', 'DD', 'UPI']

function LedgerItem({ item }) {
  const balance = parseFloat(item.balance || 0)
  const paid    = parseFloat(item.paid_amount || 0)
  const total   = parseFloat(item.net_amount || 0)
  const paidPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0
  const isPaid  = balance <= 0
  const isArrear = item.invoice_type === 'arrear'

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
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
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px', flexWrap: 'wrap' }}>
            <span>Billed: <strong style={{ color: 'var(--text-secondary)' }}>{formatINR(total)}</strong></span>
            <span>Paid: <strong style={{ color: 'var(--success-700)' }}>{formatINR(paid)}</strong></span>
            <span>Balance: <strong style={{ color: balance > 0 ? 'var(--danger-600)' : 'var(--success-700)' }}>{formatINR(balance)}</strong></span>
            {item.source_invoice_id && <span>Source: <strong style={{ color: 'var(--text-secondary)' }}>#{item.source_invoice_id}</strong></span>}
          </div>
        </div>
      </div>
      <div style={{ height: '5px', background: 'var(--gray-100)', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
        <div style={{ height: '100%', width: `${paidPct}%`, background: isPaid ? 'var(--success-500)' : 'var(--brand-500)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}


function PaymentModal({ target, ledger, onClose, onSuccess }) {
  const [form, setForm] = useState({
    amount_paid: '',
    mode: 'Cash',
    payment_date: new Date().toISOString().split('T')[0],
    collected_by: '',
    notes: '',
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setForm(f => ({
        ...f,
        amount_paid: target.amount ? target.amount.toFixed(2) : '',
        notes: '',
      }))
      setSaving(false)
    }
  }, [target])

  if (!target || !ledger) return null

  const maxBalance = parseFloat(target.balance || 0)
  const currentAmount = parseFloat(form.amount_paid) || 0

  // Calculate live allocation preview
  let remaining = currentAmount
  const previewAllocations = []
  for (const item of ledger.items || []) {
    const itemBal = parseFloat(item.balance || 0)
    if (itemBal > 0 && remaining > 0) {
      const applied = Math.min(itemBal, remaining)
      previewAllocations.push({
        name: item.fee_head_name,
        amount: applied,
      })
      remaining -= applied
    }
  }

  const handleSubmit = async () => {
    if (saving) return

    const amt = parseFloat(form.amount_paid)

    if (!amt || amt <= 0) {
      toast.error('Amount must be > ₹0')
      return
    }

    if (amt > maxBalance) {
      toast.error('Amount cannot exceed outstanding balance')
      return
    }

    setSaving(true)

    try {
      const result = await feeAPI.recordPayment({
        student_id: parseInt(target.student_id),
        amount_paid: amt,
        mode: form.mode,
        payment_date: form.payment_date,
        collected_by: form.collected_by || null,
        notes: form.notes || null,
        // Pass the plan chosen by admin; null for subsequent instalments
        // (the plan is already locked on the DB row).
        installment_plan: target.installment_plan || null,
      })
      toast.success(`Payment of ${formatINR(amt)} recorded`)
      onSuccess(result.data)
      onClose()
    } catch (err) {
      toast.error(extractPaymentError(err).message)
      setSaving(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--surface-0)', borderRadius: '16px 16px 0 0', padding: '24px 20px 28px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-default)', borderBottom: 'none' }} className="payment-modal-inner">
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Record Payment</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Total Outstanding Balance: <strong style={{ color: 'var(--danger-600)' }}>{formatINR(maxBalance)}</strong>
          {target.installment_plan && (
            <span style={{ marginLeft: '10px', fontSize: '11.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--brand-100)', color: 'var(--brand-700)' }}>
              {target.installment_plan === 'half' ? 'Half' : 'Quarter'} plan · instalment {(target.installments_paid || 0) + 1}/{target.total_installments}
            </span>
          )}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Amount (₹) *</label>
            <input 
              type="number" 
              className="input" 
              value={form.amount_paid} 
              onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} 
              placeholder="0.00" 
              min="0.01" 
              step="0.01" 
              max={maxBalance}
              // Lock the amount when the plan is active — admin cannot change it
              readOnly={Boolean(target.installment_plan)}
              style={target.installment_plan ? { background: 'var(--gray-50)', color: 'var(--text-secondary)' } : undefined}
              autoFocus 
              inputMode="decimal" 
            />
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {target.installment_plan
                ? `Scheduled instalment — amount is fixed by the ${target.installment_plan} plan`
                : `Max: ${formatINR(maxBalance)}`}
            </div>
          </div>

          {/* Live Allocation Preview */}
          {previewAllocations.length > 0 && (
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>Payment Allocation Preview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {previewAllocations.map((alloc, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    <span>{alloc.name}</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatINR(alloc.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          <div>
            <label className="label">Notes / Remarks</label>
            <input type="text" className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" />
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
  const [receipt, setReceipt]     = useState(null)


  const fetchData = useCallback(async () => {
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
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDownloadReceipt = async (paymentId) => {
    try {
      await feeAPI.downloadReceipt(paymentId)
    } catch {
      toast.error('Failed to download receipt')
    }
  }

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

      {/* Collect Fee Payment section */}
      {totalBalance > 0 && (() => {
        // Determine whether any item has a locked plan already in progress.
        const lockedItems = (ledger.items || []).filter(
          item => item.installment_plan && item.installments_paid > 0
        )
        const unlockedItems = (ledger.items || []).filter(
          item => !item.installment_plan && parseFloat(item.balance || 0) > 0
        )
        const planInProgress = lockedItems.length > 0

        return (
          <div className="card" style={{ padding: '20px', marginBottom: '14px', border: '1.5px solid var(--border-default)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>Collect Fee Payment</div>

            {planInProgress ? (
              (() => {
                const firstLocked = lockedItems[0]
                const planLabel = firstLocked.installment_plan === 'half' ? 'Half' : 'Quarter'
                const instNum = firstLocked.installments_paid + 1
                const totalInst = firstLocked.total_installments
                const combinedNextAmt = lockedItems.reduce(
                  (sum, item) => sum + parseFloat(item.next_installment_amount || 0), 0
                )
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Progress dots */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {Array.from({ length: totalInst }).map((_, i) => (
                        <div key={i} style={{
                          width: i < instNum - 1 ? '28px' : '10px',
                          height: '6px',
                          borderRadius: '3px',
                          background: i < instNum - 1 ? 'var(--brand-500)' : i === instNum - 1 ? 'var(--brand-200)' : 'var(--gray-200)',
                          transition: 'all 0.3s'
                        }} />
                      ))}
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                        {instNum - 1} of {totalInst} paid
                      </span>
                    </div>
                    {/* Big collect button */}
                    {combinedNextAmt > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayTarget({
                          student_id: id,
                          amount: combinedNextAmt,
                          balance: totalBalance,
                          installment_plan: firstLocked.installment_plan,
                          installments_paid: firstLocked.installments_paid,
                          total_installments: totalInst,
                        })}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          border: 'none',
                          background: 'var(--brand-600)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s, transform 0.1s',
                          width: '100%',
                          boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-700)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-600)' }}
                        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.99)' }}
                        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                            Collect Instalment {instNum} of {totalInst}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.75)', marginTop: '3px' }}>
                            {planLabel} plan · split across {lockedItems.length} fee head{lockedItems.length > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: '18px', color: 'white' }}>{formatINR(combinedNextAmt)}</div>
                      </button>
                    )}
                  </div>
                )
              })()
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Full payment — solid primary button */}
                <button
                  type="button"
                  onClick={() => setPayTarget({
                    student_id: id, amount: totalBalance, balance: totalBalance,
                    installment_plan: 'full', installments_paid: 0, total_installments: 1,
                  })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', borderRadius: '12px', border: 'none',
                    background: 'var(--brand-600)', cursor: 'pointer', width: '100%',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.22)', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-700)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-600)' }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>Pay in Full</div>
                  <div style={{ fontWeight: 900, fontSize: '17px', color: 'white' }}>{formatINR(totalBalance)}</div>
                </button>

                {/* Half & Quarter — outlined secondary buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'half',    label: 'Pay in 2 Instalments', sub: 'Half each',    amount: totalBalance / 2,  total: 2 },
                    { key: 'quarter', label: 'Pay in 4 Instalments', sub: 'Quarter each', amount: totalBalance / 4,  total: 4 },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPayTarget({
                        student_id: id, amount: opt.amount, balance: totalBalance,
                        installment_plan: opt.key, installments_paid: 0, total_installments: opt.total,
                      })}
                      style={{
                        padding: '12px 14px', borderRadius: '10px',
                        border: '1.5px solid var(--brand-300)',
                        background: 'var(--brand-50)', cursor: 'pointer',
                        textAlign: 'left', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-500)'; e.currentTarget.style.background = 'var(--brand-100)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brand-300)'; e.currentTarget.style.background = 'var(--brand-50)' }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-700)' }}>{opt.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{opt.sub}</div>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', marginTop: '6px' }}>{formatINR(opt.amount)} ×{opt.total}</div>
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '2px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)' }}>₹</span>
                    <input
                      type="number" placeholder="Custom amount" className="input"
                      style={{ paddingLeft: '28px', minHeight: '40px', fontSize: '13.5px' }}
                      id="customAmountInput"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(e.currentTarget.value)
                          if (val > 0 && val <= totalBalance) setPayTarget({ student_id: id, amount: val, balance: totalBalance, installment_plan: null })
                          else toast.error('Invalid amount')
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseFloat(document.getElementById('customAmountInput')?.value || 0)
                      if (val > 0 && val <= totalBalance) setPayTarget({ student_id: id, amount: val, balance: totalBalance, installment_plan: null })
                      else toast.error('Please enter a valid amount')
                    }}
                    style={{ padding: '0 16px', borderRadius: '8px', height: '40px', background: 'var(--gray-800)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    Collect
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

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
            <LedgerItem key={item.student_fee_id} item={item} />
          ))
        )}
      </div>

      {/* Payment history — grouped by receipt_number so that one payment
          session (which may span multiple fee heads / DB rows) appears as
          a single row with a single Download button. */}
      {payments.length > 0 && (() => {
        // Group raw payment rows by receipt_number.
        // Each group = one payment session = one receipt.
        const groupMap = new Map()
        for (const p of payments) {
          const key = p.receipt_number || `no-receipt-${p.id}`
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              receipt_number: p.receipt_number,
              payment_date:   p.payment_date,
              mode:           p.mode,
              collected_by:   p.collected_by,
              total_amount:   0,
              // keep the first payment id for the download call —
              // report_pdf.py uses it to find siblings by receipt_number
              first_id:       p.id,
            })
          }
          groupMap.get(key).total_amount += parseFloat(p.amount_paid || 0)
        }
        const grouped = Array.from(groupMap.values())

        return (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Payment History</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {grouped.length} transaction{grouped.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="data-table" style={{ minWidth: '540px' }}>
                <thead>
                  <tr>
                    <th>Receipt No.</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Collected By</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(g => (
                    <tr key={g.receipt_number || g.first_id}>
                      <td><span className="mono" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{g.receipt_number}</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{g.payment_date}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success-700)' }}>{formatINR(g.total_amount)}</td>
                      <td><span style={{ fontSize: '11.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--gray-100)', color: 'var(--text-secondary)' }}>{g.mode}</span></td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>{g.collected_by || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownloadReceipt(g.first_id)}
                          disabled={!g.receipt_number}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      <PaymentModal target={payTarget} ledger={ledger} onClose={() => setPayTarget(null)} onSuccess={(payment) => { setReceipt(payment); fetchData() }} />
      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}