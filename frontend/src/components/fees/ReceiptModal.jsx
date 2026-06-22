// src/components/fees/ReceiptModal.jsx
import toast from 'react-hot-toast'
import { feeAPI } from '../../services/api'

export function ReceiptModal({ payment, onClose }) {
  const receiptNoStr = payment.receipt_numbers?.join(', ') || payment.receipt_number || '—'
  const isMulti = payment.allocations && payment.allocations.length > 0

  const handlePrint = async () => {
    // All fee-head allocations in one payment session share the same
    // receipt_number, and the PDF renderer consolidates siblings — so
    // downloading the first payment_id is enough for the full receipt.
    const pid = payment.payment_ids?.[0] || payment.id
    if (!pid) {
      toast.error('Payment ID is missing — cannot generate receipt')
      console.error('ReceiptModal: payment has no id or payment_ids', payment)
      return
    }

    try {
      await feeAPI.downloadReceipt(pid)
    } catch (err) {
      console.error('ReceiptModal: failed to open receipt PDF for payment', pid, err)
      toast.error('Failed to open receipt')
    }
  }

  const totalAmt = payment.total_amount || payment.amount_paid || 0

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 250,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'relative',
          background: 'var(--surface-0)',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-default)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Payment Recorded Successfully</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{
              padding: 0,
              minHeight: 'auto',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%'
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
          Receipt(s) <strong>{receiptNoStr}</strong> of <strong>₹{Number(totalAmt).toLocaleString('en-IN')}</strong> generated for <strong>{payment.student_name || 'Student'}</strong>.
          {isMulti && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--gray-50)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              {payment.allocations.map((a, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>{a.fee_head_name}</span>
                  <strong>₹{Number(a.amount_applied).toLocaleString('en-IN')}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePrint}>
            Print Receipt
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}