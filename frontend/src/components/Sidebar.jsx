import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { authAPI, yearendAPI } from '../services/api'
import { clearToken, getAuthUser, getRole } from '../services/auth'

const Icon = ({ children }) => (
  <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
)

const navGroups = [
  {
    label: 'Command',
    items: [
      {
        to: '/',
        end: true,
        label: 'Dashboard',
        roles: ['admin', 'teacher'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></Icon>,
      },
      {
        to: '/students',
        label: 'Students',
        roles: ['admin', 'teacher', 'student', 'parent'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></Icon>,
      },
      {
        to: '/enrollments',
        label: 'Enrollments',
        roles: ['admin', 'teacher'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 12h6m-6 4h6" /></Icon>,
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        to: '/attendance',
        label: 'Attendance',
        roles: ['admin', 'teacher'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></Icon>,
      },
      {
        to: '/marks',
        label: 'Marks',
        roles: ['admin', 'teacher'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></Icon>,
      },
      {
        to: '/setup/classes',
        label: 'Class Setup',
        roles: ['admin'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M15 9h.01M15 13h.01" /></Icon>,
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
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></Icon>,
      },
      {
        to: '/fees/defaulters',
        label: 'Defaulters',
        roles: ['admin'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></Icon>,
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
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" /></Icon>,
      },
      {
        to: '/analytics',
        label: 'Analytics',
        roles: ['admin'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v18m-6-8h12M5 8h8m-8 8h6m6 5l4-4-4-4" /></Icon>,
      },
      {
        to: '/notifications',
        label: 'Notifications',
        roles: ['admin'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 01-6 0" /></Icon>,
      },
      {
        to: '/yearend',
        label: 'Year-End',
        roles: ['admin'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998" /></Icon>,
      },
      {
        to: '/admin/users',
        label: 'User Management',
        roles: ['admin'],
        icon: <Icon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></Icon>,
      },
    ],
  },
]

function initials(value) {
  return (value || 'U').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate()
  const [yearLabel, setYearLabel] = useState(null)
  const user = getAuthUser()
  const role = getRole() || 'admin'

  useEffect(() => {
    yearendAPI.getCurrentYear()
      .then(res => { if (res.data?.label) setYearLabel(res.data.label) })
      .catch(() => {})
  }, [])

  const visibleGroups = useMemo(() => (
    navGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => !item.roles || item.roles.includes(role)),
      }))
      .filter(group => group.items.length > 0)
  ), [role])

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch {
      // Local sign-out should still complete if the token already expired.
    } finally {
      clearToken()
      navigate('/login')
    }
  }

  return (
    <>
      {open && <button className="sidebar-backdrop" onClick={onClose} aria-label="Close navigation" />}

      <aside className={`app-sidebar ${open ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-brand">
          <NavLink to="/" onClick={onClose} className="sidebar-brand-link">
            <span className="sidebar-brand-mark">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l6.16-3.422A12.083 12.083 0 0118.825 17.057 11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998" />
              </svg>
            </span>
            <span className="sidebar-brand-copy">
              <strong>Iqra School</strong>
              <small>{yearLabel ? `Academic year ${yearLabel}` : 'School management'}</small>
            </span>
          </NavLink>

          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {visibleGroups.map(group => (
            <section key={group.label} className="sidebar-group">
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  <span className="sidebar-link-label">{item.label}</span>
                </NavLink>
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials(user?.name || user?.username)}</div>
            <div className="sidebar-user-copy">
              <strong>{user?.name || user?.username || 'User'}</strong>
              <small>{role} access</small>
            </div>
            <button className="sidebar-logout" onClick={handleLogout} title="Sign out" aria-label="Sign out">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
