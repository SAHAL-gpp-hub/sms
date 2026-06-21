// PaymentOptions.jsx — Shared month-based payment option cards.
//
// Used by BOTH the admin fee collection page (StudentFees.jsx) and the parents
// portal fee payment page (PortalFees.jsx).  Identical logic and layout for
// both; only the action button label differs ("Collect" vs "Pay Now") and the
// amount formatting function (admin uses formatINR, portal uses its checkout
// formatter so platform charges line up).
//
// Layout contract (matches the product spec):
//   ┌──────────────────────────────────────────────┐
//   │  Pay for 9 Months                 ₹1,012.50  │  ← primary, full-width,
//   │  Clears all dues                              │     blue filled (clears all)
//   └──────────────────────────────────────────────┘
//   ┌──────────────────────┐  ┌────────────────────┐
//   │  Pay for 6 Months    │  │  Pay for 3 Months  │  ← secondary, outlined
//   │  6 month coverage    │  │  3 month coverage  │     2-column grid
//   │  ₹675                │  │  ₹337.50           │
//   └──────────────────────┘  └────────────────────┘
//                       [ Collect / Pay Now ]
//
// `options` comes from GET /fees/payment-options/{student_id} -> summary.options,
// ordered largest-first with the "clears all" primary at options[0].
import { formatINR } from '../../services/api'

export function PaymentOptions({
  options = [],
  selected,
  onSelect,
  actionLabel = 'Collect',
  onAction,
  disabled = false,
  formatAmount = formatINR,
}) {
  if (!options.length) return null

  // options[0] is always the "clears all" primary (largest month count).
  const primaryOpt = options[0]
  const secondaryOpts = options.slice(1)

  const isSelected = (opt) => selected?.months === opt.months

  const cardBase = {
    borderRadius: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
    opacity: disabled ? 0.6 : 1,
    width: '100%',
    border: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Primary card — full width, blue filled, "clears all dues" */}
      <button
        type="button"
        onClick={() => !disabled && onSelect(primaryOpt)}
        style={{
          ...cardBase,
          padding: '16px 20px',
          background: isSelected(primaryOpt) ? 'var(--brand-700)' : 'var(--brand-600)',
          boxShadow: isSelected(primaryOpt)
            ? '0 0 0 3px var(--brand-200), 0 2px 8px rgba(37,99,235,0.30)'
            : '0 2px 8px rgba(37,99,235,0.22)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
            {primaryOpt.label}
          </div>
          <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.78)', marginTop: '3px' }}>
            {primaryOpt.sublabel}
          </div>
        </div>
        <div style={{ fontWeight: 900, fontSize: '18px', color: 'white', flexShrink: 0 }}>
          {formatAmount(primaryOpt.amount)}
        </div>
      </button>

      {/* Secondary cards — outlined, 2-column grid (6-month and 3-month only) */}
      {secondaryOpts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {secondaryOpts.map(opt => (
            <button
              key={opt.months}
              type="button"
              onClick={() => !disabled && onSelect(opt)}
              style={{
                ...cardBase,
                padding: '12px 14px',
                background: isSelected(opt) ? 'var(--brand-50)' : 'var(--surface-0, #fff)',
                border: `1.5px solid ${isSelected(opt) ? 'var(--brand-500)' : 'var(--brand-300)'}`,
                boxShadow: isSelected(opt) ? '0 0 0 3px var(--brand-100)' : 'none',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-700)' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                {opt.sublabel}
              </div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', marginTop: '6px' }}>
                {formatAmount(opt.amount)}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Action button — only rendered once an option is selected */}
      {selected && (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          style={{
            marginTop: '2px',
            padding: '13px 20px',
            borderRadius: '10px',
            border: 'none',
            background: disabled ? 'var(--gray-400)' : 'var(--gray-900)',
            color: 'white',
            fontWeight: 800,
            fontSize: '14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'background 0.15s',
          }}
        >
          {actionLabel} · {formatAmount(selected.amount)}
        </button>
      )}
    </div>
  )
}
