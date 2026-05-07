// frontend/src/App.jsx — Updated with S10 Portal routes
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { getRole, getToken, normalizeAuthUser, setAuthUser } from './services/auth'
import { authAPI } from './services/api'
import Layout from './components/Layout'
import PortalLayout from './layouts/PortalLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import ActivateAccount from './pages/ActivateAccount'
import Dashboard from './pages/Dashboard'
import EnrollmentManager from './pages/enrollments/EnrollmentManager'
import StudentList from './pages/students/StudentList'
import StudentForm from './pages/students/StudentForm'
import FeeStructure from './pages/fees/FeeStructure'
import StudentFees from './pages/fees/StudentFees'
import Defaulters from './pages/fees/Defaulters'
import MarksEntry from './pages/marks/MarksEntry'
import Attendance from './pages/attendance/Attendance'
import Reports from './pages/reports/Reports'
import YearEnd from './pages/yearend/YearEnd'
import Notifications from './pages/notifications/Notifications'
import ComingSoon from './pages/ComingSoon'
import UserManagement from './pages/admin/UserManagement'
import UserForm from './pages/admin/UserForm'
import Unauthorized from './pages/Unauthorized'
import ClassManagement from './pages/setup/ClassManagement'


// Portal pages
import PortalDashboard  from './pages/portal/PortalDashboard'
import PortalResults    from './pages/portal/PortalResults'
import PortalAttendance from './pages/portal/PortalAttendance'
import PortalFees       from './pages/portal/PortalFees'
import PortalProfile    from './pages/portal/PortalProfile'

function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return children
}

function RoleRoute({ roles, children }) {
  const role = getRole()
  if (!role || !roles.includes(role)) return <Navigate to="/unauthorized" replace />
  return children
}

// Redirect student/parent to portal, admin/teacher to dashboard
function SmartRoot() {
  const role = getRole()
  if (role === 'student' || role === 'parent') return <Navigate to="/portal" replace />
  return <Navigate to="/" replace />
}

function AuthHydrator() {
  useEffect(() => {
    if (!getToken()) return
    authAPI.me()
      .then(r => setAuthUser(normalizeAuthUser(r.data)))
      .catch(() => {})
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthHydrator />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/activate-account" element={<ActivateAccount />} />
        <Route path="/activate-account/verify" element={<ActivateAccount />} />
        <Route path="/activate-account/password" element={<ActivateAccount />} />
        <Route path="/activate-account/success" element={<ActivateAccount />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* ── Admin / Teacher panel ── */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={
            <RoleRoute roles={['admin', 'teacher']}>
              <Dashboard />
            </RoleRoute>
          } />

          {/* Students */}
          <Route path="students" element={<StudentList />} />
          <Route path="students/new" element={<RoleRoute roles={['admin']}><StudentForm /></RoleRoute>} />
          <Route path="students/:id/edit" element={<RoleRoute roles={['admin']}><StudentForm /></RoleRoute>} />
          <Route path="enrollments" element={<RoleRoute roles={['admin', 'teacher']}><EnrollmentManager /></RoleRoute>} />

          {/* Fees */}
          <Route path="fees" element={<RoleRoute roles={['admin']}><FeeStructure /></RoleRoute>} />
          <Route path="fees/defaulters" element={<RoleRoute roles={['admin']}><Defaulters /></RoleRoute>} />
          <Route path="fees/student/:id" element={<StudentFees />} />

          {/* Setup */}
              <Route
              path="setup/classes"
                element={
                  <RoleRoute roles={['admin']}>
                    <ClassManagement />
                  </RoleRoute>
                }
              />

          {/* Academics */}
          <Route path="marks" element={<RoleRoute roles={['admin', 'teacher']}><MarksEntry /></RoleRoute>} />
          <Route path="attendance" element={<RoleRoute roles={['admin', 'teacher']}><Attendance /></RoleRoute>} />

          {/* Reports */}
          <Route path="reports" element={<Reports />} />

          {/* Year-end */}
          <Route path="yearend" element={<RoleRoute roles={['admin']}><YearEnd /></RoleRoute>} />
          <Route path="notifications" element={<RoleRoute roles={['admin']}><Notifications /></RoleRoute>} />

          {/* Admin — User Management */}
          <Route path="admin/users" element={<RoleRoute roles={['admin']}><UserManagement /></RoleRoute>} />
          <Route path="admin/users/new" element={<RoleRoute roles={['admin']}><UserForm /></RoleRoute>} />
          <Route path="admin/users/:id/edit" element={<RoleRoute roles={['admin']}><UserForm /></RoleRoute>} />
        </Route>

        {/* ── Student / Parent portal ── */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute>
              <RoleRoute roles={['student', 'parent']}>
                <PortalLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<PortalDashboard />} />
          <Route path="results"    element={<PortalResults />} />
          <Route path="attendance" element={<PortalAttendance />} />
          <Route path="fees"       element={<PortalFees />} />
          <Route path="profile"    element={<PortalProfile />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
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
            style: { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' },
            iconTheme: { primary: '#16a34a', secondary: 'white' },
          },
          error: {
            style: { background: '#fff1f2', color: '#be123c', borderColor: '#fecdd3' },
            iconTheme: { primary: '#e11d48', secondary: 'white' },
            duration: 6000,
          },
          loading: {
            style: { background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-200)' },
          },
        }}
      />
    </BrowserRouter>
  )
}
