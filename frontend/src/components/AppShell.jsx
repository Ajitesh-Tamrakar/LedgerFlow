import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

// The eight destinations from the page map. Every one of them routes
// somewhere today, even where the screen behind it is still a placeholder --
// a navigation frame that only half-works is harder to judge than one that is
// complete and honest about what is missing.
const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/cashbook', label: 'Cashbook' },
  { to: '/dealers', label: 'Dealers' },
  { to: '/bills', label: 'Bills' },
  { to: '/payments', label: 'Payments' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/reports/outstanding', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

export default function AppShell() {
  const { user, signOut } = useAuth()
  const [leaving, setLeaving] = useState(false)

  async function handleSignOut() {
    if (leaving) return
    setLeaving(true)
    // signOut navigates on completion, so there is no state to reset here.
    await signOut()
  }

  return (
    <div className="shell">
      <header className="shell__bar">
        <div className="shell__identity">
          <p className="shell__business">{user.business?.name ?? 'Your business'}</p>
          <p className="shell__account">{user.email}</p>
        </div>
        <button type="button" className="button button--quiet" onClick={handleSignOut} disabled={leaving}>
          {leaving ? 'Signing out…' : 'Sign out'}
        </button>
      </header>

      <nav className="shell__nav" aria-label="Sections">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'shell__link shell__link--on' : 'shell__link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="shell__body">
        <Outlet />
      </div>
    </div>
  )
}
