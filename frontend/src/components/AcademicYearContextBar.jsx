import { useAcademicYear } from '../contexts/academicYearContext'
import { getRole } from '../services/auth'

export default function AcademicYearContextBar() {
  const role = getRole()
  const {
    selectedYearId,
    selectedYear,
    years,
    isClosedYear,
    loading,
    setSelectedYearId,
  } = useAcademicYear()

  if (role === 'student' || role === 'parent') return null

  const label = selectedYear?.label || (loading ? 'Loading year...' : 'No active year')

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 18px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      color: 'var(--text-primary)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Academic year</span>
        <strong style={{ fontSize: '14px' }}>
          {label}
          {isClosedYear && <span style={{ marginLeft: 8, color: 'var(--warning-700)' }}>Closed</span>}
        </strong>
      </div>
      <select
        className="input"
        value={selectedYearId}
        onChange={event => setSelectedYearId(event.target.value)}
        style={{ width: '180px', maxWidth: '45vw' }}
        aria-label="Selected academic year"
      >
        {!selectedYearId && <option value="">Select year</option>}
        {years.map(year => (
          <option key={year.id} value={year.id}>
            {year.label}{year.is_current ? ' (Current)' : ''}{String(year.status).toLowerCase() === 'closed' ? ' - Closed' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
