// Reports.jsx — Refined professional UI
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { extractError, marksAPI, openSignedPdf, reportCardsAPI, setupAPI } from '../../services/api'
import { getAuthUser } from '../../services/auth'
import { PageHeader, Select } from '../../components/UI'

/* ---------- Inline SVG icon set (replaces emojis) ---------- */
const Icons = {
  Defaulter: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinejoin="round" />
    </svg>
  ),
  Calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  ),
  Chart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 14l4-4 4 4 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Document: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 2v6h6M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  ),
  Download: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  ),
}

/* ---------- ReportCard ---------- */
function ReportCard({ icon, title, description, children, accentColor = 'var(--brand-600)' }) {
  return (
    <div
      className="card"
      style={{
        overflow: 'visible',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        borderTop: `3px solid ${accentColor}`,
      }}
    >
      <div
        style={{
          padding: 'clamp(16px, 3vw, 20px) clamp(18px, 3vw, 22px) clamp(12px, 2vw, 14px)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'clamp(12px, 2vw, 14px)',
          flexWrap: 'nowrap',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${accentColor}14`,
            color: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 'clamp(14px, 3vw, 15px)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 'clamp(12px, 2.8vw, 13px)',
              color: 'var(--text-secondary)',
              marginTop: 4,
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {description}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 'clamp(14px, 3vw, 18px) clamp(18px, 3vw, 22px) clamp(16px, 3vw, 20px)',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--surface-subtle, transparent)',
          flex: 1,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ---------- DownloadButton ---------- */
function DownloadButton({ href, label, disabled, onClick }) {
  const baseStyle = {
    width: '100%',
    justifyContent: 'center',
    textDecoration: 'none',
    fontSize: 'clamp(13px, 3vw, 14px)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    gap: 8,
    padding: '10px 16px',
  }

  if (disabled) {
    return (
      <button
        disabled
        className="btn btn-secondary"
        style={{ ...baseStyle, opacity: 0.55, cursor: 'not-allowed' }}
      >
        {Icons.Download}
        {label}
      </button>
    )
  }
  return (
    <a href={href} onClick={onClick} target="_blank" rel="noreferrer" className="btn btn-primary" style={baseStyle}>
      {Icons.Download}
      {label}
    </a>
  )
}

/* ---------- HelperText ---------- */
function HelperText({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: -4,
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      />
      {children}
    </div>
  )
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Reports() {
  const authUser = getAuthUser()
  const isAdmin = authUser?.role === 'admin'
  const [classes, setClasses] = useState([])
  const [years, setYears] = useState([])
  const [resultExams, setResultExams] = useState([])
  const [marksheetExams, setMarksheetExams] = useState([])
  const [reportCards, setReportCards] = useState([])
  const [reportCardsLoading, setReportCardsLoading] = useState(false)
  const [savingLockId, setSavingLockId] = useState(null)

  const [attClass, setAttClass] = useState('')
  const [attYear, setAttYear] = useState(new Date().getFullYear())
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1)
  const [defYear, setDefYear] = useState('')
  const [resultExam, setResultExam] = useState('')
  const [resultClass, setResultClass] = useState('')
  const [msExam, setMsExam] = useState('')
  const [msClass, setMsClass] = useState('')

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data))
    setupAPI.getAcademicYears().then(r => {
      setYears(r.data)
      const curr = r.data.find(y => y.is_current)
      if (curr) setDefYear(String(curr.id))
    })
  }, [])

  useEffect(() => {
    if (resultClass) {
      marksAPI.getExams({ class_id: resultClass }).then(r => setResultExams(r.data))
    } else {
      setResultExams([])
    }
  }, [resultClass])

  useEffect(() => {
    if (msClass) {
      marksAPI.getExams({ class_id: msClass }).then(r => setMarksheetExams(r.data))
    } else {
      setMarksheetExams([])
    }
  }, [msClass])

  useEffect(() => {
    if (!msClass || !msExam) {
      setReportCards([])
      return
    }
    setReportCardsLoading(true)
    reportCardsAPI.list({ class_id: msClass, exam_id: msExam, limit: 200 })
      .then(r => setReportCards(r.data || []))
      .catch(() => setReportCards([]))
      .finally(() => setReportCardsLoading(false))
  }, [msClass, msExam])

  const classOptions = classes.map(c => ({
    value: String(c.id),
    label: `Class ${c.name} — ${c.division}`,
  }))
  const yearOptions = years.map(y => ({
    value: String(y.id),
    label: y.label + (y.is_current ? ' (Current)' : ''),
  }))
  const resultExamOptions = resultExams.map(e => ({ value: String(e.id), label: e.name }))
  const marksheetExamOptions = marksheetExams.map(e => ({ value: String(e.id), label: e.name }))
  const calYears = [2023, 2024, 2025, 2026].map(y => ({ value: y, label: String(y) }))
  const monthOptions = MONTHS.map((m, i) => ({ value: i + 1, label: m }))

  const refreshReportCards = () => {
    if (!msClass || !msExam) return
    setReportCardsLoading(true)
    reportCardsAPI.list({ class_id: msClass, exam_id: msExam, limit: 200 })
      .then(r => setReportCards(r.data || []))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setReportCardsLoading(false))
  }

  const toggleLock = async (id, next) => {
    setSavingLockId(id)
    try {
      await reportCardsAPI.setLocked(id, next)
      refreshReportCards()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSavingLockId(null)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <PageHeader
        title="Reports"
        subtitle="Generate and download PDF reports for fees, attendance, and academic results"
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 'clamp(14px, 2vw, 18px)',
          marginTop: 8,
        }}
      >
        {/* Fee Defaulter */}
        <ReportCard
          icon={Icons.Defaulter}
          title="Fee Defaulter Report"
          description="Students with outstanding fee balances, sorted by amount due."
          accentColor="var(--danger-600)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Select
              label="Academic Year"
              value={defYear}
              onChange={e => setDefYear(e.target.value)}
              options={yearOptions}
              placeholder="All years"
            />
            <DownloadButton
              href="#"
              onClick={e => {
                e.preventDefault()
                openSignedPdf('/pdf/token/report/defaulters', '/pdf/report/defaulters', defYear ? { academic_year_id: defYear } : {})
              }}
              label="Download Report"
            />
          </div>
        </ReportCard>

        {/* Attendance */}
        <ReportCard
          icon={Icons.Calendar}
          title="Monthly Attendance Report"
          description="Class-wise monthly summary with low-attendance flags highlighted."
          accentColor="#7c3aed"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Select
              label="Class"
              value={attClass}
              onChange={e => setAttClass(e.target.value)}
              options={classOptions}
              placeholder="Select class"
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 10,
              }}
            >
              <Select
                label="Month"
                value={attMonth}
                onChange={e => setAttMonth(e.target.value)}
                options={monthOptions}
              />
              <Select
                label="Year"
                value={attYear}
                onChange={e => setAttYear(e.target.value)}
                options={calYears}
              />
            </div>
            <DownloadButton
              href="#"
              onClick={e => {
                e.preventDefault()
                openSignedPdf('/pdf/token/report/attendance', '/pdf/report/attendance', { class_id: attClass, year: attYear, month: attMonth })
              }}
              label="Download Report"
              disabled={!attClass}
            />
            {!attClass && <HelperText>Select a class to continue</HelperText>}
          </div>
        </ReportCard>

        {/* Class Results */}
        <ReportCard
          icon={Icons.Chart}
          title="Class Result Report"
          description="Exam results ranked by percentage. Landscape A4 format."
          accentColor="var(--success-600)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Select
              label="Class"
              value={resultClass}
              onChange={e => {
                setResultClass(e.target.value)
                setResultExam('')
              }}
              options={classOptions}
              placeholder="Select class"
            />
            <Select
              label="Exam"
              value={resultExam}
              onChange={e => setResultExam(e.target.value)}
              options={resultExamOptions}
              placeholder={resultClass ? 'Select exam' : 'Select class first'}
            />
            <DownloadButton
              href="#"
              onClick={e => {
                e.preventDefault()
                openSignedPdf('/pdf/token/report/results', '/pdf/report/results', { exam_id: resultExam, class_id: resultClass })
              }}
              label="Download Report"
              disabled={!resultClass || !resultExam}
            />
            {(!resultClass || !resultExam) && (
              <HelperText>Select class and exam to continue</HelperText>
            )}
          </div>
        </ReportCard>

        {/* Marksheets */}
        <ReportCard
          icon={Icons.Document}
          title="Class Marksheets"
          description="Individual marksheets for all students — one page per student."
          accentColor="var(--brand-600)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Select
              label="Class"
              value={msClass}
              onChange={e => {
                setMsClass(e.target.value)
                setMsExam('')
              }}
              options={classOptions}
              placeholder="Select class"
            />
            <Select
              label="Exam"
              value={msExam}
              onChange={e => setMsExam(e.target.value)}
              options={marksheetExamOptions}
              placeholder={msClass ? 'Select exam' : 'Select class first'}
            />
            <DownloadButton
              href="#"
              onClick={async e => {
                e.preventDefault()
                await openSignedPdf(`/pdf/token/marksheet/class/${msClass}`, `/pdf/marksheet/class/${msClass}`, { exam_id: msExam })
                setTimeout(refreshReportCards, 1200)
              }}
              label="Download Marksheets"
              disabled={!msClass || !msExam}
            />
            {(!msClass || !msExam) && (
              <HelperText>Select class and exam to continue</HelperText>
            )}
          </div>
        </ReportCard>

        <ReportCard
          icon={Icons.Document}
          title="Report Card Registry"
          description="Saved report-card records generated from marksheet PDFs."
          accentColor="#0d7377"
        >
          {!msClass || !msExam ? (
            <HelperText>Select class and exam above to load generated report cards</HelperText>
          ) : reportCardsLoading ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading generated report cards...</div>
          ) : reportCards.length === 0 ? (
            <HelperText>No report-card records yet. Generate class marksheets to create them.</HelperText>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '640px' }}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Generated</th>
                    <th>Status</th>
                    <th>Open</th>
                    {isAdmin && <th>Lock</th>}
                  </tr>
                </thead>
                <tbody>
                  {reportCards.map(card => (
                    <tr key={card.id}>
                      <td style={{ fontWeight: 700 }}>{card.student_name}</td>
                      <td>{card.class_name} — {card.division}</td>
                      <td>{card.generated_at ? card.generated_at.replace('T', ' ').slice(0, 16) : '—'}</td>
                      <td>{card.is_locked ? 'Locked' : 'Draft'}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openSignedPdf(
                            `/pdf/token/marksheet/student/${card.student_id}`,
                            `/pdf/marksheet/student/${card.student_id}`,
                            { exam_id: card.exam_id, class_id: card.class_id },
                          )}
                        >
                          Open
                        </button>
                      </td>
                      {isAdmin && (
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={savingLockId === card.id}
                            onClick={() => toggleLock(card.id, !card.is_locked)}
                          >
                            {savingLockId === card.id ? 'Saving...' : card.is_locked ? 'Unlock' : 'Lock'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>
      </div>

      {/* Info banner */}
      <div
        style={{
          marginTop: 'clamp(20px, 3vw, 24px)',
          padding: 'clamp(14px, 3vw, 16px) clamp(16px, 3vw, 20px)',
          background: 'var(--brand-50)',
          border: '1px solid var(--brand-200)',
          borderRadius: 12,
          fontSize: 'clamp(12px, 2.8vw, 13px)',
          color: 'var(--brand-700)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          lineHeight: 1.55,
        }}
      >
        <div style={{ flexShrink: 0, marginTop: 1 }}>{Icons.Info}</div>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontWeight: 700 }}>About PDF generation</strong>
          <div style={{ marginTop: 2 }}>
            Reports are generated on demand and open in a new browser tab.
            Large reports may take a few seconds to render.
          </div>
        </div>
      </div>
    </div>
  )
}
