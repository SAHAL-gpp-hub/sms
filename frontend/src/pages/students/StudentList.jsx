import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { studentAPI, setupAPI } from '../../services/api'

export default function StudentList() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  // Fetch students
  const fetchStudents = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (classFilter) params.class_id = classFilter

      const res = await studentAPI.list(params)
      setStudents(res.data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  // Fetch classes
  const fetchClasses = async () => {
    try {
      const res = await setupAPI.getClasses()
      setClasses(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  // Seed initial data
  const handleSeed = async () => {
    setSeeding(true)
    try {
      await setupAPI.seed()
      await fetchClasses()
      alert('Database seeded with classes and academic year!')
    } catch (err) {
      console.error(err)
    }
    setSeeding(false)
  }

  // Delete student (mark as left)
  const handleDelete = async (id, name) => {
    if (!confirm(`Mark ${name} as Left?`)) return
    await studentAPI.delete(id)
    fetchStudents()
  }

  useEffect(() => {
    fetchClasses()
    fetchStudents()
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [search, classFilter])

  return (
    <div className="p-4">

      {/* 🔹 Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Left */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Students</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {students.length} students enrolled
          </p>
        </div>

        {/* Right */}
        <div className="flex gap-2 flex-wrap">
          {classes.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition"
            >
              {seeding ? 'Setting up...' : '⚙️ Setup Classes'}
            </button>
          )}

          <Link to="/students/new">
            <button
              type="button"
              data-testid="add-student"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + Add Student
            </button>
          </Link>
        </div>
      </div>

      {/* 🔹 Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, GR no, contact..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              Class {c.name} - {c.division}
            </option>
          ))}
        </select>
      </div>

      {/* 🔹 Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading...</div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p className="text-4xl mb-2">🎓</p>
            <p className="font-medium">No students found</p>
            <p className="text-sm mt-1">
              Click "+ Add Student" to register the first student
            </p>
          </div>
        ) : (
          <table className="w-full text-sm border-separate border-spacing-y-1">
            
            {/* Table Head */}
            <thead className="bg-gray-50">
              <tr>
                {['Student ID', 'Name', 'Class', 'Father', 'Contact', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="bg-white hover:bg-gray-50 transition rounded-lg shadow-sm">
                  
                  <td className="px-4 py-3 font-mono text-blue-600 text-xs">
                    {s.student_id}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{s.name_en}</div>
                    <div className="text-gray-400 text-xs">{s.name_gu}</div>
                  </td>

                  <td className="px-4 py-3 text-gray-600">
                    {classes.find((c) => c.id === s.class_id)?.name || s.class_id}
                  </td>

                  <td className="px-4 py-3 text-gray-600">
                    {s.father_name}
                  </td>

                  <td className="px-4 py-3 text-gray-600">
                    {s.contact}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>

                  <td className="px-4 py-3">
  <div className="flex gap-2 items-center flex-wrap">
  <Link to={`/students/${s.id}/edit`} 
    className="text-blue-600 hover:underline text-xs font-medium">Edit</Link>
  <span className="text-slate-200">|</span>
  <Link to={`/fees/student/${s.id}`}
    className="text-emerald-600 hover:underline text-xs font-medium">💰 Fees</Link>
  <span className="text-slate-200">|</span>
  <button
    onClick={() => window.open(`/api/v1/yearend/tc-pdf/${s.id}`, '_blank')}
    className="text-slate-500 hover:underline text-xs font-medium">TC</button>
  <span className="text-slate-200">|</span>
  <button onClick={() => handleDelete(s.id, s.name_en)} 
    className="text-rose-500 hover:underline text-xs font-medium">Remove</button>
</div>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        )}
      </div>
    </div>
  )
}
