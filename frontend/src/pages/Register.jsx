import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authAPI, extractError } from '../services/api'

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ loading: true, enabled: false, has_users: false })

  useEffect(() => {
    authAPI.registerStatus()
      .then(r => setStatus({ loading: false, ...r.data }))
      .catch(() => setStatus({ loading: false, enabled: false, has_users: true }))
  }, [])

  const setField = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error('All fields are required')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await authAPI.register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: 'admin',
      })
      toast.success('Admin account created. You can sign in now.')
      navigate('/login')
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
      padding: '24px',
      background: 'linear-gradient(135deg, #fff7ed 0%, #f8fafc 100%)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '460px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--brand-600)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            First-Run Setup
          </div>
          <h1 style={{ margin: '8px 0 4px', fontSize: '28px', lineHeight: 1.1, color: 'var(--text-primary)' }}>
            Create the first admin
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            This screen works only while backend registration is temporarily enabled.
          </p>
        </div>

        {status.loading ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Checking registration status...</div>
        ) : !status.enabled ? (
          <div style={{
            padding: '14px 16px',
            borderRadius: '10px',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
            fontSize: '13px',
            lineHeight: 1.6,
          }}>
            Registration is disabled on the backend. Set `REGISTRATION_ENABLED=true` in `.env`, create the admin account, then turn it off again.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={setField('name')} placeholder="School administrator" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={setField('email')} placeholder="admin@school.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password} onChange={setField('password')} placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" className="input" value={form.confirmPassword} onChange={setField('confirmPassword')} placeholder="Repeat password" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Admin Account'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <Link to="/login" style={{ color: 'var(--brand-600)', fontWeight: 700, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
