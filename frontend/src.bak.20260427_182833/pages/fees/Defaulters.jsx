import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { feeAPI, setupAPI } from '../../services/api'

export default function Defaulters() {
  const [defaulters, setDefaulters] = useState([])
  const [classes, setClasses] = useState([])
  const [years, setYears] = useState([])
  const [classFilter, setClassFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setYearFilter(String(curr.id))
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (classFilter) params.class_id = classFilter
    if (yearFilter) params.academic_year_id = yearFilter
    feeAPI.getDefaulters(params).then(r => {
      setDefaulters(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [classFilter, yearFilter])

  const totalBalance = defaulters.reduce((s, d) => s + d.balance, 0)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Fee Defaulters</h1>
        <p className="text-slate-500 text-sm mt-1">Students with outstanding fee balance</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5 flex gap-4 flex-wrap">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Academic Year</label>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Years</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      {defaulters.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Defaulters</p>
            <p className="text-3xl font-bold text-rose-600 mt-1">{defaulters.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Outstanding</p>
            <p className="text-3xl font-bold text-rose-600 mt-1">₹{totalBalance.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Loading...</div>
        ) : defaulters.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-medium text-slate-600">No defaulters found!</p>
            <p className="text-sm mt-1">All fees are cleared for the selected filters.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Student', 'Class', 'Contact', 'Total Due', 'Paid', 'Balance', 'Action'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {defaulters.map(d => (
                <tr key={d.student_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{d.student_name}</td>
                  <td className="px-5 py-3 text-slate-500">Class {d.class_name}</td>
                  <td className="px-5 py-3 text-slate-500">{d.contact}</td>
                  <td className="px-5 py-3 text-slate-700">₹{d.total_due.toLocaleString()}</td>
                  <td className="px-5 py-3 text-emerald-600">₹{d.total_paid.toLocaleString()}</td>
                  <td className="px-5 py-3 font-bold text-rose-600">₹{d.balance.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <Link to={`/fees/student/${d.student_id}`}
                      className="text-blue-600 hover:underline text-xs font-medium">
                      View Ledger →
                    </Link>
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