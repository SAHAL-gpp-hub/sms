import { useState, useEffect } from 'react'
import { setupAPI, marksAPI } from '../../services/api'

export default function Reports() {
  const [classes, setClasses] = useState([])
  const [years, setYears] = useState([])
  const [exams, setExams] = useState([])
  const [currentYear, setCurrentYear] = useState(null)

  const [attClass, setAttClass] = useState('')
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1)
  const [attYear, setAttYear] = useState(new Date().getFullYear())

  const [resultClass, setResultClass] = useState('')
  const [resultExam, setResultExam] = useState('')

  const MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December']

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setCurrentYear(curr)
    })
  }, [])

  useEffect(() => {
    if (resultClass && currentYear) {
      marksAPI.getExams({ class_id: resultClass, academic_year_id: currentYear.id })
        .then(r => setExams(r.data))
    }
  }, [resultClass])

  const openPDF = (url) => window.open(url, '_blank')

  const ReportCard = ({ icon, title, description, children }) => (
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Generate and download PDF reports</p>
      </div>

      <div className="space-y-5">

        {/* Fee Defaulter Report */}
        <ReportCard
          icon="💰"
          title="Fee Defaulter Report"
          description="List of all students with outstanding fee balance"
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-slate-600">
                Generates a complete list of fee defaulters for the current academic year
                {currentYear && ` (${currentYear.label})`}, including total due, paid, and balance amounts.
              </p>
            </div>
            <button
              onClick={() => openPDF(`/api/v1/pdf/report/defaulters${currentYear ? `?academic_year_id=${currentYear.id}` : ''}`)}
              className="px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          </div>
        </ReportCard>

        {/* Attendance Report */}
        <ReportCard
          icon="📅"
          title="Monthly Attendance Report"
          description="Class-wise monthly attendance summary with low attendance flags"
        >
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
              <select value={attClass} onChange={e => setAttClass(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>Class {c.name} — {c.division}</option>)}
              </select>
            </div>
            <div className="min-w-36">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Month</label>
              <select value={attMonth} onChange={e => setAttMonth(parseInt(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="min-w-24">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Year</label>
              <select value={attYear} onChange={e => setAttYear(parseInt(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              disabled={!attClass}
              onClick={() => openPDF(`/api/v1/pdf/report/attendance?class_id=${attClass}&year=${attYear}&month=${attMonth}`)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          </div>
        </ReportCard>

        {/* Class Result Report */}
        <ReportCard
          icon="📝"
          title="Class Result Report"
          description="Complete class result with subject-wise marks, grades and rankings"
        >
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
              <select value={resultClass} onChange={e => { setResultClass(e.target.value); setResultExam('') }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>Class {c.name} — {c.division}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Exam</label>
              <select value={resultExam} onChange={e => setResultExam(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select exam...</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <button
              disabled={!resultClass || !resultExam}
              onClick={() => openPDF(`/api/v1/pdf/report/results?exam_id=${resultExam}&class_id=${resultClass}`)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          </div>
        </ReportCard>

        {/* Marksheet shortcut */}
        <ReportCard
          icon="🎓"
          title="Student Marksheets"
          description="Individual or bulk GSEB-style marksheet PDFs"
        >
          <p className="text-sm text-slate-600 mb-4">
            Marksheet PDFs are generated from the <strong>Marks</strong> page. Go to Marks → select class and exam → click View Results → use the PDF buttons.
          </p>
          <a href="/marks"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
            Go to Marks page →
          </a>
        </ReportCard>

      </div>
    </div>
  )
}