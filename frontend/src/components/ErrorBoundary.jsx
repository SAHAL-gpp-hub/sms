import { Component } from 'react'
import { Link } from 'react-router-dom'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ui] Route crashed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'var(--surface-50, #f8fafc)',
      }}>
        <section style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--surface-0, #fff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg, 0 20px 45px rgba(15, 23, 42, 0.12))',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--danger-600, #dc2626)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Something went wrong
          </div>
          <h1 style={{ margin: '8px 0', fontSize: '24px', lineHeight: 1.2, color: 'var(--text-primary, #0f172a)' }}>
            This screen failed to load.
          </h1>
          <p style={{ margin: '0 0 18px', color: 'var(--text-secondary, #475569)', lineHeight: 1.55 }}>
            Your session and data are still safe. Retry the screen, reload the app, or return to the dashboard.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="button" onClick={() => this.setState({ error: null })}>
              Retry
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>
              Reload app
            </button>
            <Link className="btn btn-ghost" to="/">
              Dashboard
            </Link>
          </div>
          <details style={{ marginTop: '18px', color: 'var(--text-tertiary, #64748b)', fontSize: '12px' }}>
            <summary>Technical details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.error?.message || String(this.state.error)}
            </pre>
          </details>
        </section>
      </main>
    )
  }
}
