import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { enrollmentsAPI, extractError, setupAPI, studentAPI } from '../../services/api'
import { getAuthUser } from '../../services/auth'
import {
  FilterRow,
  PageHeader,
  ReadonlyBanner,
  ScreenState,
  Select,
  StatusBadge,
  TableSkeleton,
} from '../../components/UI'
import { useAcademicYear } from '../../contexts/academicYearContext'

const ROLL_STRATEGIES = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'sequential', label: 'Keep Current Order' },
  { value: 'by_gr_number', label: 'By GR Number' },
]

export default function EnrollmentManager() {
  const authUser = getAuthUser()
  const isAdmin = authUser?.role === 'admin'
  const {
    selectedYearId: selectedYear,
    selectedYear: selectedYearMeta,
    years,
    isClosedYear,
    loading: yearLoading,
    setSelectedYearId,
  } = useAcademicYear()

  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [rollList, setRollList] = useState([])
  const [history, setHistory] = useState([])

  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [strategy, setStrategy] = useState('alphabetical')

  const [loading, setLoading] = useState(true)
  const [loadingRolls, setLoadingRolls] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  useEffect(() => {
    studentAPI.list({ limit: 200 })
      .then((studentRes) => {
        const rawStudents = studentRes.data || []
        setStudents(Array.isArray(rawStudents) ? rawStudents : (rawStudents.items || []))
      })
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedYear) {
      setClasses([])
      return
    }
    setupAPI.getClasses(parseInt(selectedYear))
      .then(r => setClasses(r.data || []))
      .catch(err => toast.error(extractError(err)))
  }, [selectedYear])

  useEffect(() => {
    if (!selectedYear) {
      setEnrollments([])
      setRollList([])
      return
    }

    setLoading(true)
    const params = { academic_year_id: selectedYear }
    if (selectedClass) params.class_id = selectedClass

    enrollmentsAPI.list(params)
      .then(r => setEnrollments(r.data || []))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false))
  }, [selectedYear, selectedClass])

  useEffect(() => {
    if (!selectedYear || !selectedClass) {
      setRollList([])
      return
    }

    setLoadingRolls(true)
    enrollmentsAPI.getRollList(selectedClass, selectedYear)
      .then(r => setRollList(r.data || []))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoadingRolls(false))
  }, [selectedYear, selectedClass])

  useEffect(() => {
    if (!selectedStudent) {
      setHistory([])
      return
    }

    setLoadingHistory(true)
    enrollmentsAPI.getHistory(selectedStudent)
      .then(r => setHistory(r.data || []))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoadingHistory(false))
  }, [selectedStudent])

  const handleReassign = async () => {
    if (!selectedYear || !selectedClass) return
    setReassigning(true)
    try {
      const r = await enrollmentsAPI.reassignRolls(parseInt(selectedClass), parseInt(selectedYear), strategy)
      toast.success(`${r.data.reassigned} roll numbers reassigned`)
      const refreshed = await enrollmentsAPI.getRollList(selectedClass, selectedYear)
      setRollList(refreshed.data || [])
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setReassigning(false)
    }
  }

  const classOptions = classes
    .filter(c => !selectedYear || String(c.academic_year_id) === String(selectedYear))
    .map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const yearOptions = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))
  const studentOptions = students.map(s => ({ value: String(s.id), label: `${s.name_en} (${s.student_id})` }))

  return (
    <div>
      <PageHeader
        title="Enrollments"
        subtitle={selectedYearMeta?.label ? `Browse placements, roll lists, and history for ${selectedYearMeta.label}` : 'Browse year-scoped enrollments, class roll lists, and student history'}
      />
      {isClosedYear && (
        <ReadonlyBanner
          yearLabel={selectedYearMeta?.label}
          reason="This academic year is closed. Enrollment records can be reviewed, but roll reassignment is disabled."
        />
      )}

      <FilterRow>
        <Select
          label="Academic Year"
          value={selectedYear}
          onChange={e => {
            setSelectedYearId(e.target.value)
            setSelectedClass('')
          }}
          options={yearOptions}
          placeholder="Select year"
          style={{ minWidth: '180px', flex: '1 1 180px' }}
        />
        <Select
          label="Class"
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          options={classOptions}
          placeholder="All classes"
          style={{ minWidth: '180px', flex: '1 1 180px' }}
        />
        <Select
          label="Student History"
          value={selectedStudent}
          onChange={e => setSelectedStudent(e.target.value)}
          options={studentOptions}
          placeholder="Select student"
          style={{ minWidth: '220px', flex: '1 1 220px' }}
        />
      </FilterRow>

      {!selectedYear && !yearLoading && (
        <div className="card"><ScreenState type="no-year" /></div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Enrollment List</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{enrollments.length} records</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <table className="data-table"><TableSkeleton rows={6} cols={6} /></table>
            ) : enrollments.length === 0 ? (
              <ScreenState
                type="empty"
                title="No enrollments found"
                description={selectedClass ? 'This class has no enrollments in the selected academic year.' : 'No enrollments exist for the selected academic year.'}
              />
            ) : (
              <table className="data-table" style={{ minWidth: '720px' }}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Code</th>
                    <th>Class</th>
                    <th>Roll</th>
                    <th>Status</th>
                    <th>Year</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 700 }}>{row.student_name || '—'}</td>
                      <td className="mono">{row.student_code || '—'}</td>
                      <td>{row.class_name ? `${row.class_name} — ${row.division}` : row.class_id}</td>
                      <td>{row.roll_number || '—'}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>{row.academic_year_label || row.academic_year_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Class Roll List</div>
              {isAdmin && selectedClass && selectedYear && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select className="input" value={strategy} onChange={e => setStrategy(e.target.value)} style={{ minWidth: '150px', padding: '6px 8px', fontSize: '12px' }}>
                    {ROLL_STRATEGIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <button className="btn btn-secondary btn-sm" onClick={handleReassign} disabled={reassigning || isClosedYear}>
                    {reassigning ? 'Updating...' : 'Reassign'}
                  </button>
                </div>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              {loadingRolls ? (
                <table className="data-table"><TableSkeleton rows={5} cols={4} /></table>
              ) : rollList.length === 0 ? (
                <ScreenState type="no-class" title="No roll list loaded" description="Choose a class to view ordered enrollments." />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th>Student</th>
                      <th>GR</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollList.map(row => (
                      <tr key={row.enrollment_id}>
                        <td>{row.roll_number || '—'}</td>
                        <td style={{ fontWeight: 700 }}>{row.student_name}</td>
                        <td className="mono">{row.gr_number || '—'}</td>
                        <td><StatusBadge status={row.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Student Enrollment History</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{history.length} entries</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {loadingHistory ? (
                <table className="data-table"><TableSkeleton rows={4} cols={5} /></table>
              ) : history.length === 0 ? (
                <ScreenState type="empty" title="No history selected" description="Choose a student to see year-by-year placement." />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Class</th>
                      <th>Roll</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(row => (
                      <tr key={row.id}>
                        <td>{row.academic_year_label || row.academic_year_id}</td>
                        <td>{row.class_name ? `${row.class_name} — ${row.division}` : row.class_id}</td>
                        <td>{row.roll_number || '—'}</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td>{row.promotion_action || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
