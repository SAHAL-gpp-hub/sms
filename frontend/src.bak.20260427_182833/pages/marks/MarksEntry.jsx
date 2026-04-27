import { useState, useEffect } from 'react'
import { marksAPI, setupAPI } from '../../services/api'

const EXAM_TYPES = ["Unit Test 1", "Unit Test 2", "Half-Yearly", "Annual", "Practical"]

export default function MarksEntry() {
  const [classes, setClasses] = useState([])
  const [years, setYears] = useState([])
  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedExam, setSelectedExam] = useState('')
  const [gridData, setGridData] = useState(null)
  const [localMarks, setLocalMarks] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showNewExam, setShowNewExam] = useState(false)
  const [newExam, setNewExam] = useState({ name: 'Unit Test 1', exam_date: '' })
  const [view, setView] = useState('entry') // entry | results
  const [results, setResults] = useState([])

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setSelectedYear(String(curr.id))
    })
  }, [])

  useEffect(() => {
    if (selectedClass && selectedYear) {
      marksAPI.getExams({ class_id: selectedClass, academic_year_id: selectedYear })
        .then(r => setExams(r.data))
      marksAPI.getSubjects(selectedClass)
        .then(r => setSubjects(r.data))
    }
  }, [selectedClass, selectedYear])

  useEffect(() => {
    if (selectedExam && selectedClass) {
      marksAPI.getMarksEntry(selectedExam, selectedClass).then(r => {
        setGridData(r.data)
        // Build local marks map
        const map = {}
        r.data.students.forEach(s => {
          map[s.student_id] = {}
          Object.entries(s.marks).forEach(([subId, m]) => {
            map[s.student_id][subId] = { theory: m.theory ?? '', practical: m.practical ?? '', is_absent: m.is_absent }
          })
        })
        setLocalMarks(map)
      })
      if (view === 'results') {
        marksAPI.getResults(selectedExam, selectedClass).then(r => setResults(r.data))
      }
    }
  }, [selectedExam, selectedClass, view])

  const handleMarkChange = (studentId, subjectId, field, value) => {
    setLocalMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: {
          ...prev[studentId]?.[subjectId],
          [field]: value
        }
      }
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!gridData) return
    setSaving(true)
    const entries = []
    gridData.students.forEach(s => {
      gridData.subjects.forEach(sub => {
        const m = localMarks[s.student_id]?.[sub.id]
        entries.push({
          student_id: s.student_id,
          subject_id: sub.id,
          exam_id: parseInt(selectedExam),
          theory_marks: m?.theory !== '' && m?.theory !== undefined ? parseFloat(m.theory) : null,
          practical_marks: m?.practical !== '' && m?.practical !== undefined ? parseFloat(m.practical) : null,
          is_absent: m?.is_absent || false,
        })
      })
    })
    await marksAPI.bulkSaveMarks(entries)
    setSaving(false)
    setSaved(true)
  }

  const handleSeedSubjects = async () => {
    await marksAPI.seedSubjects(selectedClass)
    const r = await marksAPI.getSubjects(selectedClass)
    setSubjects(r.data)
    alert('GSEB subjects loaded!')
  }

  const handleCreateExam = async () => {
    await marksAPI.createExam({
      name: newExam.name,
      class_id: parseInt(selectedClass),
      academic_year_id: parseInt(selectedYear),
      exam_date: newExam.exam_date || null,
    })
    const r = await marksAPI.getExams({ class_id: selectedClass, academic_year_id: selectedYear })
    setExams(r.data)
    setShowNewExam(false)
  }

  const handleViewResults = async () => {
    setView('results')
    const r = await marksAPI.getResults(selectedExam, selectedClass)
    setResults(r.data)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Marks Entry</h1>
        <p className="text-slate-500 text-sm mt-1">Enter marks class-wise. Grades are calculated automatically per GSEB rules.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5 flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedExam(''); setGridData(null) }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>Class {c.name} — {c.division}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Academic Year</label>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Exam</label>
          <div className="flex gap-2">
            <select value={selectedExam} onChange={e => { setSelectedExam(e.target.value); setView('entry') }}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select exam...</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={() => setShowNewExam(!showNewExam)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 text-sm font-medium">
              + New
            </button>
          </div>
        </div>
        {selectedClass && subjects.length === 0 && (
          <button onClick={handleSeedSubjects}
            className="px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
            Load GSEB Subjects
          </button>
        )}
      </div>

      {/* New exam form */}
      {showNewExam && selectedClass && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Create New Exam</p>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-40">
              <label className="block text-xs text-slate-500 mb-1">Exam Type</label>
              <select value={newExam.name} onChange={e => setNewExam(n => ({...n, name: e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="w-44">
              <label className="block text-xs text-slate-500 mb-1">Exam Date (optional)</label>
              <input type="date" value={newExam.exam_date} onChange={e => setNewExam(n => ({...n, exam_date: e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={handleCreateExam}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Create Exam
            </button>
            <button onClick={() => setShowNewExam(false)}
              className="px-5 py-2.5 border border-slate-200 text-slate-500 rounded-lg text-sm hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Marks grid or Results */}
      {selectedExam && gridData && (
        <>
          {/* Tab switcher */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setView('entry')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'entry' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              📝 Marks Entry
            </button>
            <button onClick={handleViewResults}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'results' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              📊 View Results
            </button>
          </div>

          {view === 'entry' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  Marks Grid — {exams.find(e => String(e.id) === selectedExam)?.name}
                </h2>
                <div className="flex items-center gap-3">
                  {saved && <span className="text-emerald-600 text-xs font-medium">✓ Saved</span>}
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save All Marks'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                {/* Legend */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">How to use:</span>
                  <span>• Enter marks in the boxes (T = Theory, P = Practical)</span>
                  <span>• <strong>AB</strong> = Mark student as Absent for that subject</span>
                  <span>• Click <strong>Save All Marks</strong> when done</span>
                </div>
                <table className="text-xs min-w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-slate-500 font-semibold sticky left-0 bg-slate-50 min-w-36">Student</th>
                      <th className="text-left px-3 py-3 text-slate-500 font-semibold w-16">Roll</th>
                                      {gridData.subjects.map(sub => (
                    <th key={sub.id} className="px-2 py-3 text-slate-500 font-semibold text-center min-w-32">
                      <div className="text-xs">{sub.name}</div>
                      <div className="text-slate-400 font-normal mt-0.5 text-xs">
                        Theory/{sub.max_theory}
                        {sub.max_practical > 0 ? ` · Prac/${sub.max_practical}` : ''}
                      </div>
                    </th>
                  ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {gridData.students.map(student => (
                      <tr key={student.student_id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700 sticky left-0 bg-white">{student.student_name}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-center">{student.roll_number || '—'}</td>
                        {gridData.subjects.map(sub => {
                          const m = localMarks[student.student_id]?.[sub.id] || {}
                          return (
                            <td key={sub.id} className="px-2 py-2 text-center">
                              <div className="flex gap-1 items-center justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={sub.max_theory}
                                  value={m.theory ?? ''}
                                  onChange={e => handleMarkChange(student.student_id, sub.id, 'theory', e.target.value)}
                                  disabled={m.is_absent}
                                  placeholder={`/${sub.max_theory}`}
                                  className="w-14 border border-slate-200 rounded px-1.5 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                                {sub.max_practical > 0 && (
                                  <input
                                    type="number"
                                    min="0"
                                    max={sub.max_practical}
                                    value={m.practical ?? ''}
                                    onChange={e => handleMarkChange(student.student_id, sub.id, 'practical', e.target.value)}
                                    disabled={m.is_absent}
                                    placeholder={`/${sub.max_practical}`}
                                    className="w-14 border border-slate-200 rounded px-1.5 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                  />
                                )}
                          <label className="flex items-center gap-0.5 cursor-pointer" title="Mark as Absent">
                              <input
                                type="checkbox"
                                checked={m.is_absent || false}
                                onChange={e => handleMarkChange(student.student_id, sub.id, 'is_absent', e.target.checked)}
                                className="w-3 h-3 accent-rose-500"
                              />
                              <span className="text-xs text-rose-400 font-medium">Absent</span>
                          </label>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'results' && results.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* CHANGED: header now flex with Download Class PDF button */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  Results — {exams.find(e => String(e.id) === selectedExam)?.name}
                </h2>
                <a
                  href={`/api/v1/pdf/marksheet/class/${selectedClass}?exam_id=${selectedExam}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Class PDF
                </a>
              </div>
              <div className="overflow-x-auto">
                <table className="text-sm min-w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {/* CHANGED: added 'PDF' to headers */}
                      {['Rank', 'Student', 'Roll', 'Total', 'Max', '%', 'CGPA', 'Grade', 'Result', 'PDF'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {results.map(r => (
                      <tr key={r.student_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-500">#{r.class_rank}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{r.student_name}</td>
                        <td className="px-4 py-3 text-slate-500">{r.roll_number || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{r.total_marks}</td>
                        <td className="px-4 py-3 text-slate-500">{r.max_marks}</td>
                        <td className="px-4 py-3 font-semibold text-blue-600">{r.percentage}%</td>
                        <td className="px-4 py-3 text-slate-600">{r.cgpa}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold text-xs">{r.grade}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            r.result === 'PASS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {r.result}
                          </span>
                        </td>
                        {/* CHANGED: per-student PDF download link */}
                        <td className="px-4 py-3">
                          <a
                            href={`/api/v1/pdf/marksheet/student/${r.student_id}?exam_id=${selectedExam}&class_id=${selectedClass}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-rose-600 hover:underline text-xs font-medium"
                          >
                            📄 PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {selectedClass && selectedExam && !gridData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-slate-400">
          <p className="text-3xl mb-2">📝</p>
          <p>Loading marks grid...</p>
        </div>
      )}

      {!selectedClass && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-slate-400">
          <p className="text-3xl mb-2">📝</p>
          <p className="font-medium text-slate-600">Select a class and exam to start entering marks</p>
        </div>
      )}
    </div>
  )
}