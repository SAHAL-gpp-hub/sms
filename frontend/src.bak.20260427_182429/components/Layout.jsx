import { useState } from 'react'
import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'

// C-08 FIX: Added mobile sidebar toggle, overlay, and hamburger button.
// The sidebar is now responsive — hidden on mobile with a hamburger to open it.
export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* C-08 FIX: Mobile overlay — clicking it closes the sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0">
        {/* C-08 FIX: Hamburger button — only shown on mobile */}
        <button
          className="md:hidden mb-4 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Outlet />
      </main>
    </div>
  )
}