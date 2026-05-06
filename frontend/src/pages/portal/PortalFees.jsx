// frontend/src/pages/portal/PortalFees.jsx
import { useState, useEffect } from 'react'
import { usePortalContext } from '../../layouts/PortalLayout'
import { portalAPI } from '../../services/api'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', minimumFractionDigits:0 }).format(Number(n) || 0)

function FeeItem({ item }) {
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
            <span style={{ fontSize:'12px', fontWeight:800, padding:'3px 10px', borderRadius:'20px', background:'#dcfce7', color:'#15803d' }} style={{ display:"inline-flex", alignItems:"center", gap:"3px" }}><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg> Cleared</span>
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
    </div>
  )
}

export default function PortalFees() {
  const { role, selectedChildId } = usePortalContext()
  const isParent = role === 'parent'

  const [ledger,  setLedger]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
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
      <div style={{ background:'white', borderRadius:'16px', padding:'14px 16px', marginBottom:'12px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize:'10.5px', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'2px' }}>
          Fee Breakdown · {(ledger.items || []).length} items
        </div>
        {(ledger.items || []).length === 0 ? (
          <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:'13px' }}>No fees assigned yet</div>
        ) : (
          (ledger.items || []).map((item, i) => <FeeItem key={i} item={item} />)
        )}
      </div>

      {/* Online payment placeholder */}
      {hasBalance && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'14px', padding:'13px 15px', display:'flex', alignItems:'flex-start', gap:'10px' }}>
          <svg width="18" height="18" fill="none" stroke="#b45309" viewBox="0 0 24 24" style={{flexShrink:0}} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          <div>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e' }}>Online Payment — Coming Soon</div>
            <div style={{ fontSize:'12px', color:'#b45309', marginTop:'3px', lineHeight:1.5 }}>
              Pay via UPI, card or net banking. Available in the next update. Visit the school office for now.
            </div>
          </div>
        </div>
      )}
    </>
  )
}