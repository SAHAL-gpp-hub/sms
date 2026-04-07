import { useState, useEffect } from 'react'
import { setupAPI, attendanceAPI } from '../../services/api'

const STATUS_OPTIONS = [
  { value: 'P', label: 'Present', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'A', label: 'Absent', color: 'bg-rose-100 text-rose-700 border-rose-300' },
  { value: 'L', label: 'Late', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'OL', label: 'On Leave', color: 'bg-blue-100 text-blue-700 border-blue-300' },
]

export default function Attendance() {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [roster, setRoster] = useState([])
  const [statuses, setStatuses] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [view, setView] = useState('daily') // daily | monthly
  const [monthlySummary, setMonthlySummary] = useState([])
  const [monthYear, setMonthYear] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
  }, [])

  useEffect(() => {
    if (selectedClass && selectedDate && view === 'daily') {
      fetchDailyAttendance()
    }
  }, [selectedClass, selectedDate])

  const fetchDailyAttendance = async () => {
    setLoading(true)
    try {
      const r = await attendanceAPI.getDaily(selectedClass, selectedDate)
      setRoster(r.data)
      const map = {}
      r.data.forEach(s => { map[s.student_id] = s.status })
      setStatuses(map)
    } catch {}
    setLoading(false)
  }

  const fetchMonthlySummary = async () => {
    if (!selectedClass) return
    setLoading(true)
    try {
      const r = await attendanceAPI.getMonthlySummary(
        selectedClass, monthYear.year, monthYear.month
      )
      setMonthlySummary(r.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (view === 'monthly' && selectedClass) fetchMonthlySummary()
  }, [view, selectedClass, monthYear])

  const handleStatusChange = (studentId, status) => {
    setStatuses(prev => ({ ...prev, [studentId]: status }))
    setSaved(false)
  }

  const handleMarkAll = (status) => {
    const map = {}
    roster.forEach(s => { map[s.student_id] = status })
    setStatuses(map)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const entries = roster.map(s => ({
      student_id: s.student_id,
      class_id: parseInt(selectedClass),
      date: selectedDate,
      status: statuses[s.student_id] || 'P'
    }))
    await attendanceAPI.markBulk(entries)
    setSaving(false)
    setSaved(true)
  }

  const stats = {
    present: Object.values(statuses).filter(s => s === 'P').length,
    absent: Object.values(statuses).filter(s => s === 'A').length,
    late: Object.values(statuses).filter(s => s === 'L').length,
    onLeave: Object.values(statuses).filter(s => s === 'OL').length,
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">Mark daily attendance and view monthly summaries</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5 flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>Class {c.name} — {c.division}</option>)}
          </select>
        </div>

        {view === 'daily' ? (
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
            <input type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        ) : (
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Month</label>
              <select value={monthYear.month} onChange={e => setMonthYear(m => ({...m, month: parseInt(e.target.value)}))}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Year</label>
              <select value={monthYear.year} onChange={e => setMonthYear(m => ({...m, year: parseInt(e.target.value)}))}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setView('daily')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${view === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            Daily
          </button>
          <button onClick={() => setView('monthly')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${view === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            Monthly
          </button>
        </div>
      </div>

      {/* Daily View */}
      {view === 'daily' && selectedClass && (
        <>
          {/* Stats row */}
          {roster.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Present', count: stats.present, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Absent', count: stats.absent, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Late', count: stats.late, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'On Leave', count: stats.onLeave, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center border border-slate-100`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm font-semibold text-slate-700">
                Attendance Roster — {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 mr-1">Mark all:</span>
                {STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => handleMarkAll(opt.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border ${opt.color}`}>
                    All {opt.label}
                  </button>
                ))}
                <div className="w-px h-5 bg-slate-200 mx-1"></div>
                {saved && <span className="text-emerald-600 text-xs font-medium">✓ Saved</span>}
                <button onClick={handleSave} disabled={saving || roster.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-slate-400">Loading roster...</div>
            ) : roster.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p className="text-3xl mb-2">📅</p>
                <p className="font-medium text-slate-600">No students found in this class</p>
                <p className="text-sm mt-1">Add students to this class first</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Roll</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {roster.map(student => (
                    <tr key={student.student_id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-500 font-mono">{student.roll_number || '—'}</td>
                      <td className="px-5 py-3 font-medium text-slate-700">{student.student_name}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => handleStatusChange(student.student_id, opt.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                statuses[student.student_id] === opt.value
                                  ? opt.color + ' shadow-sm scale-105'
                                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {opt.value}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Monthly View */}
      {view === 'monthly' && selectedClass && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">
              Monthly Summary — {MONTHS[monthYear.month - 1]} {monthYear.year}
            </h2>
          </div>
          {loading ? (
            <div className="p-10 text-center text-slate-400">Loading...</div>
          ) : monthlySummary.length === 0 ? (
            <div className="p-10 text-center text-slate-400">No attendance records for this month.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Roll', 'Student', 'Working Days', 'Present', 'Absent', 'Late', '%', 'Status'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {monthlySummary.map(s => (
                  <tr key={s.student_id} className={`hover:bg-slate-50 ${s.low_attendance ? 'bg-rose-50' : ''}`}>
                    <td className="px-5 py-3 text-slate-500 font-mono">{s.roll_number || '—'}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{s.student_name}</td>
                    <td className="px-5 py-3 text-slate-600">{s.total_working_days}</td>
                    <td className="px-5 py-3 text-emerald-600 font-semibold">{s.days_present}</td>
                    <td className="px-5 py-3 text-rose-600 font-semibold">{s.days_absent}</td>
                    <td className="px-5 py-3 text-amber-600">{s.days_late}</td>
                    <td className="px-5 py-3 font-bold text-slate-700">{s.percentage}%</td>
                    <td className="px-5 py-3">
                      {s.low_attendance ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-medium">⚠️ Low</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">✓ Good</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!selectedClass && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-slate-400">
          <p className="text-3xl mb-2">📅</p>
          <p className="font-medium text-slate-600">Select a class to mark or view attendance</p>
        </div>
      )}
    </div>
  )
}