import { useEffect, useState } from 'react'

export const SESSION_EXPIRED_EVENT = 'sms:session-expired'

export default function SessionExpiredModal() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('Your session expired. Log in again to continue.')

  useEffect(() => {
    const onExpired = (event) => {
      setMessage(event.detail?.message || 'Your session expired. Log in again to continue.')
      setOpen(true)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  if (!open) return null

  const returnToLogin = () => {
    const next = window.location.pathname + window.location.search
    window.location.href = `/login?next=${encodeURIComponent(next)}`
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(15, 23, 42, 0.52)',
      }}
    >
      <section style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--surface-0, #fff)',
        borderRadius: '14px',
        border: '1px solid var(--border-default, #e2e8f0)',
        padding: '22px',
        boxShadow: 'var(--shadow-xl, 0 25px 60px rgba(15, 23, 42, 0.2))',
      }}>
        <h2 id="session-expired-title" style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary, #0f172a)' }}>
          Session expired
        </h2>
        <p style={{ margin: '8px 0 18px', color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
          {message}
        </p>
        <button className="btn btn-primary" type="button" onClick={returnToLogin} style={{ width: '100%' }}>
          Log in again
        </button>
      </section>
    </div>
  )
}
