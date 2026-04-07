import { useState, useEffect } from 'react'
import { setupAPI, yearendAPI, classAPI } from '../../services/api'

function Section({ icon, title, description, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function YearEnd() {
  const [classes, setClasses] = useState([])
  const [years, setYears] = useState([])
  const [currentYear, setCurrentYear] = useState(null)

  // Promotion state
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedNewYear, setSelectedNewYear] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [promoteResult, setPromoteResult] = useState(null)

  // New year state
  const [newYear, setNewYear] = useState({ label: '', start_date: '', end_date: '' })
  const [creatingYear, setCreatingYear] = useState(false)
  const [yearCreated, setYearCreated] = useState(null)

  // Class division management state  ← THIS WAS MISSING
  const [classYear, setClassYear] = useState('')
  const [classesForYear, setClassesForYear] = useState([])
  const [newClass, setNewClass] = useState({ name: '', division: 'A' })
  const [addingClass, setAddingClass] = useState(false)

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setCurrentYear(curr)
    })
  }, [])

  useEffect(() => {
    if (classYear) {
      setupAPI.getClasses(classYear).then(r => setClassesForYear(r.data))
    } else {
      setClassesForYear([])
    }
  }, [classYear])

  const handlePromote = async () => {
    if (!selectedClass || !selectedNewYear) return
    if (!confirm('This will move all students in this class to the next class. Continue?')) return
    setPromoting(true)
    try {
      const r = await yearendAPI.promoteClass(selectedClass, selectedNewYear)
      setPromoteResult(r.data)
    } catch (err) {
      alert(err.response?.data?.detail || 'Promotion failed')
    }
    setPromoting(false)
  }

  const handleCreateYear = async () => {
    if (!newYear.label || !newYear.start_date || !newYear.end_date) {
      alert('Please fill all fields')
      return
    }
    setCreatingYear(true)
    try {
      const r = await yearendAPI.createNewYear(newYear)
      setYearCreated(r.data)
      const yearsRes = await setupAPI.getAcademicYears()
      setYears(yearsRes.data)
      const curr = yearsRes.data.find(y => y.is_current)
      if (curr) setCurrentYear(curr)
      setNewYear({ label: '', start_date: '', end_date: '' })
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create year')
    }
    setCreatingYear(false)
  }

  const handleAddClass = async () => {
    if (!classYear || !newClass.name) return
    setAddingClass(true)
    try {
      await classAPI.create({ ...newClass, academic_year_id: parseInt(classYear) })
      const r = await setupAPI.getClasses(classYear)
      setClassesForYear(r.data)
      setNewClass({ name: '', division: 'A' })
    } catch (err) {
      alert('Failed to add class')
    }
    setAddingClass(false)
  }

  const handleDeleteClass = async (cls) => {
    if (!confirm(`Delete Class ${cls.name} — Div ${cls.division}?`)) return
    await classAPI.delete(cls.id)
    setClassesForYear(prev => prev.filter(x => x.id !== cls.id))
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Year-End Management</h1>
        <p className="text-slate-500 text-sm mt-1">
          End-of-year workflows — create new academic year, manage classes, promote students, issue TCs
        </p>
        {currentYear && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
            <span className="text-xs font-semibold text-blue-700">Current Year: {currentYear.label}</span>
          </div>
        )}
      </div>

      <div className="space-y-5">

        {/* Step 1: Create new academic year */}
        <Section
          icon="📅"
          title="Step 1 — Create New Academic Year"
          description="Set up the next academic year. This becomes the active year."
        >
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Year Label (e.g. 2026-27)
              </label>
              <input
                type="text"
                value={newYear.label}
                onChange={e => setNewYear(y => ({...y, label: e.target.value}))}
                placeholder="2026-27"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
              <input
                type="date"
                value={newYear.start_date}
                onChange={e => setNewYear(y => ({...y, start_date: e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
              <input
                type="date"
                value={newYear.end_date}
                onChange={e => setNewYear(y => ({...y, end_date: e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {yearCreated && (
            <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
              ✅ Academic year <strong>{yearCreated.label}</strong> created and set as current year. All classes auto-created.
            </div>
          )}

          <button
            onClick={handleCreateYear}
            disabled={creatingYear || !newYear.label}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {creatingYear ? 'Creating...' : 'Create New Academic Year'}
          </button>
        </Section>

        {/* Class Division Management */}
        <Section
          icon="🏫"
          title="Class Division Management"
          description="Add or remove class divisions (e.g. Class 5 — A, B, C, D)"
        >
          <div className="flex gap-4 items-end flex-wrap mb-4">
            <div className="min-w-36">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Academic Year</label>
              <select
                value={classYear}
                onChange={e => setClassYear(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select year...</option>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (Current)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="min-w-36">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Standard</label>
              <select
                value={newClass.name}
                onChange={e => setNewClass(c => ({...c, name: e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'].map(n => (
                  <option key={n} value={n}>Std {n}</option>
                ))}
              </select>
            </div>
            <div className="min-w-24">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Division</label>
              <select
                value={newClass.division}
                onChange={e => setNewClass(c => ({...c, division: e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['A','B','C','D','E'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <button
              onClick={handleAddClass}
              disabled={!classYear || !newClass.name || addingClass}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {addingClass ? 'Adding...' : '+ Add Division'}
            </button>
          </div>

          {classYear && classesForYear.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No classes found for this year.</p>
          )}

          {classesForYear.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Standard</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Division</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...classesForYear]
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}))
                    .map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">Std {c.name}</td>
                        <td className="px-4 py-3 text-slate-500">Division {c.division}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteClass(c)}
                            className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Step 2: Bulk promote */}
        <Section
          icon="🎓"
          title="Step 2 — Bulk Student Promotion"
          description="Move all students in a class to the next standard in the new academic year"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-xs text-amber-700 font-medium">
            ⚠️ This action moves ALL active students from the selected class to the next class. Do this after creating the new academic year.
          </div>

          <div className="flex gap-4 items-end flex-wrap mb-4">
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Promote From Class</label>
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>Class {c.name} — {c.division}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Into Academic Year</label>
              <select value={selectedNewYear} onChange={e => setSelectedNewYear(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select year...</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (Current)' : ''}</option>)}
              </select>
            </div>
            <button
              onClick={handlePromote}
              disabled={promoting || !selectedClass || !selectedNewYear}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {promoting ? 'Promoting...' : 'Promote Students'}
            </button>
          </div>

          {promoteResult && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              ✅ <strong>{promoteResult.promoted}</strong> students promoted from{' '}
              <strong>Std {promoteResult.from_class}</strong> to{' '}
              <strong>Std {promoteResult.to_class}</strong>
            </div>
          )}
        </Section>

        {/* Step 3: TC */}
        <Section
          icon="📄"
          title="Step 3 — Transfer Certificates"
          description="Issue TCs to leaving students. TC button is available on the Students page."
        >
          <p className="text-sm text-slate-600 mb-4">
            To generate a Transfer Certificate for a student, go to the <strong>Students</strong> page,
            find the student, and click the <strong>TC</strong> button in the Actions column.
            The TC PDF will open directly in your browser ready to print.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600 mb-4">
            <strong>TC includes:</strong> Student details, GR number, class last studied, date of leaving,
            reason for leaving, conduct certificate, and signature spaces for Class Teacher and Principal.
          </div>
          <a href="/students" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
            Go to Students →
          </a>
        </Section>

        {/* Academic Years overview */}
        <Section
          icon="📚"
          title="Academic Years"
          description="All academic years in the system"
        >
          {years.length === 0 ? (
            <p className="text-sm text-slate-400">No academic years found.</p>
          ) : (
            <div className="space-y-2">
              {years.map(y => (
                <div key={y.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{y.label}</span>
                    {y.is_current && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Current</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}