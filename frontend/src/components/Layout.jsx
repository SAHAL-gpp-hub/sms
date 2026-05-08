import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content-area">
        <div className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mobile-nav-button"
            aria-label="Open navigation"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            minWidth: 0,
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <div className="mobile-brand-copy">
              <span>Iqra School SMS</span>
              <small>Academic operations</small>
            </div>
          </div>
        </div>

        <main
          key={location.pathname}
          className="page-enter page-content app-content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
