import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feeAPI, studentAPI } from '../../services/api'

const PAYMENT_MODES = ['Cash', 'Cheque', 'DD', 'UPI']

export default function StudentFees() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ledger, setLedger] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [payForm, setPayForm] = useState({ student_fee_id: '', amount_paid: '', mode: 'Cash', payment_date: new Date().toISOString().split('T')[0], collected_by: '' })
  const [paying, setPaying] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [l, p] = await Promise.all([
        feeAPI.getLedger(id),
        feeAPI.getPayments(id)
      ])
      setLedger(l.data)
      setPayments(p.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

const handlePay = async () => {
  if (!payForm.student_fee_id || !payForm.amount_paid) {
    alert('Please select a fee and enter an amount')
    return
  }
  if (parseFloat(payForm.amount_paid) <= 0) {
    alert('Amount must be greater than 0')
    return
  }
  setPaying(true)
  try {
    await feeAPI.recordPayment({
      student_fee_id: parseInt(payForm.student_fee_id),
      amount_paid: parseFloat(payForm.amount_paid),
      mode: payForm.mode,
      payment_date: payForm.payment_date,
      collected_by: payForm.collected_by || null
    })
    setShowPayForm(false)
    setPayForm({
      student_fee_id: '',
      amount_paid: '',
      mode: 'Cash',
      payment_date: new Date().toISOString().split('T')[0],
      collected_by: ''
    })
    await fetchData()
    alert('✅ Payment recorded successfully!')
  } catch (err) {
    alert(err.response?.data?.detail || 'Payment failed — check all fields')
  }
  setPaying(false)
}
  if (loading) return <div className="p-10 text-center text-slate-400">Loading...</div>
  if (!ledger) return <div className="p-10 text-center text-slate-400">Student not found</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/fees/defaulters')}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{ledger.student_name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">Fee Ledger</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Due', value: ledger.total_due, color: 'text-slate-800' },
          { label: 'Total Paid', value: ledger.total_paid, color: 'text-emerald-600' },
          { label: 'Balance', value: ledger.total_balance, color: ledger.total_balance > 0 ? 'text-rose-600' : 'text-emerald-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>₹{parseFloat(c.value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Fee items */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Fee Breakdown</h2>
          <button onClick={() => setShowPayForm(!showPayForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Record Payment
          </button>
        </div>

        {showPayForm && (
          <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">New Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Fee Head</label>
                <select value={payForm.student_fee_id} onChange={e => setPayForm(f => ({...f, student_fee_id: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select fee...</option>
                  {ledger.items.map(item => (
                    <option key={item.student_fee_id} value={item.student_fee_id}>
                      {item.fee_head_name} (Balance: ₹{parseFloat(item.balance).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
                <input type="number" value={payForm.amount_paid} onChange={e => setPayForm(f => ({...f, amount_paid: e.target.value}))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment Mode</label>
                <select value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment Date</label>
                <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({...f, payment_date: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Collected By</label>
                <input type="text" value={payForm.collected_by} onChange={e => setPayForm(f => ({...f, collected_by: e.target.value}))}
                  placeholder="Staff name (optional)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handlePay} disabled={paying}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {paying ? 'Saving...' : 'Save Payment'}
                </button>
                <button onClick={() => setShowPayForm(false)}
                  className="px-5 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Fee Head', 'Frequency', 'Due', 'Paid', 'Balance', 'Status'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ledger.items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">No fees assigned yet. Set up fee structure first.</td></tr>
            ) : ledger.items.map(item => (
              <tr key={item.student_fee_id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-700">{item.fee_head_name}</td>
                <td className="px-5 py-3 text-slate-500 text-xs">{item.frequency}</td>
                <td className="px-5 py-3 text-slate-700">₹{parseFloat(item.net_amount).toLocaleString()}</td>
                <td className="px-5 py-3 text-emerald-600">₹{parseFloat(item.paid_amount).toLocaleString()}</td>
                <td className="px-5 py-3 font-semibold text-rose-600">₹{parseFloat(item.balance).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    parseFloat(item.balance) <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {parseFloat(item.balance) <= 0 ? 'Paid' : 'Due'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Payment History</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Receipt No.', 'Date', 'Amount', 'Mode', 'Collected By'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-blue-600 text-xs">{p.receipt_number}</td>
                  <td className="px-5 py-3 text-slate-600">{p.payment_date}</td>
                  <td className="px-5 py-3 font-semibold text-emerald-600">₹{parseFloat(p.amount_paid).toLocaleString()}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{p.mode}</span></td>
                  <td className="px-5 py-3 text-slate-500">{p.collected_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}