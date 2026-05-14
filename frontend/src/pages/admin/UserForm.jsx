// frontend/src/pages/admin/UserForm.jsx
// Create / Edit user — admin only
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminAPI, extractError } from '../../services/api'
import { PageHeader, Field } from '../../components/UI'

const ROLES = [
  { value: 'admin',   label: 'Admin',   color: '#dc2626', desc: 'Full access to everything' },
  { value: 'teacher', label: 'Teacher', color: '#2563eb', desc: 'Marks, attendance for assigned classes' },
  { value: 'student', label: 'Student', color: '#16a34a', desc: 'Read-only portal: own data only' },
  { value: 'parent',  label: 'Parent',  color: '#ea580c', desc: 'Read-only portal: linked child data' },
]

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  confirm_password: '',
  role: 'teacher',
  is_active: true,
}

export default function UserForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm]           = useState(EMPTY_FORM)
  const [errors, setErrors]       = useState({})
  const [loading, setLoading]     = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    adminAPI.getUser(id)
      .then(r => {
        const u = r.data
        setForm({
          name: u.name || '',
          email: u.email || '',
          password: '',
          confirm_password: '',
          role: u.role || 'teacher',
          is_active: u.is_active ?? true,
        })
        setInitialLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load user')
        setInitialLoading(false)
      })
  }, [id, isEdit])

  const setField = field => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [field]: val }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address'
    if (!isEdit && !form.password) e.password = 'Password is required'
    if (!isEdit && form.password && form.password.length < 8) e.password = 'Minimum 8 characters'
    if (!isEdit && form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
    if (isEdit && form.password && form.password.length < 8) e.password = 'Minimum 8 characters'
    if (isEdit && form.password && form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { toast.error('Please fix the errors below'); return }
    setLoading(true)
    try {
      if (isEdit) {
        const payload = { name: form.name, email: form.email, role: form.role, is_active: form.is_active }
        await adminAPI.updateUser(id, payload)
        if (form.password) {
          await adminAPI.resetPassword(id, form.password)
        }
        toast.success('User updated')
      } else {
        await adminAPI.createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          is_active: form.is_active,
        })
        toast.success(`${ROLES.find(r => r.value === form.role)?.label} account created`)
      }
      navigate('/admin/users')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = ROLES.find(r => r.value === form.role)

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
        <span className="spinner" /> Loading...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <PageHeader
        title={isEdit ? 'Edit User' : 'Create User'}
        subtitle={isEdit ? 'Update account details or reset password' : 'Add an admin, teacher, student, or parent account'}
        back={() => navigate('/admin/users')}
      />

      {/* Role selector */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--gray-50)' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Role</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Determines what the user can access</div>
        </div>
        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
          {ROLES.map(role => (
            <button
              key={role.value}
              type="button"
              onClick={() => { setForm(f => ({ ...f, role: role.value })); setErrors(p => ({ ...p, role: undefined })) }}
              style={{
                padding: '12px 10px',
                borderRadius: '10px',
                border: `2px solid ${form.role === role.value ? role.color : 'var(--border-default)'}`,
                background: form.role === role.value ? role.color + '12' : 'var(--surface-0)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-sans)',
                touchAction: 'manipulation',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: form.role === role.value ? role.color : 'var(--text-primary)', marginBottom: '3px' }}>
                {role.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                {role.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Account details */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--gray-50)' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Account Details</div>
        </div>
        <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Field label="Full Name" required error={errors.name}>
            <input
              className={`input${errors.name ? ' error' : ''}`}
              value={form.name}
              onChange={setField('name')}
              placeholder="e.g. Fatima Sheikh"
              autoFocus
            />
          </Field>
          <Field label="Email Address" required error={errors.email}>
            <input
              type="email"
              className={`input${errors.email ? ' error' : ''}`}
              value={form.email}
              onChange={setField('email')}
              placeholder="fatima@iqraschool.in"
              inputMode="email"
            />
          </Field>
          <Field
            label={isEdit ? 'New Password' : 'Password'}
            required={!isEdit}
            error={errors.password}
            hint={isEdit ? 'Leave blank to keep current password' : 'Minimum 8 characters'}
          >
            <input
              type="password"
              className={`input${errors.password ? ' error' : ''}`}
              value={form.password}
              onChange={setField('password')}
              placeholder={isEdit ? '(unchanged)' : 'Min 8 characters'}
              autoComplete="new-password"
            />
          </Field>
          <Field
            label="Confirm Password"
            required={!isEdit && Boolean(form.password)}
            error={errors.confirm_password}
          >
            <input
              type="password"
              className={`input${errors.confirm_password ? ' error' : ''}`}
              value={form.confirm_password}
              onChange={setField('confirm_password')}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </Field>

          {/* Active toggle */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <div
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                style={{
                  width: '44px', height: '24px',
                  borderRadius: '12px',
                  background: form.is_active ? 'var(--brand-600)' : 'var(--gray-300)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: '18px', height: '18px',
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: '3px',
                  left: form.is_active ? '23px' : '3px',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Account {form.is_active ? 'Active' : 'Inactive'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  {form.is_active ? 'User can log in' : 'Login blocked — user cannot access the system'}
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Role info banner */}
      {selectedRole && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: selectedRole.color + '0d',
          border: `1px solid ${selectedRole.color}30`,
          marginBottom: '14px',
          fontSize: '13px',
          color: selectedRole.color,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
          </svg>
          {form.role === 'teacher' && 'After creating, assign this teacher to classes from the Assignments tab.'}
          {form.role === 'student' && 'After creating, link this account to a student record from User Management.'}
          {form.role === 'parent' && 'After creating, link this account to a student record from User Management.'}
          {form.role === 'admin' && 'Admin accounts have full access to all data and settings.'}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', paddingBottom: '32px', flexWrap: 'wrap' }}>
        <button onClick={handleSubmit} disabled={loading} className="btn btn-primary btn-lg" style={{ flex: 1, minWidth: '160px' }}>
          {loading
            ? <><span className="spinner" style={{ width: '15px', height: '15px' }} /> Saving…</>
            : isEdit ? 'Save Changes' : `Create ${selectedRole?.label} Account`
          }
        </button>
        <button onClick={() => navigate('/admin/users')} className="btn btn-secondary btn-lg" style={{ flex: '0 0 auto' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
