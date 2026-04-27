import { useState, useEffect } from 'react'
import { feeAPI, setupAPI } from '../../services/api'

export default function FeeStructure() {
  const [classes, setClasses] = useState([])
  const [years, setYears] = useState([])
  const [feeHeads, setFeeHeads] = useState([])
  const [structures, setStructures] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [form, setForm] = useState({ fee_head_id: '', amount: '', due_date: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setSelectedYear(String(curr.id))
    })
    feeAPI.getFeeHeads().then(r => setFeeHeads(r.data))
  }, [])

  useEffect(() => {
    if (selectedClass && selectedYear) {
      feeAPI.getFeeStructures({
        class_id: selectedClass,
        academic_year_id: selectedYear
      }).then(r => setStructures(r.data))
    }
  }, [selectedClass, selectedYear])

  const handleSeedHeads = async () => {
    setSeeding(true)
    await feeAPI.seedFeeHeads()
    const r = await feeAPI.getFeeHeads()
    setFeeHeads(r.data)
    setSeeding(false)
  }

  const handleAdd = async () => {
    if (!form.fee_head_id || !form.amount || !selectedClass || !selectedYear) return
    setAdding(true)
    await feeAPI.createFeeStructure({
      class_id: parseInt(selectedClass),
      fee_head_id: parseInt(form.fee_head_id),
      amount: parseFloat(form.amount),
      due_date: form.due_date || null,
      academic_year_id: parseInt(selectedYear)
    })
    setForm({ fee_head_id: '', amount: '', due_date: '' })
    const r = await feeAPI.getFeeStructures({ class_id: selectedClass, academic_year_id: selectedYear })
    setStructures(r.data)
    setAdding(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this fee from the structure?')) return
    await feeAPI.deleteFeeStructure(id)
    setStructures(s => s.filter(x => x.id !== id))
  }

  const handleAssign = async () => {
    if (!selectedClass || !selectedYear) return
    const r = await feeAPI.assignFees(selectedClass, selectedYear)
    alert(r.data.message)
  }

  const totalAmount = structures.reduce((s, x) => s + parseFloat(x.amount), 0)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Fee Structure</h1>
        <p className="text-slate-500 text-sm mt-1">Define fee heads and amounts per class per year</p>
      </div>

      {/* Seed fee heads banner */}
      {feeHeads.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">No fee heads found</p>
            <p className="text-xs text-amber-600 mt-0.5">Load the pre-configured GSEB fee heads to get started</p>
          </div>
          <button onClick={handleSeedHeads} disabled={seeding}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
            {seeding ? 'Loading...' : 'Load Fee Heads'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5 flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>Class {c.name} — Div {c.division}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Academic Year</label>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select year...</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
        {selectedClass && selectedYear && (
          <button onClick={handleAssign}
            className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            Assign to Students
          </button>
        )}
      </div>

      {selectedClass && selectedYear && (
        <>
          {/* Add fee row */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Add Fee to Structure</p>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-40">
                <label className="block text-xs text-slate-500 mb-1">Fee Head</label>
                <select value={form.fee_head_id} onChange={e => setForm(f => ({...f, fee_head_id: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select fee head...</option>
                  {feeHeads.map(fh => <option key={fh.id} value={fh.id}>{fh.name} ({fh.frequency})</option>)}
                </select>
              </div>
              <div className="w-36">
                <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="w-40">
                <label className="block text-xs text-slate-500 mb-1">Due Date (optional)</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={handleAdd} disabled={adding}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                {adding ? 'Adding...' : '+ Add'}
              </button>
            </div>
          </div>

          {/* Structure table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Fee Structure — Class {classes.find(c => String(c.id) === selectedClass)?.name}
              </h2>
              <span className="text-sm font-bold text-slate-800">Total: ₹{totalAmount.toLocaleString()}</span>
            </div>
            {structures.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p className="text-3xl mb-2">💰</p>
                <p className="text-sm">No fee structure defined yet. Add fees above.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Fee Head', 'Frequency', 'Amount', 'Due Date', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {structures.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-700">{s.fee_head?.name}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{s.fee_head?.frequency}</span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">₹{parseFloat(s.amount).toLocaleString()}</td>
                      <td className="px-5 py-3 text-slate-500">{s.due_date || '—'}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleDelete(s.id)} className="text-rose-500 hover:text-rose-700 text-xs font-medium">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}