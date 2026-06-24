import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { ConfirmModal, MetricCard, SectionPanel } from '../../components/UI'
import { extractError, studentImportAPI } from '../../services/api'

const statusColor = {
  ready: 'var(--success-700)',
  invalid: 'var(--danger-600)',
}

const statusBg = {
  ready: 'var(--success-50)',
  invalid: 'var(--danger-50)',
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  ))
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return isMobile
}

export default function StudentImportPanel() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState(null)
  const [createMissingClasses, setCreateMissingClasses] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState(null)
  const [rollingBack, setRollingBack] = useState(false)

  useEffect(() => {
    setPreview(null)
  }, [file, createMissingClasses])

  const batchesQuery = useQuery({
    queryKey: ['student-import-batches'],
    queryFn: async () => {
      const res = await studentImportAPI.listBatches()
      return res.data || { summary: {}, items: [] }
    },
  })

  const importSummary = batchesQuery.data?.summary || {}
  const recentBatches = batchesQuery.data?.items || []
  const readyRows = preview?.summary?.ready_rows || 0
  const previewRows = useMemo(() => preview?.rows || [], [preview])
  const issueRows = useMemo(
    () => (preview?.rows || []).filter(row => row.status !== 'ready' || row.issues?.length || row.warnings?.length),
    [preview]
  )

  const handleDownload = async (type) => {
    try {
      if (type === 'template') await studentImportAPI.downloadTemplate()
      else await studentImportAPI.downloadSample()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  const handlePreview = async () => {
    if (!file) {
      toast.error('Choose a CSV or XLSX file first')
      return
    }
    setPreviewing(true)
    try {
      const res = await studentImportAPI.preview(file, { createMissingClasses })
      setPreview(res.data)
      toast.success('Import preview generated')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setPreviewing(false)
    }
  }

  const handleDownloadIssueReport = () => {
    if (!issueRows.length) {
      toast('No validation issues to download', { icon: 'ℹ️' })
      return
    }
    const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csv = [
      ['row', 'student', 'external_id', 'class', 'status', 'action', 'issues', 'warnings'].map(escape).join(','),
      ...issueRows.map(row => [
        row.row_number,
        row.name_en || '',
        row.student_id || row.gr_number || '',
        `${row.class_name || ''}${row.division ? `-${row.division}` : ''}`,
        row.status || '',
        row.action || '',
        (row.issues || []).join('; '),
        (row.warnings || []).join('; '),
      ].map(escape).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `student-import-issues-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Choose a CSV or XLSX file first')
      return
    }
    if (!preview) {
      toast.error('Generate a preview before importing')
      return
    }
    setImporting(true)
    try {
      const res = await studentImportAPI.commit(file, { createMissingClasses })
      toast.success(`Imported ${res.data?.batch?.imported_rows || 0} student record(s)`) 
      setPreview(null)
      setFile(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['student-import-batches'] }),
      ])
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setImporting(false)
    }
  }

  const handleRollback = async () => {
    if (!rollbackTarget) return
    setRollingBack(true)
    try {
      const res = await studentImportAPI.rollbackBatch(rollbackTarget.id)
      toast.success(`Rollback finished for batch #${res.data?.batch_id}`)
      setRollbackTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['student-import-batches'] }),
      ])
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setRollingBack(false)
    }
  }

  const isMobile = useIsMobile()

  return (
    <div style={{ display: 'grid', gap: '18px', marginBottom: '20px' }}>
      {/* ── Upload Section ──────────────────────────────────────── */}
      <SectionPanel
        title="Import old school data"
        subtitle="Upload CSV or XLSX files, preview validation results, and then import students safely."
        actions={isMobile ? null : (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('template')}>Template</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('sample')}>Sample</button>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: '14px' }}>
          {/* Mobile: stacked layout */}
          {isMobile ? (
            <>
              <div>
                <label className="label">Import file</label>
                <div
                  style={{
                    border: file ? '2px solid var(--success-300)' : '2px dashed var(--border-default)',
                    borderRadius: 12,
                    padding: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: file ? 'var(--success-50)' : 'var(--surface-1)',
                    transition: 'all 0.15s',
                  }}
                  onClick={() => document.getElementById('import-file-input')?.click()}
                >
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                  {file ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="18" height="18" fill="none" stroke="var(--success-600)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{file.name}</span>
                    </div>
                  ) : (
                    <>
                      <svg width="28" height="28" fill="none" stroke="var(--text-tertiary)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 6 }}>Tap to upload CSV or XLSX</div>
                    </>
                  )}
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={createMissingClasses}
                  onChange={e => setCreateMissingClasses(e.target.checked)}
                  style={{ width: 20, height: 20 }}
                />
                Create missing classes
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handlePreview} disabled={previewing || importing}>
                  {previewing ? 'Previewing…' : 'Preview'}
                </button>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleImport} disabled={importing || previewing || !preview || readyRows === 0}>
                  {importing ? 'Importing…' : 'Import'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDownload('template')}>
                  ⬇ Template
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDownload('sample')}>
                  ⬇ Sample
                </button>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.5, padding: '10px 12px', background: 'var(--surface-1)', borderRadius: 10 }}>
                <strong>Required:</strong> name, DOB, gender, class, father name, contact, admission date. Duplicate student_id/gr_number are skipped.
              </div>
            </>
          ) : (
            /* Desktop: original grid layout */
            <>
              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'minmax(220px, 1.2fr) auto auto', alignItems: 'end' }}>
                <div>
                  <label className="label">Import file</label>
                  <input
                    className="input"
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={createMissingClasses}
                    onChange={e => setCreateMissingClasses(e.target.checked)}
                  />
                  Create missing classes
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={handlePreview} disabled={previewing || importing}>
                    {previewing ? 'Previewing…' : 'Preview'}
                  </button>
                  <button className="btn btn-primary" onClick={handleImport} disabled={importing || previewing || !preview || readyRows === 0}>
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Required fields: name, DOB, gender, class, father name, contact, admission date. Existing student_id/gr_number values are skipped to prevent duplicates.
              </div>
            </>
          )}

          {preview && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <MetricCard label="Rows" value={preview.summary.total_rows || 0} />
                <MetricCard label="Ready" value={preview.summary.ready_rows || 0} color="var(--success-700)" />
                <MetricCard label="Duplicates" value={preview.summary.duplicate_rows || 0} color="var(--warning-600)" />
                <MetricCard label="Invalid" value={preview.summary.invalid_rows || 0} color="var(--danger-600)" />
              </div>

              <div className="card" style={{ padding: isMobile ? '12px 14px' : '12px 14px', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: isMobile ? 14 : undefined }}>Full validation preview</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Showing all {previewRows.length} row{previewRows.length !== 1 ? 's' : ''}. {issueRows.length} row{issueRows.length !== 1 ? 's need' : ' needs'} attention.
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadIssueReport} disabled={issueRows.length === 0}>
                  Download issue CSV
                </button>
              </div>

              {preview.summary.classes_to_create?.length > 0 && (
                <div className="card" style={{ padding: '12px 14px', background: 'var(--warning-50)', border: '1px solid #fde68a' }}>
                  <div style={{ fontWeight: 700, color: 'var(--warning-700)', marginBottom: '6px' }}>Classes to create</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {preview.summary.classes_to_create.map(cls => `${cls.class_name}-${cls.division} (${cls.academic_year_label})`).join(', ')}
                  </div>
                </div>
              )}

              {/* Mobile: card-based preview list */}
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {previewRows.map(row => (
                    <div key={row.row_number} style={{
                      background: 'var(--surface-0)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: statusBg[row.status] || 'var(--surface-1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: 11, fontWeight: 800, color: statusColor[row.status] || 'var(--text-secondary)',
                      }}>
                        {row.row_number}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name_en || '—'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {row.class_name || '—'}{row.division ? ` — ${row.division}` : ''}
                          {row.student_id ? ` · ${row.student_id}` : ''}
                        </div>
                        {(row.issues?.length || row.warnings?.length) ? (
                          <div style={{ fontSize: 11.5, color: 'var(--danger-600)', marginTop: 4, lineHeight: 1.4 }}>
                            {(row.issues || row.warnings).join(', ')}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: 'var(--success-600)', marginTop: 4, fontWeight: 600 }}>✓ Ready</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        color: statusColor[row.status] || 'var(--text-secondary)',
                        background: statusBg[row.status] || 'var(--surface-1)',
                        padding: '3px 8px', borderRadius: 6,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop: table */
                <div className="card" style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Student</th>
                        <th>Class</th>
                        <th>Status</th>
                        <th>Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map(row => (
                        <tr key={row.row_number}>
                          <td>{row.row_number}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{row.name_en || '—'}</div>
                            <div className="mono" style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>{row.student_id || row.gr_number || 'No external ID'}</div>
                          </td>
                          <td>{row.class_name || '—'} {row.division ? `— ${row.division}` : ''}</td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: statusColor[row.status] || 'var(--text-secondary)' }}>
                              {row.status}
                            </span>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>{row.action}</div>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {row.issues?.length ? row.issues.join(', ') : (row.warnings?.join(', ') || 'Ready to import')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </SectionPanel>

      {/* ── Recent Batches ─────────────────────────────────────── */}
      <SectionPanel title="Recent import verification" subtitle="Review batch results and roll back imported students if needed.">
        <div style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <MetricCard label="Batches" value={importSummary.total_batches || 0} />
            <MetricCard label="Imported rows" value={importSummary.imported_rows || 0} color="var(--success-700)" />
            <MetricCard label="Skipped rows" value={importSummary.skipped_rows || 0} color="var(--warning-600)" />
            <MetricCard label="Rolled back" value={importSummary.rolled_back_batches || 0} color="var(--danger-600)" />
          </div>

          {isMobile ? (
            /* Mobile: card-based batch list */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {batchesQuery.isLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading import history…</div>
              ) : recentBatches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: 13 }}>No imports yet.</div>
              ) : (
                recentBatches.map(batch => (
                  <div key={batch.id} style={{
                    background: 'var(--surface-0)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                          #{batch.id} — {batch.file_name}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {batch.created_at ? new Date(batch.created_at).toLocaleString() : '—'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        color: batch.status === 'rolled_back' ? 'var(--danger-600)' : 'var(--success-700)',
                        background: batch.status === 'rolled_back' ? 'var(--danger-50)' : 'var(--success-50)',
                        padding: '3px 8px', borderRadius: 6,
                      }}>
                        {batch.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <div>
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Imported: </span>
                        <span style={{ fontWeight: 700, color: 'var(--success-700)' }}>{batch.imported_rows}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Skipped: </span>
                        <span style={{ fontWeight: 700, color: 'var(--warning-600)' }}>{batch.skipped_rows + batch.error_rows}</span>
                      </div>
                    </div>
                    {batch.status !== 'rolled_back' && (
                      <button className="btn btn-danger btn-sm" style={{ width: '100%' }} onClick={() => setRollbackTarget(batch)}>
                        Roll back this batch
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Desktop: table */
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>File</th>
                    <th>Imported</th>
                    <th>Skipped</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batchesQuery.isLoading ? (
                    <tr><td colSpan={6} style={{ padding: '16px' }}>Loading import history…</td></tr>
                  ) : recentBatches.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '16px' }}>No imports yet.</td></tr>
                  ) : recentBatches.map(batch => (
                    <tr key={batch.id}>
                      <td>#{batch.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{batch.file_name}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>{batch.created_at ? new Date(batch.created_at).toLocaleString() : '—'}</div>
                      </td>
                      <td>{batch.imported_rows}</td>
                      <td>{batch.skipped_rows + batch.error_rows}</td>
                      <td style={{ fontWeight: 700, color: batch.status === 'rolled_back' ? 'var(--danger-600)' : 'var(--success-700)' }}>{batch.status}</td>
                      <td>
                        {batch.status === 'rolled_back' ? 'Completed' : (
                          <button className="btn btn-danger btn-sm" onClick={() => setRollbackTarget(batch)}>
                            Roll back
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionPanel>

      <ConfirmModal
        open={!!rollbackTarget}
        title="Mark imported students as Left"
        message={`Batch #${rollbackTarget?.id} rollback will not delete records. It will mark the ${rollbackTarget?.imported_rows || 0} imported student(s) as Left, keep the batch audit trail, and leave skipped/error rows untouched. Continue?`}
        confirmLabel="Withdraw Student"
        confirmVariant="danger"
        onConfirm={handleRollback}
        onCancel={() => setRollbackTarget(null)}
        loading={rollingBack}
      />
    </div>
  )
}
