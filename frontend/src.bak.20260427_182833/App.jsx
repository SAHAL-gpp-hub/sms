import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './services/auth'
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

// C-01 FIX: Redirect unauthenticated users to /login
function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* All protected routes wrapped in Layout */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<StudentList />} />
          <Route path="students/new" element={<StudentForm />} />
          <Route path="students/:id/edit" element={<StudentForm />} />
          <Route path="fees" element={<FeeStructure />} />
          <Route path="fees/defaulters" element={<Defaulters />} />
          <Route path="fees/student/:id" element={<StudentFees />} />
          <Route path="marks" element={<MarksEntry />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="reports" element={<Reports />} />
          <Route path="yearend" element={<YearEnd />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App