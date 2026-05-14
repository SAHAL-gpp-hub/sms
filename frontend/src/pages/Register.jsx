import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authAPI, extractError } from '../services/api'

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  schoolName: '',
  schoolPhone: '',
  schoolAddress: '',
  yearLabel: '2026-27',
  yearStart: '2026-06-01',
  yearEnd: '2027-05-31',
  standards: '1,2,3,4,5,6,7,8,9,10',
  divisions: 'A',
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
        school_name: form.schoolName,
        school_phone: form.schoolPhone || null,
        school_address: form.schoolAddress || null,
        academic_year_label: form.yearLabel,
        academic_year_start_date: form.yearStart,
        academic_year_end_date: form.yearEnd,
        standards: form.standards.split(',').map(s => s.trim()).filter(Boolean),
        divisions: form.divisions.split(',').map(s => s.trim()).filter(Boolean),
      })
      toast.success('School setup created. You can sign in now.')
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
      <div className="card" style={{ width: '100%', maxWidth: '780px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--brand-600)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            First-Run Setup
          </div>
          <h1 style={{ margin: '8px 0 4px', fontSize: '28px', lineHeight: 1.1, color: 'var(--text-primary)' }}>
            Set up your school
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Create the school profile, first academic year, initial classes, and administrator account in one pass.
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
            First-run setup is currently closed. Ask the deployment owner to enable initial setup for this installation.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '18px' }}>
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div>
                <label className="label">School Name</label>
                <input className="input" value={form.schoolName} onChange={setField('schoolName')} placeholder="Iqra English Medium School" />
              </div>
              <div>
                <label className="label">School Phone</label>
                <input className="input" value={form.schoolPhone} onChange={setField('schoolPhone')} placeholder="9876543210" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label">School Address</label>
                <input className="input" value={form.schoolAddress} onChange={setField('schoolAddress')} placeholder="Campus address" />
              </div>
            </div>
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div>
                <label className="label">Academic Year</label>
                <input className="input" value={form.yearLabel} onChange={setField('yearLabel')} placeholder="2026-27" />
              </div>
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" value={form.yearStart} onChange={setField('yearStart')} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" className="input" value={form.yearEnd} onChange={setField('yearEnd')} />
              </div>
              <div>
                <label className="label">Standards</label>
                <input className="input" value={form.standards} onChange={setField('standards')} placeholder="1,2,3,4,5" />
              </div>
              <div>
                <label className="label">Divisions</label>
                <input className="input" value={form.divisions} onChange={setField('divisions')} placeholder="A,B" />
              </div>
            </div>
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Creating setup...' : 'Create School Setup'}
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
