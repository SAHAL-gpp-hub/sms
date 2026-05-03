// frontend/src/layouts/PortalLayout.jsx
// Mobile-first layout for Student & Parent Portal
// Bottom navigation like a native app, max-width 480px, teal school branding

import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
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
          d={active
            ? 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            : 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
          }
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
          d={active
            ? 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
            : 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
          }
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
          d={active
            ? 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'
            : 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'
          }
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
          d={active
            ? 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            : 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z'
          }
        />
      </svg>
    ),
  },
]

export default function PortalLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getAuthUser()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    portalAPI.getProfile()
      .then(r => setProfile(r.data))
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  const studentName = profile?.name_en || user?.name || 'Student'
  const className   = profile ? `Std ${profile.class_id}` : ''

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
          padding: 16px 20px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 20;
          box-shadow: 0 2px 12px rgba(13, 115, 119, 0.3);
        }

        .portal-header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .portal-logo {
          width: 36px;
          height: 36px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
          flex-shrink: 0;
        }

        .portal-header-text h1 {
          font-size: 15px;
          font-weight: 900;
          color: white;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }

        .portal-header-text p {
          font-size: 11.5px;
          color: rgba(255,255,255,0.75);
          font-weight: 600;
          margin-top: 1px;
        }

        .portal-logout-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          color: white;
          transition: background 0.15s;
          flex-shrink: 0;
          touch-action: manipulation;
        }
        .portal-logout-btn:hover { background: rgba(255,255,255,0.25); }

        .portal-main {
          flex: 1;
          overflow-y: auto;
          padding: 16px 16px 100px;
          -webkit-overflow-scrolling: touch;
        }

        .portal-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 480px;
          background: white;
          border-top: 1px solid #e0eded;
          display: flex;
          z-index: 30;
          box-shadow: 0 -4px 20px rgba(13, 115, 119, 0.1);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        .portal-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 4px 6px;
          text-decoration: none;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s;
          gap: 3px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          min-height: 56px;
        }

        .portal-nav-item span {
          font-size: 10px;
          font-weight: 700;
          font-family: 'Nunito', sans-serif;
          letter-spacing: 0.01em;
        }

        .portal-nav-active {
          color: #0d7377;
        }
        .portal-nav-inactive {
          color: #94a3b8;
        }

        /* Active dot indicator */
        .portal-nav-active-dot {
          width: 4px;
          height: 4px;
          background: #0d7377;
          border-radius: 50%;
          position: absolute;
          top: 6px;
        }

        @media (min-width: 481px) {
          .portal-shell {
            box-shadow: 0 0 40px rgba(0,0,0,0.08);
          }
          .portal-bottom-nav {
            border-radius: 0;
          }
        }
      `}</style>

      <div className="portal-root">
        <div className="portal-shell">
          {/* Header */}
          <header className="portal-header">
            <div className="portal-header-brand">
              <div className="portal-logo">
                <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <div className="portal-header-text">
                <h1>{studentName}</h1>
                {className && <p>{className} · Iqra School</p>}
              </div>
            </div>
            <button className="portal-logout-btn" onClick={handleLogout} title="Logout">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </header>

          {/* Main content */}
          <main className="portal-main">
            <Outlet context={{ profile, studentName }} />
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