import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { adminAPI, extractError } from '../../services/api'

const roleColors = {
  admin: '#dc2626',
  teacher: '#2563eb',
  student: '#16a34a',
  parent: '#ea580c',
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.listUsers(role ? { role } : {})
      setUsers(res.data || [])
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [role])

  return (
    <div>
      <div className="mb-6" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">User Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage admin, teacher, student, and parent accounts.</p>
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ height: 38, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px' }}
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
          <option value="parent">Parent</option>
        </select>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={td} colSpan="4">Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td style={td} colSpan="4">No users found.</td></tr>
            ) : users.map(user => (
              <tr key={user.id}>
                <td style={td}>{user.name}</td>
                <td style={td}>{user.email}</td>
                <td style={td}>
                  <span style={{
                    color: roleColors[user.role] || '#475569',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 999,
                    padding: '3px 9px',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'capitalize',
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={td}>{user.is_active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = {
  textAlign: 'left',
  padding: '12px 14px',
  fontSize: 12,
  color: '#475569',
  borderBottom: '1px solid #e2e8f0',
}

const td = {
  padding: '12px 14px',
  fontSize: 13,
  color: '#0f172a',
  borderBottom: '1px solid #f1f5f9',
}
