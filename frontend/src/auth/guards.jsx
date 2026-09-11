import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from './AuthContext'

/** Wraps every signed-in route. Remembers where someone was heading so they
 *  land there after signing in rather than on a generic home screen. */
export function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search, notice: 'Sign in to continue.' }}
      />
    )
  }
  return <Outlet />
}

/** Wraps the four public screens. Someone already signed in has no business on
 *  the sign-in or registration form, and letting them submit one would replace
 *  the session they already have. */
export function PublicOnly() {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
