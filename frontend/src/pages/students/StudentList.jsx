// StudentList.jsx — Fully responsive with mobile card view
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { studentAPI, setupAPI, extractError } from '../../services/api'
import { getRole } from '../../services/auth'
import { PageHeader, SearchInput, Select, TableSkeleton, EmptyState, ConfirmModal, StatusBadge, FilterRow } from '../../components/UI'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import StudentImportPanel from './StudentImportPanel'

function StudentCard({ student, cls, onDelete, onDownloadTC }) {
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border-default)',
      borderRadius: '12px',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.name_en}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
            {student.name_gu}
          </div>
        </div>
        <StatusBadge status={student.status} />
      </div>

      {/* Meta info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>ID</div>
          <div className="mono" style={{ fontSize: '12px', color: 'var(--brand-600)', fontWeight: 600 }}>{student.student_id}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Class</div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {cls ? `${cls.name} — ${cls.division}` : `#${student.class_id}`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Father</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.father_name}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Contact</div>
          <div className="mono" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{student.contact}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
        <Link
          to={`/students/${student.id}/edit`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--brand-600)',
            background: 'var(--brand-50)',
            border: '1px solid var(--brand-100)',
            textDecoration: 'none',
            touchAction: 'manipulation',
          }}
        >
          Edit
        </Link>
        <Link
          to={`/fees/student/${student.id}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--success-700)',
            background: 'var(--success-50)',
            border: '1px solid var(--success-100)',
            textDecoration: 'none',
            touchAction: 'manipulation',
          }}
        >
          Fees
        </Link>
        <button
          onClick={() => onDownloadTC(student.id)}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            background: 'var(--gray-100)',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            touchAction: 'manipulation',
          }}
        >
          TC
        </button>
        <button
          onClick={() => onDelete({ id: student.id, name: student.name_en })}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--danger-600)',
            background: 'var(--danger-50)',
            border: '1px solid var(--danger-100)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            touchAction: 'manipulation',
          }}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

export default function StudentList() {
  const queryClient = useQueryClient()
  const isAdmin = getRole() === 'admin'
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [tcTarget, setTcTarget] = useState(null)
  const [tcForm, setTcForm] = useState({ reason: "Parent's Request", conduct: 'Good' })
  const [deleting, setDeleting] = useState(false)
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  ))

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const debouncedSearch = useDebouncedValue(search, 350)

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const r = await setupAPI.getClasses()
      return r.data || []
    },
  })

  const studentsQuery = useQuery({
    queryKey: ['students', debouncedSearch, classFilter],
    queryFn: async () => {
      const params = { limit: 200 }
      if (debouncedSearch) params.search = debouncedSearch
      if (classFilter) params.class_id = classFilter
      const r = await studentAPI.list(params)
      return r.data || []
    },
  })

  useEffect(() => {
    if (studentsQuery.isError) toast.error('Failed to load students')
  }, [studentsQuery.isError])

  const classes = classesQuery.data || []
  const students = studentsQuery.data || []
  const loading = studentsQuery.isLoading || studentsQuery.isFetching

  const handleDownloadTC = (studentId) => {
    setTcTarget(studentId)
    setTcForm({ reason: "Parent's Request", conduct: 'Good' })
  }

  const handleTcConfirm = () => {
    if (!tcTarget) return
    studentAPI.getTc(tcTarget, {
      reason: tcForm.reason || "Parent's Request",
      conduct: tcForm.conduct || 'Good',
    }).catch(err => toast.error(extractError(err)))
    setTcTarget(null)
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await setupAPI.seed()
      await queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Classes and academic year created!')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSeeding(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await studentAPI.delete(deleteTarget.id)
      toast.success(`${deleteTarget.name} marked as Left`)
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['students'] })
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setDeleting(false)
    }
  }

  const classOptions = classes.map(c => ({ value: String(c.id), label: `Class ${c.name} — ${c.division}` }))

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={loading ? 'Loading...' : `${students.length} active student${students.length !== 1 ? 's' : ''}${classFilter ? ' in selected class' : ''}`}
        actions={
          <>
            {classes.length === 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handleSeed} disabled={seeding}>
                {seeding
                  ? <><span className="spinner" style={{ width: '12px', height: '12px' }} /> Setup...</>
                  : <><svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeWidth={2} /></svg> Setup</>}
              </button>
            )}
            <Link to="/students/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="btn-add-label">Add Student</span>
            </Link>
          </>
        }
      />

      {isAdmin && <StudentImportPanel />}

      <FilterRow>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, GR, contact…"
          style={{ flex: 1, minWidth: '180px' }}
        />
        <Select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          options={classOptions}
          placeholder="All Classes"
          style={{ minWidth: '160px', flex: '0 0 auto' }}
        />
        {(search || classFilter) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setSearch(''); setClassFilter('') }}
            style={{ whiteSpace: 'nowrap' }}
          >
            Clear
          </button>
        )}
      </FilterRow>

      {/* Mobile: card layout */}
      {isMobile ? (
        <div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="skeleton" style={{ display: 'inline-block', width: '140px', height: '16px', borderRadius: '6px' }} />
                      <span className="skeleton" style={{ display: 'inline-block', width: '100px', height: '12px', borderRadius: '6px' }} />
                    </div>
                    <span className="skeleton" style={{ display: 'inline-block', width: '60px', height: '22px', borderRadius: '20px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[1, 2, 3, 4].map(j => <span key={j} className="skeleton" style={{ display: 'block', height: '32px', borderRadius: '6px' }} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                title={search || classFilter ? 'No students match' : 'No students yet'}
                description={search || classFilter ? 'Try clearing filters' : 'Add your first student'}
                action={
                  search || classFilter
                    ? <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setClassFilter('') }}>Clear filters</button>
                    : <Link to="/students/new" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>Add First Student</Link>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {students.map(s => (
                <StudentCard
                  key={s.id}
                  student={s}
	                  cls={classes.find(c => c.id === s.class_id)}
	                  onDelete={setDeleteTarget}
	                  onDownloadTC={handleDownloadTC}
	                />
              ))}
              {students.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
                  Showing {students.length} student{students.length !== 1 ? 's' : ''}
                  {students.length >= 200 && ' — refine search to see more'}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Desktop: table layout */
        <div className="card">
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Father</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={8} cols={7} />
              ) : students.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={7} style={{ padding: 0, border: 'none' }}>
                      <EmptyState
                        icon={<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                        title={search || classFilter ? 'No students match your filters' : 'No students yet'}
                        description={search || classFilter ? 'Try clearing your search or filters' : 'Add your first student to get started'}
                        action={
                          search || classFilter
                            ? <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setClassFilter('') }}>Clear filters</button>
                            : <Link to="/students/new" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>Add First Student</Link>
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {students.map(s => {
                    const cls = classes.find(c => c.id === s.class_id)
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="mono" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{s.student_id}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>{s.name_en}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{s.name_gu}</div>
                        </td>
                        <td style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {cls ? `${cls.name} — ${cls.division}` : `Class ${s.class_id}`}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{s.father_name}</td>
                        <td>
                          <span className="mono" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{s.contact}</span>
                          <div style={{ fontSize: '11.5px', color: s.student_email || s.guardian_email ? 'var(--success-600)' : 'var(--warning-600)', marginTop: '2px', fontWeight: 700 }}>
                            {s.student_email || s.guardian_email ? 'Activation ready' : 'Activation contacts missing'}
                          </div>
                        </td>
                        <td><StatusBadge status={s.status} /></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Link to={`/students/${s.id}/edit`} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--brand-600)', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', textDecoration: 'none' }}>Edit</Link>
                            <Link to={`/fees/student/${s.id}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--success-700)', background: 'var(--success-50)', border: '1px solid var(--success-100)', textDecoration: 'none' }}>Fees</Link>
                            <button onClick={() => handleDownloadTC(s.id)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--gray-100)', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>TC</button>
                            <button onClick={() => setDeleteTarget({ id: s.id, name: s.name_en })} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              )}
            </table>
          </div>
          {!loading && students.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Showing {students.length} student{students.length !== 1 ? 's' : ''}</span>
              {students.length >= 200 && <span style={{ color: 'var(--warning-600)', fontWeight: 600 }}>Showing first 200 — refine search to see more</span>}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Remove Student"
        message={`Are you sure you want to mark "${deleteTarget?.name}" as Left? This can be reversed by editing the student's status.`}
        confirmLabel="Mark as Left"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {tcTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => setTcTarget(null)} />
          <div className="tc-modal-inner" style={{
            position: 'relative',
            background: 'var(--surface-0)',
            borderRadius: '16px 16px 0 0',
            padding: '24px 20px 28px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-default)',
            borderBottom: 'none',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Transfer Certificate
            </h3>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label className="label">Reason</label>
                <input className="input" value={tcForm.reason} onChange={e => setTcForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
              <div>
                <label className="label">Conduct</label>
                <input className="input" value={tcForm.conduct} onChange={e => setTcForm(f => ({ ...f, conduct: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '22px' }}>
              <button className="btn btn-secondary" onClick={() => setTcTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleTcConfirm}>Open PDF</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 480px) {
          .btn-add-label { display: none; }
        }
        @media (min-width: 640px) {
          .tc-modal-inner {
            border-radius: 16px !important;
            border-bottom: 1px solid var(--border-default) !important;
          }
        }
      `}</style>
    </div>
  )
}
