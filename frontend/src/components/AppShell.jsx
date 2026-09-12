import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import Button from './Button'
import {
  IconBills,
  IconCashbook,
  IconDashboard,
  IconDealers,
  IconMore,
  IconPayments,
  IconReports,
  IconSettings,
  IconSignOut,
  IconTasks,
} from './icons'

// The eight destinations from the page map. Every one routes somewhere today,
// even where the screen behind it is still a placeholder -- a navigation frame
// that only half-works is harder to judge than one that is complete and honest
// about what is missing.
//
// `primary` marks the five that earn a place on the phone's bottom bar. The
// other three live behind More, which is the whole reason the flag exists.
const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true, primary: true },
  { to: '/cashbook', label: 'Cashbook', Icon: IconCashbook, primary: true },
  { to: '/bills', label: 'Bills', Icon: IconBills, primary: true },
  { to: '/payments', label: 'Payments', Icon: IconPayments, primary: true },
  { to: '/dealers', label: 'Dealers', Icon: IconDealers },
  { to: '/tasks', label: 'Tasks', Icon: IconTasks },
  { to: '/reports/outstanding', label: 'Reports', Icon: IconReports },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
]

const PRIMARY = NAV.filter((item) => item.primary)
const SECONDARY = NAV.filter((item) => !item.primary)

function railClass({ isActive }) {
  return [
    'flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors duration-150',
    isActive
      ? 'bg-brand-soft font-semibold text-brand'
      : 'text-ink-2 hover:bg-sunken hover:text-ink',
  ].join(' ')
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const still = useReducedMotion()

  const [leaving, setLeaving] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // A navigation that leaves its own menu standing is a bug people notice
  // immediately, so the sheet closes whenever the route actually changes.
  useEffect(() => setMoreOpen(false), [location.pathname])

  async function handleSignOut() {
    if (leaving) return
    setLeaving(true)
    // signOut navigates on completion, so there is no state to reset here.
    await signOut()
  }

  const business = user.business?.name ?? 'Your business'

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* --- the rail, from lg up ------------------------------------- */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule bg-surface lg:flex">
        <div className="border-b border-rule-soft px-5 py-5">
          <p className="truncate font-display text-base font-bold tracking-tight">{business}</p>
          <p className="truncate text-xs text-ink-2">{user.email}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Sections">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={railClass}>
              <Icon className="size-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-rule-soft p-3">
          <Button variant="quiet" busy={leaving} onClick={handleSignOut} className="w-full justify-start">
            {!leaving && <IconSignOut className="size-5 shrink-0" />}
            {leaving ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </aside>

      {/* --- the phone header ----------------------------------------- */}
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-rule bg-surface px-5 py-3 lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-bold tracking-tight">{business}</p>
            <p className="truncate text-xs text-ink-2">{user.email}</p>
          </div>
          <Button variant="secondary" busy={leaving} onClick={handleSignOut}>
            {leaving ? 'Signing out…' : 'Sign out'}
          </Button>
        </header>

        {/* Routes cross-fade, they never slide. Sliding would imply the
            sections sit beside each other in space, and Bills and Payments
            are siblings, not neighbours. */}
        <main className="flex-1 px-5 pt-6 pb-28 lg:px-8 lg:pt-8 lg:pb-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: still ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.2,
                ease: [0.2, 0, 0, 1],
                exit: { duration: 0.16, ease: [0.4, 0, 1, 1] },
              }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* --- the phone bottom bar ------------------------------------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Sections"
      >
        {PRIMARY.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors duration-150 ${
                isActive ? 'text-brand' : 'text-ink-2'
              }`
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors duration-150 ${
            moreOpen ? 'text-brand' : 'text-ink-2'
          }`}
        >
          <IconMore className="size-5" />
          More
        </button>
      </nav>

      {/* --- More, holding the three sections the bar has no room for -- */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setMoreOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-ink/35 lg:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: still ? 0 : '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: still ? 0 : '100%' }}
              transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="fixed inset-x-0 bottom-0 z-40 rounded-t-tile border-t border-rule bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-float lg:hidden"
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-rule" aria-hidden="true" />
              {SECONDARY.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} className={railClass}>
                  <Icon className="size-5 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
