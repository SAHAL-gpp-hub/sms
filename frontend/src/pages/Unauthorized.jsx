// frontend/src/pages/Unauthorized.jsx
import { useNavigate } from 'react-router-dom'
import { getRole } from '../services/auth'

export default function Unauthorized() {
  const navigate = useNavigate()
  const role = getRole()

  const homeFor = {
    teacher: '/marks',
    student: '/portal',
    parent:  '/portal',
  }
  const home = homeFor[role] || '/'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface-1)',
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        {/* Big lock icon */}
        <div style={{
          width: '80px', height: '80px',
          borderRadius: '20px',
          background: 'var(--danger-50)',
          border: '1px solid var(--danger-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="36" height="36" fill="none" stroke="var(--danger-500)" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth={1.8} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        <h1 style={{
          fontSize: '24px', fontWeight: 800,
          color: 'var(--text-primary)', letterSpacing: '-0.03em',
          marginBottom: '10px',
        }}>
          Access Denied
        </h1>
        <p style={{
          fontSize: '14px', color: 'var(--text-secondary)',
          lineHeight: 1.6, marginBottom: '28px',
        }}>
          You don't have permission to view this page.
          {role && (
            <> Your current role is <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{role}</strong>, which doesn't include access to this section.</>
          )}
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            ← Go Back
          </button>
          <button
            onClick={() => navigate(home)}
            className="btn btn-primary"
          >
            Go to Dashboard
          </button>
        </div>

        <div style={{
          marginTop: '32px', padding: '12px 16px',
          background: 'var(--gray-100)', borderRadius: '10px',
          fontSize: '12px', color: 'var(--text-tertiary)',
        }}>
          If you believe this is a mistake, contact your school administrator.
        </div>
      </div>
    </div>
  )
}