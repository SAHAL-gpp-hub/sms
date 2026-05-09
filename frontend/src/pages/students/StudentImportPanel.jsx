import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { ConfirmModal, MetricCard, SectionPanel } from '../../components/UI'
import { extractError, studentImportAPI } from '../../services/api'

const statusColor = {
  ready: 'var(--success-700)',
  invalid: 'var(--danger-600)',
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
  const previewRows = useMemo(() => (preview?.rows || []).slice(0, 8), [preview])

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

  return (
    <div style={{ display: 'grid', gap: '18px', marginBottom: '20px' }}>
      <SectionPanel
        title="Import old school data"
        subtitle="Upload CSV or XLSX files, preview validation results, and then import students safely."
        actions={(
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('template')}>Template</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('sample')}>Sample</button>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: '14px' }}>
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

          {preview && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <MetricCard label="Rows" value={preview.summary.total_rows || 0} />
                <MetricCard label="Ready" value={preview.summary.ready_rows || 0} color="var(--success-700)" />
                <MetricCard label="Duplicates" value={preview.summary.duplicate_rows || 0} color="var(--warning-600)" />
                <MetricCard label="Invalid" value={preview.summary.invalid_rows || 0} color="var(--danger-600)" />
              </div>

              {preview.summary.classes_to_create?.length > 0 && (
                <div className="card" style={{ padding: '12px 14px', background: 'var(--warning-50)', border: '1px solid #fde68a' }}>
                  <div style={{ fontWeight: 700, color: 'var(--warning-700)', marginBottom: '6px' }}>Classes to create</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {preview.summary.classes_to_create.map(cls => `${cls.class_name}-${cls.division} (${cls.academic_year_label})`).join(', ')}
                  </div>
                </div>
              )}

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
                {(preview.rows?.length || 0) > previewRows.length && (
                  <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)' }}>
                    Showing first {previewRows.length} preview rows.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionPanel>

      <SectionPanel title="Recent import verification" subtitle="Review batch results and roll back imported students if needed.">
        <div style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <MetricCard label="Batches" value={importSummary.total_batches || 0} />
            <MetricCard label="Imported rows" value={importSummary.imported_rows || 0} color="var(--success-700)" />
            <MetricCard label="Skipped rows" value={importSummary.skipped_rows || 0} color="var(--warning-600)" />
            <MetricCard label="Rolled back" value={importSummary.rolled_back_batches || 0} color="var(--danger-600)" />
          </div>

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
        </div>
      </SectionPanel>

      <ConfirmModal
        open={!!rollbackTarget}
        title="Roll back imported students"
        message={`Batch #${rollbackTarget?.id} will mark imported students as Left and preserve the audit trail. Continue?`}
        confirmLabel="Roll back import"
        confirmVariant="danger"
        onConfirm={handleRollback}
        onCancel={() => setRollbackTarget(null)}
        loading={rollingBack}
      />
    </div>
  )
}
