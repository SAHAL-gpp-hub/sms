// MarksEntry.jsx — Fixed alert() calls, improved marks grid UX
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { marksAPI, setupAPI, extractError } from '../../services/api'
import { PageHeader, FilterRow, Select, EmptyState, TableSkeleton, TabBar, InlineBanner } from '../../components/UI'

const EXAM_TYPES = ['Unit Test 1', 'Unit Test 2', 'Half-Yearly', 'Annual', 'Practical']

const GRADE_COLORS = {
  A1: { bg: '#dcfce7', color: '#15803d' },
  A2: { bg: '#d1fae5', color: '#065f46' },
  B1: { bg: '#dbeafe', color: '#1d4ed8' },
  B2: { bg: '#e0e7ff', color: '#4338ca' },
  C1: { bg: '#fef3c7', color: '#d97706' },
  C2: { bg: '#ffedd5', color: '#c2410c' },
  D:  { bg: '#fee2e2', color: '#b91c1c' },
  E:  { bg: '#fecdd3', color: '#9f1239' },
  AB: { bg: '#f1f5f9', color: '#64748b' },
}

function GradeBadge({ grade }) {
  const s = GRADE_COLORS[grade] || { bg: 'var(--gray-100)', color: 'var(--gray-600)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '32px', height: '20px',
      fontSize: '11px', fontWeight: 800,
      background: s.bg, color: s.color,
      borderRadius: '5px',
    }}>
      {grade}
    </span>
  )
}

export default function MarksEntry() {
  const [classes, setClasses]         = useState([])
  const [years, setYears]             = useState([])
  const [exams, setExams]             = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedYear, setSelectedYear]   = useState('')
  const [selectedExam, setSelectedExam]   = useState('')
  const [gridData, setGridData]       = useState(null)
  const [localMarks, setLocalMarks]   = useState({})
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [results, setResults]         = useState([])
  const [view, setView]               = useState('entry')
  const [showNewExam, setShowNewExam] = useState(false)
  const [newExam, setNewExam]         = useState({ name: 'Unit Test 1', exam_date: '' })
  const [seedingSubjects, setSeedingSubjects] = useState(false)
  const [creatingExam, setCreatingExam] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)

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
    }
  }, [selectedClass, selectedYear])

  useEffect(() => {
    if (selectedExam && selectedClass) {
      setLoadingGrid(true)
      marksAPI.getMarksEntry(selectedExam, selectedClass).then(r => {
        setGridData(r.data)
        const map = {}
        r.data.students.forEach(s => {
          map[s.student_id] = {}
          Object.entries(s.marks).forEach(([subId, m]) => {
            map[s.student_id][subId] = {
              theory:    m.theory    ?? '',
              practical: m.practical ?? '',
              is_absent: m.is_absent || false,
            }
          })
        })
        setLocalMarks(map)
        setSaved(false)
      }).catch(() => toast.error('Failed to load marks grid'))
        .finally(() => setLoadingGrid(false))
    }
  }, [selectedExam, selectedClass])

  const handleMarkChange = (studentId, subjectId, field, value) => {
    setLocalMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: { ...prev[studentId]?.[subjectId], [field]: value }
      }
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!gridData) return
    setSaving(true)
    try {
      const entries = []
      gridData.students.forEach(s => {
        gridData.subjects.forEach(sub => {
          const m = localMarks[s.student_id]?.[sub.id]
          entries.push({
            student_id:      s.student_id,
            subject_id:      sub.id,
            exam_id:         parseInt(selectedExam),
            theory_marks:    m?.theory !== '' && m?.theory !== undefined ? parseFloat(m.theory) : null,
            practical_marks: m?.practical !== '' && m?.practical !== undefined ? parseFloat(m.practical) : null,
            is_absent:       m?.is_absent || false,
          })
        })
      })
      await marksAPI.bulkSaveMarks(entries)
      setSaved(true)
      toast.success('Marks saved successfully')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSeedSubjects = async () => {
    setSeedingSubjects(true)
    try {
      await marksAPI.seedSubjects(selectedClass)
      // Re-fetch grid to get subjects
      const r = await marksAPI.getMarksEntry(selectedExam || 0, selectedClass).catch(() => ({ data: { students: [], subjects: [] } }))
      setGridData(r.data)
      toast.success('GSEB subjects loaded for this class')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSeedingSubjects(false)
    }
  }

  const handleCreateExam = async () => {
    if (!selectedClass || !selectedYear) return
    setCreatingExam(true)
    try {
      await marksAPI.createExam({
        name:             newExam.name,
        class_id:         parseInt(selectedClass),
        academic_year_id: parseInt(selectedYear),
        exam_date:        newExam.exam_date || null,
      })
      const r = await marksAPI.getExams({ class_id: selectedClass, academic_year_id: selectedYear })
      setExams(r.data)
      setShowNewExam(false)
      toast.success(`Exam "${newExam.name}" created`)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCreatingExam(false)
    }
  }

  const handleViewResults = async () => {
    setView('results')
    if (!selectedExam || !selectedClass) return
    setLoadingResults(true)
    try {
      const r = await marksAPI.getResults(selectedExam, selectedClass)
      setResults(r.data)
    } catch (err) {
      toast.error('Failed to load results')
    } finally {
      setLoadingResults(false)
    }
  }

  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))
  const yearOptions  = years.map(y => ({ value: String(y.id), label: y.label + (y.is_current ? ' (Current)' : '') }))
  const examOptions  = exams.map(e => ({ value: String(e.id), label: e.name }))
  const hasSubjects  = gridData && gridData.subjects && gridData.subjects.length > 0
  const hasStudents  = gridData && gridData.students && gridData.students.length > 0
  const examName     = exams.find(e => String(e.id) === selectedExam)?.name || 'Exam'

  return (
    <div>
      <PageHeader
        title="Marks Entry"
        subtitle="Enter marks class-wise. Grades calculated automatically per GSEB rules."
      />

      {/* Filters */}
      <FilterRow>
        <Select
          value={selectedClass}
          onChange={e => { setSelectedClass(e.target.value); setSelectedExam(''); setGridData(null) }}
          options={classOptions}
          placeholder="Select class…"
          style={{ flex: 1, minWidth: '180px' }}
        />
        <Select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          options={yearOptions}
          placeholder="Select year…"
          style={{ flex: 1, minWidth: '160px' }}
        />
        <div style={{ flex: 2, minWidth: '200px', display: 'flex', gap: '8px' }}>
          <select
            className="input"
            value={selectedExam}
            onChange={e => { setSelectedExam(e.target.value); setView('entry') }}
            style={{ flex: 1 }}
          >
            <option value="">Select exam…</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => setShowNewExam(s => !s)}
            disabled={!selectedClass}
            title="Create new exam"
          >
            + New
          </button>
        </div>
        {selectedClass && !hasSubjects && gridData && (
          <button className="btn" onClick={handleSeedSubjects} disabled={seedingSubjects}
            style={{ background: 'var(--warning-500)', color: 'white', border: 'none' }}>
            {seedingSubjects ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Loading…</> : '📚 Load GSEB Subjects'}
          </button>
        )}
      </FilterRow>

      {/* New exam form */}
      {showNewExam && selectedClass && (
        <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--brand-700)', marginBottom: '12px' }}>
            Create New Exam
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label className="label">Exam Type</label>
              <select className="input" value={newExam.name} onChange={e => setNewExam(n => ({ ...n, name: e.target.value }))}>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ width: '160px' }}>
              <label className="label">Date (optional)</label>
              <input type="date" className="input" value={newExam.exam_date} onChange={e => setNewExam(n => ({ ...n, exam_date: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={handleCreateExam} disabled={creatingExam}>
              {creatingExam ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Creating…</> : 'Create Exam'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowNewExam(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Main content */}
      {selectedExam && gridData && (
        <>
          {/* Tab switcher */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <TabBar
              tabs={[
                { value: 'entry',   label: 'Marks Entry',  icon: '📝' },
                { value: 'results', label: 'Results',       icon: '📊' },
              ]}
              active={view}
              onChange={v => { if (v === 'results') handleViewResults(); else setView(v) }}
            />
            {view === 'entry' && hasStudents && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {saved && (
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--success-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save All Marks'}
                </button>
              </div>
            )}
            {view === 'results' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={`/api/v1/pdf/report/results?exam_id=${selectedExam}&class_id=${selectedClass}`}
                  target="_blank" rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none', fontSize: '12.5px' }}
                >
                  📋 Class Result PDF
                </a>
                <a
                  href={`/api/v1/pdf/marksheet/class/${selectedClass}?exam_id=${selectedExam}`}
                  target="_blank" rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none', fontSize: '12.5px' }}
                >
                  📄 Marksheets PDF
                </a>
              </div>
            )}
          </div>

          {/* Marks Entry Grid */}
          {view === 'entry' && (
            <div className="card">
              {!hasSubjects ? (
                <div style={{ padding: '20px' }}>
                  <InlineBanner
                    type="warning"
                    title="No subjects found for this class"
                    message="Click 'Load GSEB Subjects' in the filters above to automatically add the standard GSEB subject set for this class."
                  />
                </div>
              ) : !hasStudents ? (
                <EmptyState
                  icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                  title="No students in this class"
                  description="Add students to this class to start entering marks"
                />
              ) : (
                <>
                  <div style={{ padding: '12px 20px', background: 'var(--gray-50)', borderBottom: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <span><strong>T</strong> = Theory marks field</span>
                    <span><strong>P</strong> = Practical marks field (where applicable)</span>
                    <span>Check <strong>Abs</strong> to mark a student absent for that subject</span>
                    <span style={{ color: 'var(--warning-600)', fontWeight: 600 }}>💡 Scroll right to see all subjects</span>
                  </div>
                  <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px', minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{
                            position: 'sticky', left: 0, zIndex: 3,
                            background: 'var(--gray-50)', padding: '10px 16px',
                            textAlign: 'left', fontWeight: 700, fontSize: '11px',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-default)',
                            whiteSpace: 'nowrap', minWidth: '160px',
                            boxShadow: '2px 0 4px rgba(0,0,0,0.04)',
                          }}>
                            Student
                          </th>
                          <th style={{
                            background: 'var(--gray-50)', padding: '10px 12px',
                            fontWeight: 700, fontSize: '11px', textTransform: 'uppercase',
                            letterSpacing: '0.06em', color: 'var(--text-secondary)',
                            borderBottom: '1px solid var(--border-default)', width: '50px',
                          }}>Roll</th>
                          {gridData.subjects.map(sub => (
                            <th key={sub.id} style={{
                              background: 'var(--gray-50)', padding: '8px 10px',
                              fontWeight: 700, fontSize: '11px', color: 'var(--text-secondary)',
                              borderBottom: '1px solid var(--border-default)',
                              textAlign: 'center', minWidth: sub.max_practical > 0 ? '160px' : '110px',
                              whiteSpace: 'nowrap',
                            }}>
                              <div>{sub.name}</div>
                              <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                T/{sub.max_theory}{sub.max_practical > 0 ? ` · P/${sub.max_practical}` : ''}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gridData.students.map((student, si) => (
                          <tr key={student.student_id} style={{ background: si % 2 === 0 ? 'var(--surface-0)' : 'var(--gray-25)' }}>
                            <td style={{
                              position: 'sticky', left: 0, zIndex: 2,
                              background: si % 2 === 0 ? 'var(--surface-0)' : 'var(--gray-25)',
                              padding: '8px 16px', fontWeight: 600,
                              color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)',
                              boxShadow: '2px 0 4px rgba(0,0,0,0.04)', whiteSpace: 'nowrap',
                            }}>
                              {student.student_name}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                              {student.roll_number || '—'}
                            </td>
                            {gridData.subjects.map(sub => {
                              const m = localMarks[student.student_id]?.[sub.id] || {}
                              return (
                                <td key={sub.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max={sub.max_theory}
                                      value={m.theory ?? ''}
                                      onChange={e => handleMarkChange(student.student_id, sub.id, 'theory', e.target.value)}
                                      disabled={m.is_absent}
                                      placeholder={`/${sub.max_theory}`}
                                      style={{
                                        width: '52px', padding: '5px 4px',
                                        border: '1.5px solid var(--border-default)',
                                        borderRadius: '6px', fontSize: '12px',
                                        textAlign: 'center', outline: 'none',
                                        fontFamily: 'var(--font-mono)',
                                        background: m.is_absent ? 'var(--gray-100)' : 'var(--surface-0)',
                                        color: m.is_absent ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                        transition: 'border-color 0.12s',
                                      }}
                                      onFocus={e => e.target.style.borderColor = 'var(--brand-500)'}
                                      onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                    />
                                    {sub.max_practical > 0 && (
                                      <input
                                        type="number"
                                        min="0"
                                        max={sub.max_practical}
                                        value={m.practical ?? ''}
                                        onChange={e => handleMarkChange(student.student_id, sub.id, 'practical', e.target.value)}
                                        disabled={m.is_absent}
                                        placeholder={`P/${sub.max_practical}`}
                                        style={{
                                          width: '52px', padding: '5px 4px',
                                          border: '1.5px solid var(--border-default)',
                                          borderRadius: '6px', fontSize: '12px',
                                          textAlign: 'center', outline: 'none',
                                          fontFamily: 'var(--font-mono)',
                                          background: m.is_absent ? 'var(--gray-100)' : 'var(--surface-0)',
                                          color: m.is_absent ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                        }}
                                        onFocus={e => e.target.style.borderColor = 'var(--brand-500)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                      />
                                    )}
                                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '1px' }}>
                                      <input
                                        type="checkbox"
                                        checked={m.is_absent || false}
                                        onChange={e => handleMarkChange(student.student_id, sub.id, 'is_absent', e.target.checked)}
                                        style={{ accentColor: 'var(--danger-500)', width: '13px', height: '13px' }}
                                      />
                                      <span style={{ fontSize: '9px', color: 'var(--danger-500)', fontWeight: 700 }}>Abs</span>
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
                  <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {gridData.students.length} student{gridData.students.length !== 1 ? 's' : ''} · {gridData.subjects.length} subject{gridData.subjects.length !== 1 ? 's' : ''}
                    </span>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Saving…</> : 'Save All Marks'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Results View */}
          {view === 'results' && (
            <div className="card">
              {loadingResults ? (
                <table className="data-table"><TableSkeleton rows={6} cols={8} /></table>
              ) : results.length === 0 ? (
                <EmptyState
                  icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  title="No results yet"
                  description="Save marks in the entry tab to generate results"
                />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Student</th>
                      <th>Roll</th>
                      <th>Total</th>
                      <th style={{ textAlign: 'center' }}>%</th>
                      <th style={{ textAlign: 'center' }}>CGPA</th>
                      <th style={{ textAlign: 'center' }}>Grade</th>
                      <th style={{ textAlign: 'center' }}>Result</th>
                      <th style={{ textAlign: 'center' }}>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.student_id}>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '22px', borderRadius: '6px',
                            fontSize: '11px', fontWeight: 800,
                            background: r.class_rank === 1 ? '#fef3c7' : r.class_rank <= 3 ? 'var(--gray-100)' : 'transparent',
                            color: r.class_rank === 1 ? '#b45309' : 'var(--text-secondary)',
                          }}>
                            #{r.class_rank}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.student_name}</td>
                        <td style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{r.roll_number || '—'}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {Math.round(r.total_marks)}/{Math.round(r.max_marks)}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--brand-600)' }}>
                          {Number(r.percentage).toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{r.cgpa}</td>
                        <td style={{ textAlign: 'center' }}><GradeBadge grade={r.grade} /></td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11.5px', fontWeight: 800,
                            padding: '3px 9px', borderRadius: '20px',
                            background: r.result === 'PASS' ? 'var(--success-100)' : 'var(--danger-100)',
                            color: r.result === 'PASS' ? 'var(--success-700)' : 'var(--danger-700)',
                          }}>
                            {r.result}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <a
                            href={`/api/v1/pdf/marksheet/student/${r.student_id}?exam_id=${selectedExam}&class_id=${selectedClass}`}
                            target="_blank" rel="noreferrer"
                            style={{
                              fontSize: '12px', fontWeight: 600,
                              color: 'var(--danger-600)',
                              textDecoration: 'none',
                            }}
                          >
                            📄 PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {!selectedClass && (
        <div className="card">
          <EmptyState
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            title="Select a class and exam to begin"
            description="Choose from the filters above to load the marks grid"
          />
        </div>
      )}
    </div>
  )
}
