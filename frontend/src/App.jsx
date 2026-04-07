import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
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


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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