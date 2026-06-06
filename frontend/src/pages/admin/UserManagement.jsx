// frontend/src/pages/admin/UserManagement.jsx — Full rebuild
// Tabs: Users list | Teacher Assignments | Portal Linking
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminAPI, setupAPI, studentAPI, extractError, marksAPI } from '../../services/api'
import {
  PageHeader, TabBar, EmptyState, TableSkeleton,
  ConfirmModal, SearchInput, Select, FilterRow, Field, ResponsiveTable,
} from '../../components/UI'
import { useAcademicYear } from '../../contexts/academicYearContext'

// ── Role colours ───────────────────────────────────────────────────────────────
const ROLE_META = {
  admin:   { color: '#dc2626', bg: '#fff1f2', border: '#fecdd3', label: 'Admin' },
  teacher: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Teacher' },
  student: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Student' },
  parent:  { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'Parent' },
}

function RoleBadge({ role }) {
  const m = ROLE_META[role] || { color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', label: role }
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

// ── Reusable Pagination ────────────────────────────────────────────────────────
const PAGE_SIZE_DEFAULT = 20

function usePagination(items, pageSize = PAGE_SIZE_DEFAULT) {
  const [page, setPage] = useState(1)

  // Reset to page 1 whenever the source list changes (filter/search applied)
  const itemsKey = items.length
  useEffect(() => { setPage(1) }, [itemsKey])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  )

  return { page: safePage, setPage, pageItems, totalPages, total: items.length }
}

function Pagination({ page, totalPages, total, pageSize, setPage }) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  // Build page numbers: always show first, last, current ±1, with ellipsis
  const range = []
  const add = (n) => { if (!range.includes(n) && n >= 1 && n <= totalPages) range.push(n) }
  add(1); add(totalPages)
  for (let i = page - 1; i <= page + 1; i++) add(i)
  range.sort((a, b) => a - b)

  const pages = []
  for (let i = 0; i < range.length; i++) {
    if (i > 0 && range[i] - range[i - 1] > 1) pages.push('…')
    pages.push(range[i])
  }

  const btnBase = {
    minWidth: '30px', height: '30px', padding: '0 6px',
    borderRadius: '6px', fontSize: '12px', fontWeight: 700,
    cursor: 'pointer', border: '1px solid var(--border-default)',
    fontFamily: 'var(--font-sans)', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', transition: 'all .12s',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: '8px',
      padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
      fontSize: '12px', color: 'var(--text-tertiary)',
    }}>
      <span>Showing {from}–{to} of {total}</span>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          style={{ ...btnBase, background: page === 1 ? 'var(--gray-50)' : 'var(--surface-0)', color: page === 1 ? 'var(--gray-300)' : 'var(--text-secondary)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          aria-label="Previous page"
        >‹</button>

        {pages.map((p, i) =>
          p === '…'
            ? <span key={`ellipsis-${i}`} style={{ padding: '0 2px', color: 'var(--text-tertiary)' }}>…</span>
            : <button
                key={p}
                style={{
                  ...btnBase,
                  background: p === page ? 'var(--brand-600)' : 'var(--surface-0)',
                  color: p === page ? 'white' : 'var(--text-secondary)',
                  border: p === page ? '1px solid var(--brand-600)' : '1px solid var(--border-default)',
                }}
                onClick={() => setPage(p)}
                aria-current={p === page ? 'page' : undefined}
              >{p}</button>
        )}

        <button
          style={{ ...btnBase, background: page === totalPages ? 'var(--gray-50)' : 'var(--surface-0)', color: page === totalPages ? 'var(--gray-300)' : 'var(--text-secondary)', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
          aria-label="Next page"
        >›</button>
      </div>
    </div>
  )
}

// ── Password Reset Modal ──────────────────────────────────────────────────────
function PasswordResetModal({ user, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)

  const handleReset = async () => {
    if (!password || password.length < 8) { toast.error('Minimum 8 characters'); return }
    if (password !== confirm)             { toast.error('Passwords do not match'); return }
    setSaving(true)
    try {
      await adminAPI.resetPassword(user.id, password)
      toast.success(`Password reset for ${user.name}`)
      onSuccess()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--surface-0)', borderRadius: '16px 16px 0 0', padding: '24px 20px 28px', width: '100%', maxWidth: '440px', border: '1px solid var(--border-default)', borderBottom: 'none', boxShadow: 'var(--shadow-xl)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Reset Password</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Set a new password for <strong>{user.name}</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          <Field label="New Password" hint="Minimum 8 characters">
            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" autoFocus autoComplete="new-password" />
          </Field>
          <Field label="Confirm Password">
            <input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleReset} disabled={saving}>
            {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Resetting…</> : 'Reset Password'}
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
      <style>{`@media (min-width: 640px) { .pw-modal { border-radius: 16px !important; border-bottom: 1px solid var(--border-default) !important; } }`}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 1 — Users List
// ════════════════════════════════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [resetTarget, setResetTarget] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await adminAPI.listUsers()
      setUsers(res.data || [])
    } catch (err) {
      const message = extractError(err)
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const normalizedSearch = search.trim().toLowerCase()
  const filtered = normalizedSearch
    ? users.filter(user =>
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)
      )
    : users
  const visibleUsers = roleFilter ? filtered.filter(user => user.role === roleFilter) : filtered

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      await adminAPI.deleteUser(deactivateTarget.id)
      toast.success(`${deactivateTarget.name} deactivated`)
      setDeactivateTarget(null)
      fetchUsers()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setDeactivating(false)
    }
  }

  const counts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {})

  const roleFilters = [
    { value: '', label: 'All roles', count: users.length },
    ...Object.entries(ROLE_META).map(([value, meta]) => ({ value, label: meta.label, count: counts[value] || 0 })),
  ]

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('')
  }

  return (
    <div>
      {!loading && users.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {Object.entries(ROLE_META).map(([role, meta]) => (
            counts[role] ? (
              <div key={role} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '20px',
                background: meta.bg, border: `1px solid ${meta.border}`,
                fontSize: '12px', fontWeight: 700, color: meta.color,
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color }} />
                {counts[role]} {meta.label}{counts[role] !== 1 ? 's' : ''}
              </div>
            ) : null
          ))}
        </div>
      )}

      <FilterRow>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" style={{ flex: 1, minWidth: '180px' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {roleFilters.map(role => {
            const active = roleFilter === role.value
            const roleMeta = role.value ? ROLE_META[role.value] : null
            return (
              <button
                key={role.value || 'all'}
                type="button"
                onClick={() => setRoleFilter(role.value)}
                aria-pressed={active}
                disabled={loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 12px',
                  borderRadius: '999px',
                  border: `1px solid ${active ? (roleMeta ? roleMeta.border : 'var(--brand-200)') : 'var(--border-default)'}`,
                  background: active ? (roleMeta ? roleMeta.bg : 'var(--brand-50)') : 'var(--surface-0)',
                  color: active ? (roleMeta ? roleMeta.color : 'var(--brand-700)') : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-sans)',
                  boxShadow: active ? 'var(--shadow-xs)' : 'none',
                }}
              >
                {role.label}
                <span style={{
                  minWidth: '22px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: active ? 'rgba(255,255,255,0.72)' : 'var(--gray-100)',
                  color: active ? 'inherit' : 'var(--text-tertiary)',
                  textAlign: 'center',
                  fontSize: '11px',
                  lineHeight: 1.4,
                }}>{role.count}</span>
              </button>
            )
          })}
        </div>
        {(search || roleFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
        )}
        <Link to="/admin/users/new" className="btn btn-primary" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </Link>
      </FilterRow>

      <div className="card">
        {loadError && users.length === 0 ? (
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16a2 2 0 001.73 3z" /></svg>}
            title="Could not load users"
            description={loadError}
            action={<button className="btn btn-secondary btn-sm" onClick={fetchUsers}>Try again</button>}
          />
        ) : loading ? (
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <TableSkeleton rows={6} cols={5} />
          </ResponsiveTable>
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            title={search || roleFilter ? 'No users match the current filters' : 'No users found'}
            description={search || roleFilter ? 'Clear the search or role filter to see the full list.' : 'Create the first user account above.'}
            action={search || roleFilter ? <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button> : <Link to="/admin/users/new" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>Add User</Link>}
          />
        ) : (
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(user => (
                <tr key={user.id}>
                  <td data-label="Name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</td>
                  <td data-label="Email" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user.email}</td>
                  <td data-label="Role"><RoleBadge role={user.role} /></td>
                  <td data-label="Status">
                    <span style={{
                      display: 'inline-flex',
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                      background: user.is_active ? 'var(--success-100)' : 'var(--gray-100)',
                      color: user.is_active ? 'var(--success-700)' : user.role === 'teacher' ? 'var(--warning-700)' : 'var(--gray-500)',
                    }}>
                      {user.is_active ? 'Active' : user.role === 'teacher' ? 'Pending invite' : 'Inactive'}
                    </span>
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Link
                        to={`/admin/users/${user.id}/edit`}
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--brand-600)', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', textDecoration: 'none', cursor: 'pointer' }}
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setResetTarget(user)}
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--warning-600)', background: 'var(--warning-50)', border: '1px solid #fde68a', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                      >
                        Reset PW
                      </button>
                      {!user.is_active && user.role === 'teacher' ? (
                        <button
                          onClick={async () => {
                            try {
                              await adminAPI.resendTeacherInvite(user.id)
                              toast.success(`Invite resent to ${user.name}`)
                            } catch (err) {
                              toast.error(extractError(err))
                            }
                          }}
                          style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--brand-700)', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        >
                          Resend Invite
                        </button>
                      ) : user.is_active ? (
                        <button
                          onClick={() => setDeactivateTarget(user)}
                          style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        )}
        {!loading && visibleUsers.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Showing {visibleUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <PasswordResetModal user={resetTarget} onClose={() => setResetTarget(null)} onSuccess={() => { setResetTarget(null); fetchUsers() }} />
      <ConfirmModal
        open={!!deactivateTarget}
        title="Deactivate User"
        message={`Deactivate "${deactivateTarget?.name}"? They won't be able to log in. You can reactivate them later from the edit screen.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
        loading={deactivating}
      />
    </div>
  )
}

function CorrectionRequestsTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAPI.listCorrectionRequests({ status: 'pending' })
      setRows(res.data || [])
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resolve = async (row, status) => {
    const verb = status === 'approved' ? 'approve and apply' : 'reject'
    if (!window.confirm(`${verb} correction for ${row.student_name}?`)) return
    setBusy(`${row.id}-${status}`)
    try {
      await adminAPI.resolveCorrectionRequest(row.id, { status })
      toast.success(status === 'approved' ? 'Correction applied' : 'Correction rejected')
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Profile Correction Requests</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Parent and student requests waiting for admin review</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
      </div>
      {loading ? (
        <table className="data-table"><TableSkeleton rows={5} cols={6} /></table>
      ) : rows.length === 0 ? (
        <EmptyState title="No pending corrections" description="Parent and student profile requests will appear here." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Field</th>
                <th>Current</th>
                <th>Requested</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 700 }}>{row.student_name}</td>
                  <td>{row.field_name}</td>
                  <td style={{ color: 'var(--text-tertiary)' }}>{row.current_value || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{row.requested_value}</td>
                  <td>{row.reason || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-success btn-sm" disabled={busy === `${row.id}-approved`} onClick={() => resolve(row, 'approved')}>Approve</button>
                      <button className="btn btn-secondary btn-sm" disabled={busy === `${row.id}-rejected`} onClick={() => resolve(row, 'rejected')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 2 — Teacher Class Assignments
// ════════════════════════════════════════════════════════════════════════════════
function TeacherAssignmentsTab({ selectedTeacherId = '', onTeacherSelected }) {
  const { selectedYearId, years } = useAcademicYear()
  const [teachers, setTeachers]         = useState([])
  const [selectedTeacher, setSelectedTeacherState] = useState(selectedTeacherId ? String(selectedTeacherId) : '')
  const [assignments, setAssignments]   = useState([])
  const [classes, setClasses]           = useState([])
  const [subjects, setSubjects]         = useState([])
  const [loading, setLoading]           = useState(false)
  const [adding, setAdding]             = useState(false)
  const [removing, setRemoving]         = useState(null)
  const [form, setForm] = useState({ class_id: '', academic_year_id: '', subject_id: '' })

  const setSelectedTeacher = useCallback((teacherId) => {
    setSelectedTeacherState(teacherId)
    onTeacherSelected?.(teacherId)
  }, [onTeacherSelected])

  useEffect(() => {
    adminAPI.listUsers({ role: 'teacher' }).then(r => setTeachers(r.data || []))
  }, [])

  useEffect(() => {
    if (selectedTeacherId) setSelectedTeacherState(String(selectedTeacherId))
  }, [selectedTeacherId])

  useEffect(() => {
    setForm(f => ({ ...f, academic_year_id: selectedYearId || '', class_id: '', subject_id: '' }))
    if (!selectedYearId) {
      setClasses([])
      return
    }
    setupAPI.getClasses(selectedYearId).then(r => setClasses(r.data || []))
  }, [selectedYearId])

  // Load subjects when class changes
  useEffect(() => {
    if (form.class_id) {
      marksAPI.getSubjects(form.class_id).then(r => setSubjects(r.data || []))
    } else {
      setSubjects([])
    }
  }, [form.class_id])

  // Load assignments when teacher changes
  useEffect(() => {
    if (!selectedTeacher) { setAssignments([]); return }
    setLoading(true)
    adminAPI.listTeacherAssignments(selectedTeacher)
      .then(r => setAssignments(r.data || []))
      .catch(() => toast.error('Failed to load assignments'))
      .finally(() => setLoading(false))
  }, [selectedTeacher])

  const resolveClassName = (classId) => {
    const cls = classes.find(c => c.id === classId)
    return cls ? `Std ${cls.name} — Div ${cls.division}` : `Class ${classId}`
  }

  const handleAdd = async () => {
    if (!selectedTeacher) { toast.error('Select a teacher first'); return }
    if (!form.class_id)   { toast.error('Select a class'); return }
    if (!form.academic_year_id) { toast.error('Select an academic year'); return }
    setAdding(true)
    try {
      await adminAPI.assignTeacherClass(selectedTeacher, {
        class_id: parseInt(form.class_id),
        academic_year_id: parseInt(form.academic_year_id),
        subject_id: form.subject_id ? parseInt(form.subject_id) : null,
      })
      toast.success('Assignment added')
      setForm(f => ({ ...f, class_id: '', subject_id: '' }))
      // Reload
      const r = await adminAPI.listTeacherAssignments(selectedTeacher)
      setAssignments(r.data || [])
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (assignment) => {
    setRemoving(assignment.id)
    try {
      await adminAPI.removeTeacherClass(
        assignment.teacher_id,
        assignment.class_id,
        assignment.subject_id ? { subject_id: assignment.subject_id } : {}
      )
      toast.success('Assignment removed')
      setAssignments(prev => prev.filter(a => a.id !== assignment.id))
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setRemoving(null)
    }
  }

  const teacherOptions = teachers.map(t => ({ value: String(t.id), label: t.name }))
  const classOptions   = classes.map(c => ({ value: String(c.id), label: `Std ${c.name} — ${c.division}` }))
  const yearOptions    = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))
  const subjectOptions = subjects.map(s => ({ value: String(s.id), label: s.name }))

  // ── Pagination for assignments list ──
  const { page, setPage, pageItems: pageAssignments, totalPages } = usePagination(assignments, 15)

  return (
    <div>
      {/* Teacher selector */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div className="card-header"><div className="card-title">Select Teacher</div></div>
        <div style={{ padding: '16px 18px' }}>
          <Select
            value={selectedTeacher}
            onChange={e => setSelectedTeacher(e.target.value)}
            options={teacherOptions}
            placeholder="Choose a teacher…"
            style={{ maxWidth: '360px' }}
          />
        </div>
      </div>

      {selectedTeacher && (
        <>
          {/* Add assignment form */}
          <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: '12px', padding: '16px 20px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand-700)', marginBottom: '12px' }}>
              Add Class Assignment
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label className="label" style={{ color: 'var(--brand-700)' }}>Class *</label>
                <select className="input" value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value, subject_id: '' }))}>
                  <option value="">Select class…</option>
                  {classOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" style={{ color: 'var(--brand-700)' }}>Academic Year *</label>
                <select className="input" value={form.academic_year_id} onChange={e => setForm(f => ({ ...f, academic_year_id: e.target.value }))} disabled>
                  <option value="">Select year…</option>
                  {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" style={{ color: 'var(--brand-700)' }}>Subject (optional)</label>
                <select className="input" value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))} disabled={!form.class_id}>
                  <option value="">All subjects / Class teacher</option>
                  {subjectOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding} style={{ width: '100%' }}>
              {adding ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Adding…</> : '+ Add Assignment'}
            </button>
          </div>

          {/* Assignments list */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                {teachers.find(t => String(t.id) === selectedTeacher)?.name || 'Teacher'} — Assignments
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{assignments.length} class{assignments.length !== 1 ? 'es' : ''} assigned</div>
            </div>
            {loading ? (
              <table className="data-table"><TableSkeleton rows={4} cols={4} /></table>
            ) : assignments.length === 0 ? (
              <EmptyState
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998" /></svg>}
                title="No classes assigned"
                description="Use the form above to assign classes"
              />
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: '400px' }}>
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Academic Year</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageAssignments.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600 }}>{resolveClassName(a.class_id)}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {a.subject_id
                              ? subjects.find(s => s.id === a.subject_id)?.name || `Subject #${a.subject_id}`
                              : <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>All subjects (class teacher)</span>
                            }
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {years.find(y => y.id === a.academic_year_id)?.label || `Year #${a.academic_year_id}`}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleRemove(a)}
                              disabled={removing === a.id}
                              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)', cursor: removing === a.id ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}
                            >
                              {removing === a.id ? <span className="spinner" style={{ width: '11px', height: '11px' }} /> : 'Remove'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} totalPages={totalPages} total={assignments.length} pageSize={15} setPage={setPage} />
              </>
            )}
          </div>
        </>
      )}

      {!selectedTeacher && (
        <div className="card">
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            title="Select a teacher to manage their class assignments"
          />
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 3 — Portal Linking (link student/parent user → student record)
// ════════════════════════════════════════════════════════════════════════════════
function PortalLinkingTab() {
  const [portalUsers, setPortalUsers] = useState([])
  const [students, setStudents]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [form, setForm]               = useState({ user_id: '', student_id: '', role: 'student' })
  const [linking, setLinking]         = useState(false)
  const [search, setSearch]           = useState('')

  // Activation state
  const [linkStatus, setLinkStatus]     = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkResult, setBulkResult]     = useState(null)
  const [generatingFor, setGeneratingFor] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [portalRes, studRes] = await Promise.all([
        adminAPI.listPortalAccounts(),
        studentAPI.list({ limit: 200 }),
      ])
      setPortalUsers(portalRes.data || [])
      const rawStudents = studRes.data || []
      setStudents(Array.isArray(rawStudents) ? rawStudents : (rawStudents.items || []))
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLinkStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await adminAPI.getLinkStatus()
      setLinkStatus(res.data)
    } catch {
      toast.error('Failed to load link status')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    fetchLinkStatus()
  }, [fetchAll, fetchLinkStatus])

  const handleLink = async () => {
    if (!form.user_id)    { toast.error('Select a portal account'); return }
    if (!form.student_id) { toast.error('Select a student'); return }
    setLinking(true)
    try {
      await adminAPI.linkStudent({
        user_id:    parseInt(form.user_id),
        student_id: parseInt(form.student_id),
        role:       form.role,
      })
      toast.success('Portal account linked to student')
      setForm(f => ({ ...f, user_id: '', student_id: '' }))
      fetchLinkStatus()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLinking(false)
    }
  }

  const handleBulkGenerate = async () => {
    setBulkGenerating(true)
    setBulkResult(null)
    try {
      let sent = 0
      let skippedAlreadyLinked = 0
      let skippedNoEmail = 0
      const errors = []
      for (const student of linkStatus?.unlinked_students || []) {
        for (const accountType of ['student', 'parent']) {
          const alreadyLinked = accountType === 'student' ? student.has_student_account : student.has_parent_account
          const hasEmail = accountType === 'student' ? student.has_student_email : student.has_guardian_email
          if (alreadyLinked) {
            skippedAlreadyLinked += 1
            continue
          }
          if (!hasEmail) {
            skippedNoEmail += 1
            continue
          }
          try {
            await adminAPI.createActivationInvite(student.id, accountType)
            sent += 1
          } catch (err) {
            errors.push(`${student.student_id} ${accountType}: ${extractError(err)}`)
          }
        }
      }
      setBulkResult({
        sent,
        skippedAlreadyLinked,
        skippedNoEmail,
        errors,
        failedStudents: errors.map(error => error.split(':')[0]),
      })
      toast.success(`Invite links queued: ${sent}`)
      fetchAll()
      fetchLinkStatus()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBulkGenerating(false)
    }
  }

  const handleGenerateAccount = async (student, accountType) => {
    const hasAccount = accountType === 'student' ? student.has_student_account : student.has_parent_account
    const hasEmail = accountType === 'student' ? student.has_student_email : student.has_guardian_email
    if (hasAccount) {
      toast.success(`${accountType === 'student' ? 'Student' : 'Parent'} account is already linked`)
      return
    }
    if (!hasEmail) {
      toast.error(`${accountType === 'student' ? 'Student' : 'Guardian'} email is missing`)
      return
    }
    setGeneratingFor(`${student.id}-${accountType}`)
    try {
      await adminAPI.createActivationInvite(student.id, accountType)
      toast.success(`${accountType === 'student' ? 'Student' : 'Parent'} invite link queued`)
      fetchAll()
      fetchLinkStatus()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setGeneratingFor(null)
    }
  }

  const filteredPortal = search
    ? portalUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : portalUsers

  const studentOptions = students.map(s => ({ value: String(s.id), label: `${s.name_en} (${s.student_id})` }))
  const portalOptions  = portalUsers
    .filter(u => u.role === form.role)
    .map(u => ({ value: String(u.id), label: `${u.name} — ${u.email}` }))

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '12px', color: 'var(--text-tertiary)' }}>
        <span className="spinner" /> Loading portal accounts…
      </div>
    )
  }

  const unlinkedCount = linkStatus
    ? linkStatus.students_without_portal_account + linkStatus.students_without_parent_account
    : 0

  return (
    <div>
      {/* ── Link Status Summary ──────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <div className="card-title">Account Linking Status</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={fetchLinkStatus}
            disabled={statusLoading}
            style={{ fontSize: '12px' }}
          >
            {statusLoading ? <><span className="spinner" style={{ width: '11px', height: '11px' }} /> Refreshing…</> : '↻ Refresh'}
          </button>
        </div>
        {statusLoading && !linkStatus ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            Loading status…
          </div>
        ) : linkStatus ? (
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Total Students', value: linkStatus.total_active_students, color: 'var(--brand-600)' },
                { label: 'Student Accounts', value: `${linkStatus.students_with_portal_account} / ${linkStatus.total_active_students}`,
                  color: linkStatus.students_without_portal_account === 0 ? 'var(--success-600)' : 'var(--warning-600)' },
                { label: 'Parent Accounts', value: `${linkStatus.students_with_parent_account} / ${linkStatus.total_active_students}`,
                  color: linkStatus.students_without_parent_account === 0 ? 'var(--success-600)' : 'var(--warning-600)' },
              ].map(stat => (
                <div key={stat.label} style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'var(--gray-50)', border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', fontWeight: 600 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Bulk activation */}
            {unlinkedCount > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleBulkGenerate}
                  disabled={bulkGenerating}
                  style={{ width: '100%' }}
                >
                  {bulkGenerating
                    ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Queueing invite links…</>
                    : `Send Invite Links (${linkStatus.unlinked_students.length} students affected)`
                  }
                </button>
                <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '6px', lineHeight: 1.5 }}>
                  Queues secure invite links for activation-ready student and parent contacts. The invite opens the portal, then OTP verifies the email before account creation.
                </div>
              </div>
            )}

            {unlinkedCount === 0 && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'var(--success-50)', border: '1px solid var(--success-200)',
                fontSize: '13px', color: 'var(--success-700)', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                All active students have both student and parent portal accounts linked.
              </div>
            )}

            {/* Bulk activation result */}
            {bulkResult && (
              <div style={{
                marginTop: '12px', padding: '12px 14px', borderRadius: '8px',
                background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
                fontSize: '13px', lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, color: 'var(--brand-700)', marginBottom: '4px' }}>
                  Bulk invite complete
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Invite links queued: <strong>{bulkResult.sent}</strong></div>
                <div style={{ color: 'var(--text-secondary)' }}>{bulkResult.skippedAlreadyLinked || 0} already linked account(s) skipped</div>
                {(bulkResult.skippedNoEmail || 0) > 0 && (
                  <div style={{ color: 'var(--warning-600)' }}>
                    {bulkResult.skippedNoEmail} account(s) skipped because email is missing.{' '}
                    <a href="/students" style={{ color: 'var(--brand-600)', fontWeight: 800 }}>Update student emails</a>
                  </div>
                )}
                {bulkResult.errors?.length > 0 && (
                  <div style={{ marginTop: '6px', color: 'var(--danger-600)', fontSize: '12px' }}>
                    {bulkResult.errors.length} error{bulkResult.errors.length !== 1 ? 's' : ''}:
                    {bulkResult.errors.slice(0, 3).map((e, i) => <div key={i} style={{ marginLeft: '8px' }}>• {e}</div>)}
                    {bulkResult.errors.length > 3 && <div style={{ marginLeft: '8px' }}>• {bulkResult.errors.length - 3} more failed</div>}
                  </div>
                )}
              </div>
            )}

            {/* Per-student unlinked list */}
            {linkStatus.unlinked_students.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                  Unlinked Students ({linkStatus.unlinked_students.length})
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: '480px' }}>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student Account</th>
                        <th>Parent Account</th>
                        <th>Readiness</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkStatus.unlinked_students.map(s => (
                        <tr key={s.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{s.name_en}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{s.student_id}</div>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                              background: s.has_student_account ? 'var(--success-100)' : 'var(--warning-50)',
                              color: s.has_student_account ? 'var(--success-700)' : 'var(--warning-700)',
                              border: `1px solid ${s.has_student_account ? 'var(--success-200)' : '#fde68a'}`,
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                            }}>
                              {s.has_student_account
                                ? <><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Linked</>
                                : <><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> Not linked</>
                            </span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                              background: s.has_parent_account ? 'var(--success-100)' : 'var(--warning-50)',
                              color: s.has_parent_account ? 'var(--success-700)' : 'var(--warning-700)',
                              border: `1px solid ${s.has_parent_account ? 'var(--success-200)' : '#fde68a'}`,
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                            }}>
                              {s.has_parent_account
                                ? <><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Linked</>
                                : <><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> Not linked</>
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Student email: <strong>{s.has_student_email ? 'Yes' : 'No'}</strong><br />
                            Guardian email: <strong>{s.has_guardian_email ? 'Yes' : 'No'}</strong>
                            {(s.student_activation_status || s.parent_activation_status) && (
                              <div style={{ color: 'var(--brand-600)', marginTop: '2px' }}>
                                {s.student_activation_status || 'not sent'} / {s.parent_activation_status || 'not sent'}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleGenerateAccount(s, 'student')}
                                disabled={generatingFor === `${s.id}-student` || s.has_student_account || !s.has_student_email}
                                style={{
                                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                                  color: s.has_student_account || !s.has_student_email ? 'var(--gray-400)' : 'var(--brand-600)',
                                  background: s.has_student_account || !s.has_student_email ? 'var(--gray-50)' : 'var(--brand-50)',
                                  border: `1px solid ${s.has_student_account || !s.has_student_email ? 'var(--border-subtle)' : 'var(--brand-100)'}`,
                                  cursor: s.has_student_account || !s.has_student_email ? 'not-allowed' : 'pointer',
                                  fontFamily: 'var(--font-sans)',
                                }}
                              >
                                {generatingFor === `${s.id}-student`
                                  ? <span className="spinner" style={{ width: '11px', height: '11px' }} />
                                  : 'Student link'
                                }
                              </button>
                              <button
                                onClick={() => handleGenerateAccount(s, 'parent')}
                                disabled={generatingFor === `${s.id}-parent` || s.has_parent_account || !s.has_guardian_email}
                                style={{
                                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                                  color: s.has_parent_account || !s.has_guardian_email ? 'var(--gray-400)' : 'var(--warning-700)',
                                  background: s.has_parent_account || !s.has_guardian_email ? 'var(--gray-50)' : 'var(--warning-50)',
                                  border: `1px solid ${s.has_parent_account || !s.has_guardian_email ? 'var(--border-subtle)' : '#fde68a'}`,
                                  cursor: s.has_parent_account || !s.has_guardian_email ? 'not-allowed' : 'pointer',
                                  fontFamily: 'var(--font-sans)',
                                }}
                              >
                                {generatingFor === `${s.id}-parent`
                                  ? <span className="spinner" style={{ width: '11px', height: '11px' }} />
                                  : 'Parent link'
                                }
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Explainer */}
      <div style={{ padding: '14px 16px', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: '10px', marginBottom: '16px', fontSize: '13.5px', color: 'var(--brand-700)', lineHeight: 1.6 }}>
        <strong>How portal activation works:</strong> Admins send invite links first. The invite opens activation directly, then OTP verifies the inbox before the student or parent creates a password.
      </div>

      {/* Link form */}
      <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand-700)', marginBottom: '12px' }}>
          Link Portal Account to Student (Manual)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          {/* Role toggle */}
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Account Role</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['student', 'parent'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, role: r, user_id: '' }))}
                  style={{
                    flex: 1, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
                    background: form.role === r ? 'var(--brand-600)' : 'var(--surface-0)',
                    color: form.role === r ? 'white' : 'var(--text-secondary)',
                    border: `1.5px solid ${form.role === r ? 'var(--brand-600)' : 'var(--border-default)'}`,
                    textTransform: 'capitalize',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Portal Account ({form.role})</label>
            <select className="input" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
              <option value="">Select {form.role} account…</option>
              {portalOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" style={{ color: 'var(--brand-700)' }}>Student Record</label>
            <select className="input" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
              <option value="">Select student…</option>
              {studentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleLink} disabled={linking} style={{ width: '100%' }}>
          {linking
            ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Linking…</>
            : <><svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> Link Account</>
          }
        </button>
      </div>

      {/* Portal accounts list */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Portal Accounts</div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search…" style={{ width: '200px' }} />
        </div>
        {filteredPortal.length === 0 ? (
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            title="No portal accounts yet"
            description="Send invite links above, or create emergency accounts in the Users tab"
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '400px' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPortal.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                        background: u.is_active ? 'var(--success-100)' : 'var(--gray-100)',
                        color: u.is_active ? 'var(--success-700)' : 'var(--gray-500)',
                      }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function TeacherRegistrationTab({ onOpenAssignments }) {
  const [teachers, setTeachers] = useState([])
  const [assignmentCounts, setAssignmentCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resending, setResending] = useState(null)
  const [bulkResending, setBulkResending] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })

  const loadTeachers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAPI.listUsers({ role: 'teacher' })
      const nextTeachers = res.data || []
      setTeachers(nextTeachers)
      const activeTeachers = nextTeachers.filter(t => t.is_active)
      const counts = {}
      await Promise.all(activeTeachers.map(async teacher => {
        try {
          const assignmentRes = await adminAPI.listTeacherAssignments(teacher.id)
          counts[teacher.id] = (assignmentRes.data || []).length
        } catch {
          counts[teacher.id] = 0
        }
      }))
      setAssignmentCounts(counts)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTeachers() }, [loadTeachers])

  const sendInvite = async e => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Teacher name is required')
      return
    }
    if (!form.email.trim()) {
      toast.error('Teacher email is required')
      return
    }
    setSaving(true)
    try {
      await adminAPI.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: 'teacher',
        send_invite: true,
      })
      toast.success('Teacher registration link queued')
      setForm({ name: '', email: '' })
      loadTeachers()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const resendInvite = async teacher => {
    setResending(teacher.id)
    try {
      await adminAPI.resendTeacherInvite(teacher.id)
      toast.success(`Registration link resent to ${teacher.email}`)
      loadTeachers()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setResending(null)
    }
  }

  const resendAllPending = async () => {
    setBulkResending(true)
    try {
      const res = await adminAPI.resendPendingTeacherInvites()
      const queued = res.data?.queued || 0
      const failed = res.data?.failed || 0
      if (failed) toast.error(`${queued} links queued, ${failed} failed`)
      else toast.success(`Registration links queued: ${queued}`)
      loadTeachers()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBulkResending(false)
    }
  }

  const formatInviteDate = value => {
    if (!value) return 'Not sent yet'
    return new Date(value).toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const activeCount = teachers.filter(t => t.is_active).length
  const pendingCount = teachers.length - activeCount
  const unassignedActiveCount = teachers.filter(t => t.is_active && !assignmentCounts[t.id]).length

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
        gap: 16,
        alignItems: 'stretch',
      }}>
        <form className="card" onSubmit={sendInvite} style={{ padding: 22, border: '1px solid var(--brand-200)', background: 'linear-gradient(135deg, var(--brand-50), var(--surface-0))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--brand-700)', marginBottom: 8 }}>
                Teacher Registration
              </div>
              <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.15, color: 'var(--text-primary)' }}>
                Send setup link
              </h2>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-700)', background: 'white', border: '1px solid var(--brand-200)', borderRadius: 999, padding: '5px 10px', whiteSpace: 'nowrap' }}>
              7 day link
            </span>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Teacher name" required>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Fatima Sheikh"
                autoComplete="name"
              />
            </Field>
            <Field label="Teacher email" required>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="teacher@iqraschool.in"
                autoComplete="email"
              />
            </Field>
            <button className="btn btn-primary btn-lg" disabled={saving}>
              {saving
                ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Sending link...</>
                : <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 8l7-4 7 4v10l-7 4-7-4V8z" /></svg> Send Link</>
              }
            </button>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            The teacher receives a `/portal/complete-registration` link, sets their own password, and becomes active automatically.
          </div>
        </form>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>Teacher Accounts</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {activeCount} active · {pendingCount} pending invite · {unassignedActiveCount} need assignment
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={resendAllPending}
                disabled={!pendingCount || bulkResending}
              >
                {bulkResending ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Resending...</> : 'Resend Pending'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenAssignments()}>
                Assign Classes
              </button>
            </div>
          </div>

          {loading ? (
            <table className="data-table"><TableSkeleton rows={4} cols={5} /></table>
          ) : teachers.length === 0 ? (
            <EmptyState title="No teachers yet" description="Send the first registration link from the form." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Last Invite</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(teacher => {
                    const assignmentCount = assignmentCounts[teacher.id] || 0
                    const needsAssignment = teacher.is_active && assignmentCount === 0
                    return (
                      <tr key={teacher.id}>
                        <td style={{ fontWeight: 700 }}>{teacher.name}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{teacher.email}</td>
                        <td>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: !teacher.is_active ? 'var(--warning-50)' : needsAssignment ? 'var(--brand-50)' : 'var(--success-100)',
                            color: !teacher.is_active ? 'var(--warning-700)' : needsAssignment ? 'var(--brand-700)' : 'var(--success-700)',
                          }}>
                            {!teacher.is_active ? 'Pending invite' : needsAssignment ? 'Active, needs assignment' : 'Active'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          {formatInviteDate(teacher.last_invite_sent_at)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {!teacher.is_active ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => resendInvite(teacher)}
                              disabled={resending === teacher.id}
                            >
                              {resending === teacher.id ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Resending...</> : 'Resend Link'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={needsAssignment ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                              onClick={() => onOpenAssignments(teacher.id)}
                            >
                              {needsAssignment ? 'Assign Classes' : `${assignmentCount} Assignment${assignmentCount === 1 ? '' : 's'}`}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main UserManagement — tabs wrapper
// ═══════════════════════════════════════════════════════════════════════════════
const TAB_ICONS = {
  register: (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a3 3 0 11-6 0 3 3 0 016 0zM4 20a8 8 0 0116 0M19 8v6m3-3h-6" />
    </svg>
  ),
  users: (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  assignments: (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
    </svg>
  ),
  portal: (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
}

export default function UserManagement() {
  const [tab, setTab] = useState('register')
  const [assignmentTeacherId, setAssignmentTeacherId] = useState('')

  const tabs = [
    { value: 'register',    label: 'Teacher Registration', icon: TAB_ICONS.register },
    { value: 'users',       label: 'Users',              icon: TAB_ICONS.users },
    { value: 'assignments', label: 'Teacher Assignments', icon: TAB_ICONS.assignments },
    { value: 'portal',      label: 'Portal Linking',      icon: TAB_ICONS.portal },
    { value: 'corrections', label: 'Corrections',          icon: TAB_ICONS.portal },
  ]

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Register teachers, manage staff accounts, assign classes, and activate student or parent portal access"
      />
      <div style={{ marginBottom: '16px' }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'register'    && <TeacherRegistrationTab onOpenAssignments={(teacherId = '') => { setAssignmentTeacherId(teacherId ? String(teacherId) : ''); setTab('assignments') }} />}
      {tab === 'users'       && <UsersTab />}
      {tab === 'assignments' && <TeacherAssignmentsTab selectedTeacherId={assignmentTeacherId} onTeacherSelected={setAssignmentTeacherId} />}
      {tab === 'portal'      && <PortalLinkingTab />}
      {tab === 'corrections' && <CorrectionRequestsTab />}
    </div>
  )
}
