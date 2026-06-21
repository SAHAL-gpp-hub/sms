// src/components/fees/ReceiptModal.jsx
import { useRef } from 'react'

export function ReceiptModal({ payment, onClose }) {
  const receiptNoStr = payment.receipt_numbers?.join(', ') || payment.receipt_number || '—'
  const isMulti = payment.allocations && payment.allocations.length > 0

  const handlePrint = () => {
    const w = window.open('', '_blank')
    const esc = (value) => String(value ?? '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
    const inr = (value) => Number(value || 0).toLocaleString('en-IN')
    w.document.write(`
      <html><head><title>Receipt ${receiptNoStr}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; font-size: 13px; }
        h2   { margin: 0 0 2px; font-size: 18px; }
        .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
        hr   { border: none; border-top: 2px solid #333; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; }
        td   { padding: 6px 0; vertical-align: top; }
        td:first-child { color: #555; width: 140px; }
        td:last-child  { font-weight: 600; }
        .amount { font-size: 20px; font-weight: 800; color: #16a34a; }
        .footer { margin-top: 32px; font-size: 11px; color: #999; text-align: center; }
        .alloc-table { width: 100%; margin: 10px 0; border-collapse: collapse; }
        .alloc-table th, .alloc-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .alloc-table th { background: #f8fafc; font-weight: bold; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>Iqra English Medium School</h2>
      <div class="sub">Palanpur, Gujarat</div>
      <hr/>
      <h3 style="margin:0 0 12px">Fee Receipt</h3>
      <table>
        <tr><td>Receipt No.</td><td>${esc(receiptNoStr)}</td></tr>
        <tr><td>Date</td><td>${esc(payment.payment_date)}</td></tr>
        <tr><td>Student</td><td>${esc(payment.student_name)}</td></tr>
        <tr><td>GR No.</td><td>${esc(payment.student_gr_no)}</td></tr>
        <tr><td>Class</td><td>${esc(payment.class_name)}</td></tr>
        <tr><td>Mode</td><td>${esc(payment.mode)}</td></tr>
        <tr><td>Collected By</td><td>${esc(payment.collected_by)}</td></tr>
        ${payment.notes ? `<tr><td>Notes</td><td>${esc(payment.notes)}</td></tr>` : ''}
      </table>
      
      ${isMulti ? `
      <hr/>
      <h4 style="margin:12px 0 6px">Payment Allocations</h4>
      <table class="alloc-table">
        <thead>
          <tr>
            <th>Fee Head</th>
            <th>Amount Applied</th>
            <th>Balance After</th>
          </tr>
        </thead>
        <tbody>
          ${payment.allocations.map(a => `
            <tr>
              <td>${esc(a.fee_head_name)}</td>
              <td>₹${inr(a.amount_applied)}</td>
              <td>₹${inr(a.balance_after)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : `
      <table>
        <tr><td>Fee Head</td><td>${esc(payment.fee_head_name)}</td></tr>
        <tr><td>Instalment</td><td>${esc(payment.instalment_seq || 'Full payment')}</td></tr>
      </table>
      `}
      
      <hr/>
      <table>
        <tr><td>Total Paid</td><td class="amount">₹${inr(payment.total_amount || payment.amount_paid)}</td></tr>
        <tr><td>Total Balance After</td><td style="color:${(payment.total_balance_after || payment.balance_after) > 0 ? '#dc2626' : '#16a34a'}">
          ₹${inr(payment.total_balance_after ?? payment.balance_after)}
        </td></tr>
      </table>
      <div class="footer">Computer-generated receipt · No signature required</div>
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
      </body></html>
    `)
    w.document.close()
    w.focus()
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