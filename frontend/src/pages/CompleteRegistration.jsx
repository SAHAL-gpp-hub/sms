import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authAPI, extractError } from '../services/api'
import { normalizeAuthUser, setAuthUser, setToken } from '../services/auth'

export default function CompleteRegistration() {
  const navigate = useNavigate()
  const location = useLocation()
  const registrationToken = useMemo(
    () => new URLSearchParams(location.search).get('token') || '',
    [location.search]
  )
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const complete = async e => {
    e.preventDefault()
    if (!registrationToken) {
      toast.error('Registration link is missing')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await authAPI.completeStaffRegistration(registrationToken, password)
      setToken(res.data.access_token)
      setAuthUser(normalizeAuthUser(res.data))
      toast.success('Teacher account is ready')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
      background: 'linear-gradient(135deg, #f8fafc 0%, #eef7f5 48%, #fff7ed 100%)',
    }}>
      <div className="card" style={{ width: 'min(100%, 460px)', padding: 26 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--brand-700)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
          Teacher Registration
        </div>
        <h1 style={{ margin: 0, fontSize: 30, color: 'var(--text-primary)', lineHeight: 1.08 }}>
          Complete your account
        </h1>
        <p style={{ margin: '10px 0 22px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          Create a password for your teacher login. After this, you can use the regular login page.
        </p>

        {!registrationToken ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--danger-50)', color: 'var(--danger-700)', fontSize: 13, fontWeight: 700 }}>
              This registration link is missing a token. Ask the school admin to send a new invite.
            </div>
            <Link className="btn btn-secondary" to="/login" style={{ justifyContent: 'center', textDecoration: 'none' }}>Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={complete} style={{ display: 'grid', gap: 14 }}>
            <label className="label">
              Password
              <input
                className="input"
                type="password"
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="label">
              Confirm password
              <input
                className="input"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <button className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Activating...</> : 'Complete Registration'}
            </button>
            <Link className="btn btn-ghost" to="/login" style={{ justifyContent: 'center', textDecoration: 'none' }}>Back to Login</Link>
          </form>
        )}
      </div>
    </div>
  )
}
