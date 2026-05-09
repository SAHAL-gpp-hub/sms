// frontend/src/pages/admin/UserManagement.jsx — Full rebuild
// Tabs: Users list | Teacher Assignments | Portal Linking
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminAPI, setupAPI, studentAPI, extractError } from '../../services/api'
import {
  PageHeader, TabBar, EmptyState, TableSkeleton,
  ConfirmModal, SearchInput, Select, FilterRow, Field,
} from '../../components/UI'

// ── Role colours ──────────────────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Users List
// ══════════════════════════════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [roleFilter, setRoleFilter]   = useState('')
  const [search, setSearch]           = useState('')
  const [resetTarget, setResetTarget] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (roleFilter) params.role = roleFilter
      const res = await adminAPI.listUsers(params)
      setUsers(res.data || [])
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const filtered = search
    ? users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users

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

  const roleOptions = [
    { value: 'admin',   label: 'Admin' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'student', label: 'Student' },
    { value: 'parent',  label: 'Parent' },
  ]

  // Counts by role
  const counts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc }, {})

  return (
    <div>
      {/* Role summary chips */}
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
        <Select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          options={roleOptions}
          placeholder="All roles"
          style={{ minWidth: '140px' }}
        />
        {(search || roleFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setRoleFilter('') }}>Clear</button>
        )}
        <Link to="/admin/users/new" className="btn btn-primary" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </Link>
      </FilterRow>

      <div className="card">
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ minWidth: '560px' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton rows={6} cols={5} />
            ) : filtered.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={5} style={{ padding: 0, border: 'none' }}>
                    <EmptyState
                      icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                      title="No users found"
                      description="Create the first user account above"
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user.email}</td>
                    <td><RoleBadge role={user.role} /></td>
                    <td>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                        background: user.is_active ? 'var(--success-100)' : 'var(--gray-100)',
                        color: user.is_active ? 'var(--success-700)' : 'var(--gray-500)',
                      }}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Link
                          to={`/admin/users/${user.id}/edit`}
                          style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--brand-600)', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', textDecoration: 'none' }}
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => setResetTarget(user)}
                          style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--warning-600)', background: 'var(--warning-50)', border: '1px solid #fde68a', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        >
                          Reset PW
                        </button>
                        {user.is_active && (
                          <button
                            onClick={() => setDeactivateTarget(user)}
                            style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Showing {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <PasswordResetModal user={resetTarget} onClose={() => setResetTarget(null)} onSuccess={() => { setResetTarget(null); fetchUsers() }} />
      <ConfirmModal
        open={!!deactivateTarget}
        title="Deactivate User"
        message={`Deactivate "${deactivateTarget?.name}"? They won't be able to log in. You can re-activate them by editing the account.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
        loading={deactivating}
      />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Teacher Class Assignments
// ══════════════════════════════════════════════════════════════════════════════
function TeacherAssignmentsTab() {
  const [teachers, setTeachers]         = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [assignments, setAssignments]   = useState([])
  const [classes, setClasses]           = useState([])
  const [years, setYears]               = useState([])
  const [subjects, setSubjects]         = useState([])
  const [loading, setLoading]           = useState(false)
  const [adding, setAdding]             = useState(false)
  const [removing, setRemoving]         = useState(null)
  const [form, setForm] = useState({ class_id: '', academic_year_id: '', subject_id: '' })

  useEffect(() => {
    adminAPI.listUsers({ role: 'teacher' }).then(r => setTeachers(r.data || []))
    setupAPI.getClasses().then(r => setClasses(r.data || []))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data || [])
      const curr = r.data?.find(y => y.is_current)
      if (curr) setForm(f => ({ ...f, academic_year_id: String(curr.id) }))
    })
  }, [])

  // Load subjects when class changes
  useEffect(() => {
    if (form.class_id) {
      import('../../services/api').then(({ marksAPI }) => {
        marksAPI.getSubjects(form.class_id).then(r => setSubjects(r.data || []))
      })
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
                <select className="input" value={form.academic_year_id} onChange={e => setForm(f => ({ ...f, academic_year_id: e.target.value }))}>
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
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" /></svg>}
                title="No classes assigned"
                description="Use the form above to assign classes"
              />
            ) : (
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
                    {assignments.map(a => (
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
                            style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                          >
                            {removing === a.id ? <span className="spinner" style={{ width: '11px', height: '11px' }} /> : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Portal Linking (link student/parent user → student record)
// ══════════════════════════════════════════════════════════════════════════════
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
      setStudents(studRes.data || [])
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
      const errors = []
      for (const student of linkStatus?.unlinked_students || []) {
        for (const accountType of ['student', 'parent']) {
          const alreadyLinked = accountType === 'student' ? student.has_student_account : student.has_parent_account
          const hasEmail = accountType === 'student' ? student.has_student_email : student.has_guardian_email
          if (alreadyLinked || !hasEmail) continue
          try {
            await adminAPI.resendActivation(student.id, accountType)
            sent += 1
          } catch (err) {
            errors.push(`${student.student_id} ${accountType}: ${extractError(err)}`)
          }
        }
      }
      setBulkResult({ sent, errors })
      toast.success(`Activation emails queued: ${sent}`)
      fetchAll()
      fetchLinkStatus()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setBulkGenerating(false)
    }
  }

  const handleGenerateOne = async (student) => {
    const studentId = student.id
    setGeneratingFor(studentId)
    try {
      let sent = 0
      if (!student.has_student_account && student.has_student_email) {
        await adminAPI.resendActivation(studentId, 'student')
        sent += 1
      }
      if (!student.has_parent_account && student.has_guardian_email) {
        await adminAPI.resendActivation(studentId, 'parent')
        sent += 1
      }
      toast.success(sent ? `Activation email${sent !== 1 ? 's' : ''} queued` : 'No activation-ready email found')
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
                    ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Queueing activation emails…</>
                    : `Send Activation Emails (${linkStatus.unlinked_students.length} students affected)`
                  }
                </button>
                <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '6px', lineHeight: 1.5 }}>
                  Queues OTP emails for activation-ready student and parent contacts. Accounts are created only after OTP verification.
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
                  Generation complete
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Activation emails queued: <strong>{bulkResult.sent}</strong>
                </div>
                {bulkResult.errors?.length > 0 && (
                  <div style={{ marginTop: '6px', color: 'var(--danger-600)', fontSize: '12px' }}>
                    {bulkResult.errors.length} error{bulkResult.errors.length !== 1 ? 's' : ''}:
                    {bulkResult.errors.map((e, i) => <div key={i} style={{ marginLeft: '8px' }}>• {e}</div>)}
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
                                ? <><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg> Linked</>
                                : <><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg> Missing</>}
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
                                ? <><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg> Linked</>
                                : <><svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg> Missing</>}
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
                            <button
                              onClick={() => handleGenerateOne(s)}
                              disabled={generatingFor === s.id}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                color: 'var(--brand-600)', background: 'var(--brand-50)',
                                border: '1px solid var(--brand-100)', cursor: 'pointer',
                                fontFamily: 'var(--font-sans)',
                              }}
                            >
                              {generatingFor === s.id
                                ? <span className="spinner" style={{ width: '11px', height: '11px' }} />
                                : 'Send OTP'
                              }
                            </button>
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
        <strong>How portal activation works:</strong> Student and parent accounts are created only after OTP verification. Manual linking remains available for audited emergency repair.
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
            : <><svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> Link Account to Student</>}
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
            description="Send activation emails above, or create emergency accounts in the Users tab"
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

// ══════════════════════════════════════════════════════════════════════════════
// Main UserManagement — tabs wrapper
// ══════════════════════════════════════════════════════════════════════════════
const TAB_ICONS = {
  users: (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
  const [tab, setTab] = useState('users')

  const tabs = [
    { value: 'users',       label: 'Users',              icon: TAB_ICONS.users },
    { value: 'assignments', label: 'Teacher Assignments', icon: TAB_ICONS.assignments },
    { value: 'portal',      label: 'Portal Linking',      icon: TAB_ICONS.portal },
  ]

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage admin, teacher, student and parent accounts · assign classes · link portal accounts"
      />
      <div style={{ marginBottom: '16px' }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'users'       && <UsersTab />}
      {tab === 'assignments' && <TeacherAssignmentsTab />}
      {tab === 'portal'      && <PortalLinkingTab />}
    </div>
  )
}
