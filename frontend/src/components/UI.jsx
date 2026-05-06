// components/UI.jsx — Fully responsive shared UI primitives
import { useState } from 'react'

// ── Skeleton Loader ───────────────────────────────────────────────────────
export function Skeleton({ width, height = '14px', borderRadius = '6px', style = {} }) {
  return (
    <span className="skeleton" style={{
      display: 'inline-block',
      width: width || '100%',
      height,
      borderRadius,
      ...style,
    }} />
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '12px 16px' }}>
              <Skeleton height="13px" width={j === 0 ? '80px' : j === cols - 1 ? '60px' : '100%'} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="14px" style={{ marginBottom: i < lines - 1 ? '10px' : 0, width: i === 0 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div style={{ marginTop: '12px' }}>{action}</div>}
    </div>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────────────
export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', confirmVariant = 'danger', onConfirm, onCancel, loading }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: '0',
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />
      <div style={{
        position: 'relative',
        background: 'var(--surface-0)',
        borderRadius: '16px 16px 0 0',
        padding: '24px 20px 28px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-default)',
        borderBottom: 'none',
      }} className="confirm-modal-inner">
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          {title}
        </h3>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={`btn btn-${confirmVariant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <><span className="spinner" style={{ width: '14px', height: '14px' }} /> Processing...</> : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @media (min-width: 640px) {
          .confirm-modal-inner {
            border-radius: 16px !important;
            border-bottom: 1px solid var(--border-default) !important;
          }
          [style*="align-items: flex-end"] {
            align-items: center !important;
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header" style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {back && (
          <button
            onClick={back}
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-0)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s',
              flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options, placeholder, required, style = {} }) {
  return (
    <div style={style}>
      {label && (
        <label className="label">
          {label} {required && <span style={{ color: 'var(--danger-500)' }}>*</span>}
        </label>
      )}
      <select className="input" value={value} onChange={onChange} style={{ cursor: 'pointer' }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Field ────────────────────────────────────────────────────────────────
export function Field({ label, required, error, hint, children }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label} {required && <span style={{ color: 'var(--danger-500)' }}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <div style={{ fontSize: '12px', color: 'var(--danger-600)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
          </svg>
          {error}
        </div>
      )}
      {hint && !error && (
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{hint}</div>
      )}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    'Active':      { cls: 'badge-success', dot: '#22c55e', label: 'Active' },
    'TC_Issued':   { cls: 'badge-warning', dot: '#f59e0b', label: 'TC Issued' },
    'TC Issued':   { cls: 'badge-warning', dot: '#f59e0b', label: 'TC Issued' },
    'Left':        { cls: 'badge-neutral', dot: '#94a3b8', label: 'Left' },
    'Passed_Out':  { cls: 'badge-info',    dot: '#3b82f6', label: 'Passed Out' },
    'Passed Out':  { cls: 'badge-info',    dot: '#3b82f6', label: 'Passed Out' },
    'Alumni':      { cls: 'badge-info',    dot: '#0ea5e9', label: 'Alumni' },
    'On_Hold':     { cls: 'badge-warning', dot: '#d97706', label: 'On Hold' },
    'Detained':    { cls: 'badge-danger',  dot: '#dc2626', label: 'Detained' },
    'Provisional': { cls: 'badge-neutral', dot: '#8b5cf6', label: 'Provisional' },
  }
  const s = map[status] || { cls: 'badge-neutral', dot: '#94a3b8', label: status }
  return (
    <span className={`badge ${s.cls}`}>
      <span style={{ width: '5px', height: '5px', background: s.dot, borderRadius: '50%', flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ── Loading Page ───────────────────────────────────────────────────────────
export function LoadingPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
      <span className="spinner" />
      Loading...
    </div>
  )
}

// ── Stats Grid ────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color = 'var(--brand-600)', icon, loading }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ color, wordBreak: 'break-word' }}>
            {loading ? <Skeleton height="28px" width="90px" /> : value}
          </div>
          {sub && <div className="stat-sub">{loading ? <Skeleton height="12px" width="70px" style={{ marginTop: '4px' }} /> : sub}</div>}
        </div>
        {icon && (
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: color + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab Bar ───────────────────────────────────────────────────────────────
export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
      <div style={{
        display: 'flex',
        gap: '2px',
        background: 'var(--gray-100)',
        padding: '3px',
        borderRadius: '10px',
        width: 'fit-content',
        minWidth: 'max-content',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            style={{
              padding: '7px 14px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: active === tab.value ? 700 : 500,
              color: active === tab.value ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: active === tab.value ? 'var(--surface-0)' : 'transparent',
              boxShadow: active === tab.value ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s',
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              touchAction: 'manipulation',
              minHeight: '36px',
            }}
          >
            {tab.icon && <span style={{ fontSize: '14px' }}>{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: active === tab.value ? 'var(--brand-100)' : 'var(--gray-200)',
                color: active === tab.value ? 'var(--brand-700)' : 'var(--text-tertiary)',
                padding: '1px 6px',
                borderRadius: '20px',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Filter Row ────────────────────────────────────────────────────────────
export function FilterRow({ children }) {
  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {children}
      </div>
    </div>
  )
}

// ── Search Input ──────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...', style = {} }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <svg
        width="15" height="15" fill="none" stroke="var(--text-tertiary)" viewBox="0 0 24 24"
        style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        className="input"
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: '34px' }}
      />
    </div>
  )
}

// ── Inline Banner ─────────────────────────────────────────────────────────
export function InlineBanner({ type = 'info', title, message, onDismiss }) {
  const styles = {
    info:    { bg: 'var(--brand-50)',   border: 'var(--brand-200)',  color: 'var(--brand-700)',   icon: 'ℹ️' },
    warning: { bg: 'var(--warning-50)', border: '#fde68a',           color: '#92400e',            icon: '⚠️' },
    success: { bg: 'var(--success-50)', border: '#bbf7d0',           color: 'var(--success-700)', icon: '✓' },
    danger:  { bg: 'var(--danger-50)',  border: 'var(--danger-100)', color: 'var(--danger-700)',  icon: '⚠' },
  }
  const s = styles[type]
  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: '10px',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      marginBottom: '14px',
    }}>
      <span style={{ fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>{s.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: '13px', fontWeight: 700, color: s.color, marginBottom: '2px' }}>{title}</div>}
        <div style={{ fontSize: '12.5px', color: s.color, lineHeight: 1.5 }}>{message}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.color, opacity: 0.6, padding: '0', lineHeight: 1, fontSize: '18px', flexShrink: 0 }}>×</button>
      )}
    </div>
  )
}
