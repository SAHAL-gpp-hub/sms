// Layout.jsx — Fixed sidebar overlap issue
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-1)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/*
        ✅ FIX: Remove `marginLeft: 0` from inline style entirely.
        Let Tailwind's `md:ml-[224px]` handle the desktop offset.
        Inline style was overriding the Tailwind class!
      */}
      <div
        className="md:ml-[224px]"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          // ❌ REMOVED: marginLeft: 0  ← this was the culprit
        }}
      >

        {/* Mobile top bar */}
        <div
          className="md:hidden"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'var(--gray-900)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Open navigation"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
            Iqra School SMS
          </div>
        </div>

        {/* Page content */}
        <main
          key={location.pathname}
          className="page-enter"
          style={{
            flex: 1,
            padding: '28px 32px',
            maxWidth: '1400px',
            width: '100%',
            // ✅ Centers content when viewport is very wide
            // but doesn't break the layout
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}