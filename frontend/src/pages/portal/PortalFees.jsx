// frontend/src/pages/portal/PortalFees.jsx
import { useState, useEffect } from 'react'
import { portalAPI } from '../../services/api'

const fmt = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(amount) || 0)

function FeeItem({ item }) {
  const balance = parseFloat(item.balance || 0)
  const paid    = parseFloat(item.paid_amount || 0)
  const total   = parseFloat(item.net_amount || 0)
  const paidPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0
  const isPaid  = balance <= 0

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid #f0f7f7' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{item.fee_head_name}</div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>
            {item.frequency} · Billed: {fmt(total)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {isPaid ? (
            <span style={{ fontSize: '12px', fontWeight: 800, padding: '3px 10px', borderRadius: '20px', background: '#dcfce7', color: '#15803d' }}>
              ✓ Cleared
            </span>
          ) : (
            <div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#dc2626', letterSpacing: '-0.02em' }}>{fmt(balance)}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', textAlign: 'right' }}>due</div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1, height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '3px', transition: 'width 0.5s ease',
            width: `${paidPct}%`,
            background: isPaid ? '#16a34a' : '#0d7377',
          }} />
        </div>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: isPaid ? '#16a34a' : '#0d7377', whiteSpace: 'nowrap' }}>
          {fmt(paid)} paid
        </span>
      </div>
    </div>
  )
}

export default function PortalFees() {
  const [ledger,   setLedger]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  useEffect(() => {
    portalAPI.getFees()
      .then(r => { setLedger(r.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return (
    <div>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: '70px', borderRadius: '16px', background: 'linear-gradient(90deg, #f0f7f7 25%, #e0eded 50%, #f0f7f7 75%)', backgroundSize: '200% auto', animation: 'portalShimmer 1.5s linear infinite', marginBottom: '10px' }} />
      ))}
    </div>
  )

  if (error || !ledger) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
      <div style={{ fontWeight: 700 }}>Couldn't load fee data</div>
    </div>
  )

  const totalDue     = parseFloat(ledger.total_due     || 0)
  const totalPaid    = parseFloat(ledger.total_paid    || 0)
  const totalBalance = parseFloat(ledger.total_balance || 0)
  const collPct      = totalDue > 0 ? Math.min((totalPaid / totalDue) * 100, 100) : 0

  return (
    <>
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Fee Statement</h2>
        <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>Academic year overview</p>
      </div>

      {/* Summary card */}
      <div style={{
        background: totalBalance > 0
          ? 'linear-gradient(135deg, #dc2626, #ef4444)'
          : 'linear-gradient(135deg, #0d7377, #14a085)',
        borderRadius: '18px', padding: '18px 20px', marginBottom: '12px',
        color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
            {totalBalance > 0 ? 'Outstanding Balance' : 'All Fees Cleared'}
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {fmt(totalBalance)}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', opacity: 0.7, fontWeight: 700 }}>TOTAL BILLED</div>
              <div style={{ fontSize: '14px', fontWeight: 800 }}>{fmt(totalDue)}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.3)' }} />
            <div>
              <div style={{ fontSize: '10px', opacity: 0.7, fontWeight: 700 }}>PAID SO FAR</div>
              <div style={{ fontSize: '14px', fontWeight: 800 }}>{fmt(totalPaid)}</div>
            </div>
          </div>
          {/* Progress */}
          <div style={{ marginTop: '12px', height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '3px', width: `${collPct}%`, background: 'white', transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: '10.5px', opacity: 0.8, marginTop: '4px', fontWeight: 700 }}>{collPct.toFixed(0)}% collected</div>
        </div>
      </div>

      {/* Fee breakdown */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
          Fee Breakdown
        </div>
        {(ledger.items || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '13px' }}>
            No fees assigned yet
          </div>
        ) : (
          (ledger.items || []).map((item, i) => (
            <FeeItem key={i} item={item} />
          ))
        )}
      </div>

      {/* Online payment placeholder */}
      {totalBalance > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '14px', padding: '14px 16px',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>💡</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>Online Payment — Coming Soon</div>
            <div style={{ fontSize: '12px', color: '#b45309', marginTop: '3px', lineHeight: 1.5 }}>
              Pay fees online via UPI, card or net banking. Available in the next update. For now, please visit the school office.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
