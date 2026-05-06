// Sidebar.jsx — Fully responsive with proper mobile drawer behavior
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { clearToken, getRole } from '../services/auth'
import { yearendAPI } from '../services/api'
import { getAuthUser } from '../services/auth'

const user = getAuthUser()
const navGroups = [
  {
    label: 'Admin',
    items: [
      {
        to: '/admin/users',
        label: 'User Management',
        roles: ['admin'],
        icon: (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Students',
    items: [
      {
        to: '/students',
        label: 'Students',
        roles: ['admin', 'teacher', 'student', 'parent'],
        icon: (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        to: '/marks',
        label: 'Marks',
        roles: ['admin', 'teacher'],
        icon: (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        to: '/attendance',
        label: 'Attendance',
        roles: ['admin', 'teacher'],
        icon: (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        to: '/fees',
        label: 'Fee Structure',
        roles: ['admin'],
        icon: (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        ),
      },
      {
        to: '/fees/defaulters',
        label: 'Defaulters',
        roles: ['admin'],
        icon: (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        to: '/reports',
        label: 'Reports',
        roles: ['admin', 'teacher'],
        icon: (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        to: '/yearend',
        label: 'Year-End',
        roles: ['admin'],
        icon: (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        ),
      },
    ],
  },
]

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate()
  const [yearLabel, setYearLabel] = useState(null)
  const role = getRole() || 'admin'

  useEffect(() => {
    yearendAPI.getCurrentYear()
      .then(res => { if (res.data?.label) setYearLabel(res.data.label) })
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile backdrop overlay */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar panel */}
      <aside
        style={{
          width: '224px',
          minHeight: '100vh',
          background: 'var(--gray-900)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
        className={open ? 'sidebar-open' : 'sidebar-closed'}
      >
        {/* Logo / branding */}
        <div style={{
          padding: '16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <NavLink
            to="/"
            onClick={onClose}
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}
          >
            <div style={{
              width: '34px',
              height: '34px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
            }}>
              <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Iqra School
              </div>
              {yearLabel && (
                <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '0.02em' }}>
                  AY {yearLabel}
                </div>
              )}
            </div>
          </NavLink>

          {/* Close button — visible on mobile */}
          <button
            onClick={onClose}
            className="sidebar-close-btn"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              flexShrink: 0,
              touchAction: 'manipulation',
            }}
            aria-label="Close sidebar"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dashboard link */}
        <div style={{ padding: '10px 10px 4px' }}>
          <NavLink
            to="/"
            end
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '9px 10px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '13.5px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
              background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
              transition: 'all 0.15s',
              border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              touchAction: 'manipulation',
              minHeight: '40px',
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </span>
                Dashboard
              </>
            )}
          </NavLink>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: '4px 10px 10px', overflowY: 'auto' }}>
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: '4px' }}>
              <div style={{
                fontSize: '9.5px',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.22)',
                padding: '10px 10px 4px',
              }}>
                {group.label}
              </div>
              {group.items.filter(item => !item.roles || item.roles.includes(role)).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                    background: isActive ? 'rgba(59,130,246,0.18)' : 'transparent',
                    border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                    transition: 'all 0.15s',
                    marginBottom: '1px',
                    touchAction: 'manipulation',
                    minHeight: '40px',
                  })}
                  className="nav-link-item"
                >
                  {({ isActive }) => (
                    <>
                      <span style={{ color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                        {item.icon}
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: '12px 10px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
          }}>

            {/* Avatar */}
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 800,
              color: 'white',
              flexShrink: 0,
            }}>
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>

            {/* User Info */}
            <div style={{ flex: 1, minWidth: 0 }}>

              <div style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'white',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user?.name || user?.username || 'Unknown User'}
              </div>

              <div style={{
                fontSize: '10.5px',
                color: 'rgba(255,255,255,0.35)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                Iqra School · GSEB
              </div>

            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.35)',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
                touchAction: 'manipulation',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <style>{`
        /* Desktop: sidebar always visible */
        @media (min-width: 768px) {
          .sidebar-closed,
          .sidebar-open {
            transform: translateX(0) !important;
          }
          .sidebar-close-btn {
            display: none !important;
          }
        }
        /* Mobile: sidebar slides in/out */
        @media (max-width: 767px) {
          .sidebar-closed {
            transform: translateX(-100%);
          }
          .sidebar-open {
            transform: translateX(0);
          }
        }
        .nav-link-item:hover {
          color: rgba(255,255,255,0.85) !important;
          background: rgba(255,255,255,0.05) !important;
        }
      `}</style>
    </>
  )
}
