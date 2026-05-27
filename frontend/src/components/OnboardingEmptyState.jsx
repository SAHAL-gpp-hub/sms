import { Link } from 'react-router-dom'

const STEPS = {
  noClasses: {
    title: 'Set up your classes first',
    description: 'Before adding students, create the standards and divisions for this academic year.',
    primaryAction: { label: 'Set Up Classes Now', href: '/setup/classes' },
    steps: ['Create standards and divisions', 'Confirm academic year setup', 'Return here to add students'],
  },
  noStudents: {
    title: 'No students yet',
    description: 'Add your first student or import an admission spreadsheet to unlock attendance, fees, and marks.',
    primaryAction: { label: 'Add First Student', href: '/students/new' },
    secondaryAction: { label: 'Import CSV', href: '/students?import=1' },
  },
  noFeeStructure: {
    title: 'Fee structure not set up',
    description: 'Define class fees before collecting payments or chasing balances.',
    primaryAction: { label: 'Set Up Fees', href: '/fees' },
    steps: ['Load GSEB fee heads', 'Set amounts per class', 'Apply fees to students'],
  },
}

export default function OnboardingEmptyState({ type = 'noStudents' }) {
  const item = STEPS[type] || STEPS.noStudents
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12l2 2 4-4M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
      </div>
      <div className="empty-state-title">{item.title}</div>
      <div className="empty-state-desc">{item.description}</div>
      {item.steps?.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginTop: 12, textAlign: 'left', maxWidth: 360 }}>
          {item.steps.map((step, index) => (
            <div key={step} style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 700 }}>
              {index + 1}. {step}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
        {item.primaryAction && <Link className="btn btn-primary btn-sm" to={item.primaryAction.href}>{item.primaryAction.label}</Link>}
        {item.secondaryAction && <Link className="btn btn-secondary btn-sm" to={item.secondaryAction.href}>{item.secondaryAction.label}</Link>}
      </div>
    </div>
  )
}
