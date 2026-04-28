// StudentList.jsx — Redesigned with skeletons, confirm modal, better table
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { studentAPI, setupAPI, extractError } from '../../services/api'
import { PageHeader, SearchInput, Select, TableSkeleton, EmptyState, ConfirmModal, StatusBadge, FilterRow } from '../../components/UI'

export default function StudentList() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
  const [deleting, setDeleting] = useState(false)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (classFilter) params.class_id = classFilter
      const res = await studentAPI.list(params)
      setStudents(res.data)
    } catch (err) {
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [search, classFilter])

  useEffect(() => {
    setupAPI.getClasses().then(r => setClasses(r.data)).catch(() => {})
  }, [])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await setupAPI.seed()
      await setupAPI.getClasses().then(r => setClasses(r.data))
      toast.success('Classes and academic year created successfully!')
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
      fetchStudents()
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
        subtitle={loading ? 'Loading...' : `${students.length} active students${classFilter ? ' in selected class' : ''}`}
        actions={
          <>
            {classes.length === 0 && (
              <button className="btn btn-secondary" onClick={handleSeed} disabled={seeding}>
                {seeding ? <><span className="spinner" style={{ width: '13px', height: '13px' }} /> Setting up...</> : '⚙ Setup Classes'}
              </button>
            )}
            <Link to="/students/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Student
            </Link>
          </>
        }
      />

      <FilterRow>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, GR no, contact, ID…"
          style={{ flex: 1, minWidth: '220px' }}
        />
        <Select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          options={classOptions}
          placeholder="All Classes"
          style={{ minWidth: '180px' }}
        />
        {(search || classFilter) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setSearch(''); setClassFilter('') }}
          >
            Clear filters
          </button>
        )}
      </FilterRow>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
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
                      icon={
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      }
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
                        <span className="mono" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>
                          {s.student_id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>
                          {s.name_en}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                          {s.name_gu}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {cls ? `${cls.name} — ${cls.division}` : `Class ${s.class_id}`}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {s.father_name}
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {s.contact}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Link
                            to={`/students/${s.id}/edit`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600, color: 'var(--brand-600)',
                              background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                              textDecoration: 'none', transition: 'all 0.12s',
                            }}
                          >
                            Edit
                          </Link>
                          <Link
                            to={`/fees/student/${s.id}`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600, color: 'var(--success-700)',
                              background: 'var(--success-50)', border: '1px solid var(--success-100)',
                              textDecoration: 'none', transition: 'all 0.12s',
                            }}
                          >
                            Fees
                          </Link>
                          <button
                            onClick={() => window.open(`/api/v1/yearend/tc-pdf/${s.id}`, '_blank')}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                              background: 'var(--gray-100)', border: '1px solid var(--border-default)',
                              cursor: 'pointer', transition: 'all 0.12s',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            TC
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: s.id, name: s.name_en })}
                            style={{
                              padding: '4px 10px', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600, color: 'var(--danger-600)',
                              background: 'var(--danger-50)', border: '1px solid var(--danger-100)',
                              cursor: 'pointer', transition: 'all 0.12s',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            )}
          </table>
        </div>

        {/* Row count footer */}
        {!loading && students.length > 0 && (
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Showing {students.length} student{students.length !== 1 ? 's' : ''}</span>
            {students.length >= 50 && (
              <span style={{ color: 'var(--warning-600)', fontWeight: 600 }}>
                Showing first 50 results — refine your search to see more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Remove Student"
        message={`Are you sure you want to mark "${deleteTarget?.name}" as Left? This action can be reversed by editing the student's status.`}
        confirmLabel="Mark as Left"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
