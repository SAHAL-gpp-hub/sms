// frontend/src/pages/portal/PortalFees.jsx
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { usePortalContext } from '../../layouts/portalContext'
import { extractError, paymentAPI, portalAPI } from '../../services/api'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', minimumFractionDigits:0 }).format(Number(n) || 0)

let razorpayScriptPromise = null

const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(true)
  if (razorpayScriptPromise) return razorpayScriptPromise

  razorpayScriptPromise = new Promise((resolve, reject) => {
    document.querySelector('script[data-razorpay-checkout]')?.remove()
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve(true)
    script.onerror = () => {
      script.remove()
      razorpayScriptPromise = null
      reject(new Error('Failed to load Razorpay checkout'))
    }
    document.body.appendChild(script)
  })

  return razorpayScriptPromise
}

function FeeItem({ item, canPay, payingId, onPay }) {
  const balance = parseFloat(item.balance || 0)
  const paid    = parseFloat(item.paid_amount || 0)
  const total   = parseFloat(item.net_amount || 0)
  const paidPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0
  const isPaid  = balance <= 0

  return (
    <div style={{ padding:'13px 0', borderBottom:'1px solid #f0f7f7' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', marginBottom:'8px' }}>
        <div>
          <div style={{ fontSize:'14px', fontWeight:700, color:'#0f172a' }}>{item.fee_head_name}</div>
          <div style={{ fontSize:'11.5px', color:'#64748b', marginTop:'2px', fontWeight:600 }}>
            {item.frequency} · Billed: {fmt(total)}
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          {isPaid ? (
            <span style={{ fontSize:'12px', fontWeight:800, padding:'3px 10px', borderRadius:'20px', background:'#dcfce7', color:'#15803d', display:'inline-flex', alignItems:'center', gap:'3px' }}><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg> Cleared</span>
          ) : (
            <div>
              <div style={{ fontSize:'15px', fontWeight:900, color:'#dc2626', letterSpacing:'-0.02em' }}>{fmt(balance)}</div>
              <div style={{ fontSize:'10px', fontWeight:700, color:'#dc2626' }}>due</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
        <div style={{ flex:1, height:'5px', background:'#f1f5f9', borderRadius:'3px', overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:'3px', transition:'width 0.5s ease', width:`${paidPct}%`, background: isPaid ? '#16a34a':'#0d7377' }} />
        </div>
        <span style={{ fontSize:'10.5px', fontWeight:700, color: isPaid ? '#16a34a':'#0d7377', whiteSpace:'nowrap' }}>
          {fmt(paid)} paid
        </span>
      </div>
      {!isPaid && canPay && (
        <button
          type="button"
          onClick={() => onPay(item.student_fee_id, balance)}
          disabled={payingId === item.student_fee_id}
          style={{
            marginTop:'10px', width:'100%', border:0, borderRadius:'12px',
            padding:'10px 12px', background:'#0d7377', color:'white',
            fontSize:'13px', fontWeight:900, cursor: payingId === item.student_fee_id ? 'wait' : 'pointer',
            opacity: payingId === item.student_fee_id ? 0.7 : 1,
          }}
        >
          {payingId === item.student_fee_id ? 'Opening checkout…' : `Pay ${fmt(balance)} Online`}
        </button>
      )}
    </div>
  )
}

export default function PortalFees() {
  const { role, selectedChildId } = usePortalContext()
  const isParent = role === 'parent'

  const [ledger,  setLedger]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [verifyingOrderId, setVerifyingOrderId] = useState('')
  const [paymentHistory, setPaymentHistory] = useState([])

  const reloadLedger = useCallback(() => {
    setLoading(true); setError(false); setLedger(null)
    const req = isParent && selectedChildId
      ? portalAPI.getChildFees(selectedChildId)
      : !isParent
        ? portalAPI.getFees()
        : null

    if (!req) { setLoading(false); return }
    req.then(r => { setLedger(r.data); setLoading(false) })
       .catch(() => { setError(true); setLoading(false) })
  }, [isParent, selectedChildId])

  useEffect(() => {
    reloadLedger()
  }, [reloadLedger])

  useEffect(() => {
    const studentId = ledger?.student_id || selectedChildId
    if (!studentId) return
    paymentAPI.history(studentId)
      .then(r => setPaymentHistory(r.data || []))
      .catch(() => setPaymentHistory([]))
  }, [ledger?.student_id, selectedChildId])

  const pollOrderStatus = async (orderId) => {
    setVerifyingOrderId(orderId)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data } = await paymentAPI.orderStatus(orderId)
      if (data.status === 'paid') {
        toast.success(`Payment confirmed · ${data.receipt_number || 'receipt generated'}`)
        reloadLedger()
        setVerifyingOrderId('')
        return data
      }
      if (data.status === 'failed' || data.status === 'expired') {
        setVerifyingOrderId('')
        throw new Error(data.failure_reason || `Payment ${data.status}`)
      }
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
    setVerifyingOrderId('')
    toast('Payment is still pending. Check payment history before retrying.')
    return null
  }

  const handlePayNow = async (studentFeeId, amount) => {
    try {
      setPayingId(studentFeeId)
      await loadRazorpay()
      const { data: order } = await paymentAPI.createOrder({
        student_fee_id: studentFeeId,
        amount,
      })
      setVerifyingOrderId(order.order_id)

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Iqra English Medium School',
        description: 'School fee payment',
        order_id: order.order_id,
        prefill: {
          name: order.student_name,
          contact: order.contact || '',
          email: order.email || '',
        },
        theme: { color: '#0d7377' },
        handler: async (response) => {
          try {
            await paymentAPI.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            await pollOrderStatus(response.razorpay_order_id)
          } catch (err) {
            toast.error(extractError(err))
          } finally {
            setPayingId(null)
            setVerifyingOrderId('')
          }
        },
        modal: {
          ondismiss: () => {
            setPayingId(null)
            setVerifyingOrderId('')
          },
        },
      }

      const checkout = new window.Razorpay(options)
      checkout.on('payment.failed', (response) => {
        toast.error(response.error?.description || 'Payment failed')
        setPayingId(null)
      })
      checkout.open()
    } catch (err) {
      toast.error(extractError(err))
      setPayingId(null)
    }
  }

  if (loading) return (
    <div>
      <style>{`@keyframes portalShimmer{0%{background-position:-200% center}100%{background-position:200% center}}`}</style>
      {[1,2,3].map(i => (
        <div key={i} style={{ height:'70px', borderRadius:'16px', background:'linear-gradient(90deg,#f0f7f7 25%,#e0eded 50%,#f0f7f7 75%)', backgroundSize:'200% auto', animation:'portalShimmer 1.5s linear infinite', marginBottom:'10px' }} />
      ))}
    </div>
  )

  if (error || !ledger) return (
    <div style={{ textAlign:'center', padding:'40px 20px', background:'white', borderRadius:'16px' }}>
      <div style={{ marginBottom:'10px', display:'flex', justifyContent:'center' }}><svg width="40" height="40" fill="none" stroke="#b45309" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg></div>
      <div style={{ fontWeight:700, color:'#0f172a' }}>Couldn't load fee data</div>
      <div style={{ fontSize:'12.5px', color:'#64748b', marginTop:'4px' }}>
        {isParent && !selectedChildId ? 'Select a student first' : 'Please try again later'}
      </div>
    </div>
  )

  const totalDue     = parseFloat(ledger.total_due     || 0)
  const totalPaid    = parseFloat(ledger.total_paid    || 0)
  const totalBalance = parseFloat(ledger.total_balance || 0)
  const collPct      = totalDue > 0 ? Math.min((totalPaid / totalDue) * 100, 100) : 0
  const hasBalance   = totalBalance > 0
  const canPayOnline = ((isParent && Boolean(selectedChildId)) || role === 'student') && hasBalance

  return (
    <>
      <div style={{ marginBottom:'14px' }}>
        <h2 style={{ fontSize:'18px', fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em' }}>Fee Statement</h2>
        <p style={{ fontSize:'12.5px', color:'#64748b', marginTop:'2px', fontWeight:600 }}>
          {ledger.student_name} · Academic year overview
        </p>
      </div>

      {/* Summary hero */}
      <div style={{
        background: hasBalance
          ? 'linear-gradient(135deg,#dc2626,#ef4444)'
          : 'linear-gradient(135deg,#0d7377,#14a085)',
        borderRadius:'18px', padding:'18px 20px', marginBottom:'12px',
        color:'white', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', right:-20, top:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:'11px', fontWeight:700, opacity:0.8, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'6px' }}>
            {hasBalance ? 'Outstanding Balance' : 'All Fees Cleared'}
          </div>
          <div style={{ fontSize:'32px', fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 }}>
            {fmt(totalBalance)}
          </div>
          <div style={{ display:'flex', gap:'16px', marginTop:'12px' }}>
            <div>
              <div style={{ fontSize:'10px', opacity:0.7, fontWeight:700 }}>TOTAL BILLED</div>
              <div style={{ fontSize:'14px', fontWeight:800 }}>{fmt(totalDue)}</div>
            </div>
            <div style={{ width:'1px', background:'rgba(255,255,255,0.3)' }} />
            <div>
              <div style={{ fontSize:'10px', opacity:0.7, fontWeight:700 }}>PAID SO FAR</div>
              <div style={{ fontSize:'14px', fontWeight:800 }}>{fmt(totalPaid)}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop:'12px', height:'6px', background:'rgba(255,255,255,0.3)', borderRadius:'3px', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:'3px', width:`${collPct}%`, background:'white', transition:'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize:'10.5px', opacity:0.8, marginTop:'4px', fontWeight:700 }}>
            {collPct.toFixed(0)}% collected
          </div>
        </div>
      </div>

      {/* Fee breakdown */}
      {verifyingOrderId && (
        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1d4ed8', borderRadius:'14px', padding:'12px 14px', marginBottom:'12px', fontSize:'13px', fontWeight:800 }}>
          Verifying payment status. Do not pay again until this finishes.
        </div>
      )}

      <div style={{ background:'white', borderRadius:'16px', padding:'14px 16px', marginBottom:'12px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize:'10.5px', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'2px' }}>
          Fee Breakdown · {(ledger.items || []).length} items
        </div>
        {(ledger.items || []).length === 0 ? (
          <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:'13px' }}>No fees assigned yet</div>
        ) : (
          (ledger.items || []).map((item, i) => (
            <FeeItem
              key={i}
              item={item}
              canPay={canPayOnline}
              payingId={payingId}
              onPay={handlePayNow}
            />
          ))
        )}
      </div>

      {paymentHistory.length > 0 && (
        <div style={{ background:'white', borderRadius:'16px', padding:'14px 16px', marginBottom:'12px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize:'10.5px', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>
            Payment History
          </div>
          {paymentHistory.slice(0, 5).map(order => (
            <div key={order.id} style={{ display:'flex', justifyContent:'space-between', gap:'10px', padding:'9px 0', borderTop:'1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:800, color:'#0f172a' }}>{fmt(order.amount)}</div>
                <div style={{ fontSize:'11.5px', color:'#64748b' }}>{order.receipt_number || order.razorpay_order_id}</div>
              </div>
              <span style={{
                alignSelf:'center',
                fontSize:'11px',
                fontWeight:900,
                borderRadius:'999px',
                padding:'4px 9px',
                color: order.status === 'paid' ? '#15803d' : order.status === 'failed' ? '#b91c1c' : '#92400e',
                background: order.status === 'paid' ? '#dcfce7' : order.status === 'failed' ? '#fee2e2' : '#fef3c7',
              }}>
                {order.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasBalance && !canPayOnline && (
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'13px 15px', display:'flex', alignItems:'flex-start', gap:'10px' }}>
          <svg width="18" height="18" fill="none" stroke="#64748b" viewBox="0 0 24 24" style={{flexShrink:0}} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          <div>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#334155' }}>Online payment is unavailable for this account right now</div>
            <div style={{ fontSize:'12px', color:'#64748b', marginTop:'3px', lineHeight:1.5 }}>
              Select a linked student, then pay outstanding fee items by UPI, card or net banking from this screen.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
