// frontend/src/layouts/PortalLayout.jsx
// Mobile-first layout for Student & Parent Portal
// Supports multi-child switching for parent accounts

import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getAuthUser, clearToken } from '../services/auth'
import { portalAPI } from '../services/api'

const NAV_ITEMS = [
  {
    to: '/portal',
    end: true,
    label: 'Home',
    icon: (active) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d={active
            ? 'M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z'
            : 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
          }
        />
      </svg>
    ),
  },
  {
    to: '/portal/results',
    label: 'Results',
    icon: (active) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    to: '/portal/attendance',
    label: 'Attendance',
    icon: (active) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    to: '/portal/fees',
    label: 'Fees',
    icon: (active) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    to: '/portal/profile',
    label: 'Profile',
    icon: (active) => (
      <svg width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
]

// ── Child Switcher Dropdown ───────────────────────────────────────────────────
function ChildSwitcher({ children, selectedId, onSelect }) {
  const [open, setOpen] = useState(false)
  const selected = children.find(c => c.id === selectedId) || children[0]

  if (children.length <= 1) return null

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '20px',
          cursor: 'pointer',
          color: 'white',
          fontSize: '12px',
          fontWeight: 700,
          touchAction: 'manipulation',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        {selected?.name_en?.split(' ')[0] || 'Select'}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 50,
            background: 'white',
            borderRadius: '14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: '200px',
            overflow: 'hidden',
            border: '1px solid #e0eded',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f7f7' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Switch Student ({children.length})
              </div>
            </div>
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => { onSelect(child.id); setOpen(false) }}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: child.id === selectedId ? '#f0f7f7' : 'white',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderBottom: '1px solid #f8fafc',
                  fontFamily: 'Nunito, sans-serif',
                  touchAction: 'manipulation',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (child.id !== selectedId) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={e => { if (child.id !== selectedId) e.currentTarget.style.background = 'white' }}
              >
                {/* Avatar */}
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: child.id === selectedId
                    ? 'linear-gradient(135deg, #0d7377, #14a085)'
                    : 'linear-gradient(135deg, #64748b, #94a3b8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 900, color: 'white', flexShrink: 0,
                }}>
                  {(child.name_en || 'S').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13.5px', fontWeight: 700,
                    color: child.id === selectedId ? '#0d7377' : '#0f172a',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {child.name_en}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    Std {child.class_id} · Roll {child.roll_number || '—'}
                  </div>
                </div>
                {child.id === selectedId && (
                  <svg width="16" height="16" fill="none" stroke="#0d7377" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Link Confirmation Banner ──────────────────────────────────────────────────
function LinkedStudentsBanner({ children, isParent }) {
  const [dismissed, setDismissed] = useState(false)
  if (!isParent || dismissed || children.length === 0) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.12)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '10px',
      padding: '8px 12px',
      margin: '0 16px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '11.5px',
      color: 'rgba(255,255,255,0.9)',
      fontWeight: 600,
    }}>
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span style={{ flex: 1 }}>
        {children.length} student{children.length !== 1 ? 's' : ''} linked to your account
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '0', fontSize: '16px', lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export default function PortalLayout() {
  const navigate = useNavigate()
  const authUser = getAuthUser()
  const isParent = authUser?.role === 'parent'

  // For parent: all linked children; for student: single profile
  const [children, setChildren]           = useState([])     // parent's children list
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [profile, setProfile]             = useState(null)   // active student's profile
  const [loadingProfile, setLoadingProfile] = useState(true)

  // ── Fetch children list (parent only) ─────────────────────────────────────
  useEffect(() => {
    if (isParent) {
      portalAPI.getChildren()
        .then(r => {
          const list = r.data || []
          setChildren(list)
          if (list.length > 0 && !selectedStudentId) {
            setSelectedStudentId(list[0].id)
          }
        })
        .catch(() => {})
    }
  }, [isParent])

  // ── Fetch active profile ───────────────────────────────────────────────────
  useEffect(() => {
    setLoadingProfile(true)
    const params = isParent && selectedStudentId ? selectedStudentId : undefined
    portalAPI.getProfile(params)
      .then(r => { setProfile(r.data); setLoadingProfile(false) })
      .catch(() => setLoadingProfile(false))
  }, [selectedStudentId, isParent])

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  const studentName = profile?.name_en || authUser?.name || 'Student'
  const classLabel  = profile ? `Std ${profile.class_id}` : ''

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

        .portal-root {
          font-family: 'Nunito', system-ui, sans-serif;
          background: #f0f7f7;
          min-height: 100vh;
          display: flex;
          justify-content: center;
        }
        .portal-shell {
          width: 100%;
          max-width: 480px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f0f7f7;
          position: relative;
        }
        .portal-header {
          background: linear-gradient(135deg, #0d7377 0%, #14a085 60%, #0d7377 100%);
          padding: 14px 16px 12px;
          position: sticky;
          top: 0;
          z-index: 20;
          box-shadow: 0 2px 12px rgba(13, 115, 119, 0.3);
        }
        .portal-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 0;
        }
        .portal-header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .portal-logo {
          width: 36px; height: 36px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
          flex-shrink: 0;
        }
        .portal-header-text h1 {
          font-size: 14px; font-weight: 900; color: white;
          line-height: 1.2; letter-spacing: -0.02em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .portal-header-text p {
          font-size: 11px; color: rgba(255,255,255,0.72); font-weight: 600; margin-top: 1px;
        }
        .portal-logout-btn {
          width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.15); border: none; border-radius: 10px;
          cursor: pointer; color: white; transition: background 0.15s;
          flex-shrink: 0; touch-action: manipulation;
        }
        .portal-logout-btn:hover { background: rgba(255,255,255,0.25); }

        .portal-main {
          flex: 1; overflow-y: auto;
          padding: 16px 16px 100px;
          -webkit-overflow-scrolling: touch;
        }
        .portal-bottom-nav {
          position: fixed; bottom: 0;
          left: 50%; transform: translateX(-50%);
          width: 100%; max-width: 480px;
          background: white; border-top: 1px solid #e0eded;
          display: flex; z-index: 30;
          box-shadow: 0 -4px 20px rgba(13, 115, 119, 0.1);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .portal-nav-item {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 8px 4px 6px; text-decoration: none;
          border: none; background: transparent; cursor: pointer;
          transition: all 0.15s; gap: 3px; touch-action: manipulation;
          -webkit-tap-highlight-color: transparent; min-height: 56px;
        }
        .portal-nav-item span {
          font-size: 10px; font-weight: 700;
          font-family: 'Nunito', sans-serif; letter-spacing: 0.01em;
        }
        .portal-nav-active { color: #0d7377; }
        .portal-nav-inactive { color: #94a3b8; }

        @media (min-width: 481px) {
          .portal-shell { box-shadow: 0 0 40px rgba(0,0,0,0.08); }
        }
      `}</style>

      <div className="portal-root">
        <div className="portal-shell">

          {/* Header */}
          <header className="portal-header">
            <div className="portal-header-row">
              <div className="portal-header-brand">
                <div className="portal-logo">
                  <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>
                <div className="portal-header-text">
                  <h1>{loadingProfile ? 'Loading…' : studentName}</h1>
                  {classLabel && <p>{classLabel} · Iqra School</p>}
                </div>
              </div>

              {/* Parent multi-child switcher */}
              {isParent && children.length > 1 && (
                <ChildSwitcher
                  children={children}
                  selectedId={selectedStudentId}
                  onSelect={setSelectedStudentId}
                />
              )}

              <button className="portal-logout-btn" onClick={handleLogout} title="Logout">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>

            {/* Link confirmation banner — shown once for parents */}
            <div style={{ marginTop: children.length > 0 && isParent ? '8px' : 0 }}>
              <LinkedStudentsBanner children={children} isParent={isParent} />
            </div>
          </header>

          {/* Main content — passes selected student context down */}
          <main className="portal-main">
            <Outlet context={{
              profile,
              studentName,
              selectedStudentId,
              isParent,
              children,          // all linked children (for parent)
              loadingProfile,
            }} />
          </main>

          {/* Bottom nav */}
          <nav className="portal-bottom-nav">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `portal-nav-item ${isActive ? 'portal-nav-active' : 'portal-nav-inactive'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.icon(isActive)}
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}