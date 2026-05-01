// Layout.jsx — Fully responsive with proper sidebar behavior
import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-1)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area — offset by sidebar width on desktop */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: 0,
          transition: 'margin-left 0.2s ease',
        }}
        className="main-content-area"
      >
        {/* Mobile top bar */}
        <div
          className="mobile-topbar"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'var(--gray-900)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              cursor: 'pointer',
              flexShrink: 0,
              touchAction: 'manipulation',
            }}
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
            <div style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Iqra School SMS
            </div>
          </div>
        </div>

        {/* Page content */}
        <main
          key={location.pathname}
          className="page-enter page-content"
          style={{
            flex: 1,
            padding: '24px 28px',
            maxWidth: '1400px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Responsive styles */}
      <style>{`
        /* Desktop: sidebar is fixed 224px, main content offsets */
        @media (min-width: 768px) {
          .mobile-topbar {
            display: none !important;
          }
          .main-content-area {
            margin-left: 224px !important;
          }
        }
        /* Mobile: no margin, topbar shows */
        @media (max-width: 767px) {
          .mobile-topbar {
            display: flex !important;
          }
          .main-content-area {
            margin-left: 0 !important;
          }
          .page-content {
            padding: 16px !important;
          }
        }
        @media (max-width: 480px) {
          .page-content {
            padding: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}