// App.jsx — Updated with all improved components
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { getRole, getToken } from './services/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudentList from './pages/students/StudentList'
import StudentForm from './pages/students/StudentForm'
import FeeStructure from './pages/fees/FeeStructure'
import StudentFees from './pages/fees/StudentFees'
import Defaulters from './pages/fees/Defaulters'
import MarksEntry from './pages/marks/MarksEntry'
import Attendance from './pages/attendance/Attendance'
import Reports from './pages/reports/Reports'
import YearEnd from './pages/yearend/YearEnd'
import ComingSoon from './pages/ComingSoon'
import UserManagement from './pages/admin/UserManagement'

function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return children
}

function RoleRoute({ roles, children }) {
  const role = getRole()
  if (!role || !roles.includes(role)) return <Navigate to="/unauthorized" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<StudentList />} />
          <Route path="students/new" element={<RoleRoute roles={['admin']}><StudentForm /></RoleRoute>} />
          <Route path="students/:id/edit" element={<RoleRoute roles={['admin']}><StudentForm /></RoleRoute>} />
          <Route path="fees" element={<RoleRoute roles={['admin']}><FeeStructure /></RoleRoute>} />
          <Route path="fees/defaulters" element={<RoleRoute roles={['admin']}><Defaulters /></RoleRoute>} />
          <Route path="fees/student/:id" element={<StudentFees />} />
          <Route path="marks" element={<RoleRoute roles={['admin', 'teacher']}><MarksEntry /></RoleRoute>} />
          <Route path="attendance" element={<RoleRoute roles={['admin', 'teacher']}><Attendance /></RoleRoute>} />
          <Route path="reports" element={<Reports />} />
          <Route path="yearend" element={<RoleRoute roles={['admin']}><YearEnd /></RoleRoute>} />
          <Route path="admin/users" element={<RoleRoute roles={['admin']}><UserManagement /></RoleRoute>} />
          <Route path="unauthorized" element={<ComingSoon title="Unauthorized" description="You do not have access to this section." />} />
          <Route path="portal" element={<ComingSoon title="Portal" description="Student and parent portal begins in Sprint 10." />} />
        </Route>
      </Routes>

      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'var(--font-sans)',
            fontSize: '13.5px',
            fontWeight: 600,
            borderRadius: '10px',
            border: '1px solid',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: '12px 16px',
            maxWidth: '420px',
          },
          success: {
            style: {
              background: '#f0fdf4',
              color: '#15803d',
              borderColor: '#bbf7d0',
            },
            iconTheme: { primary: '#16a34a', secondary: 'white' },
          },
          error: {
            style: {
              background: '#fff1f2',
              color: '#be123c',
              borderColor: '#fecdd3',
            },
            iconTheme: { primary: '#e11d48', secondary: 'white' },
            duration: 6000,
          },
          loading: {
            style: {
              background: 'var(--brand-50)',
              color: 'var(--brand-700)',
              borderColor: 'var(--brand-200)',
            },
          },
        }}
      />
    </BrowserRouter>
  )
}
