import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getCurrentUser, logout as logoutRequest } from '../api/auth'
import { setSessionExpiredHandler } from '../api/client'
import {
  clearSession,
  getRefreshToken,
  getUser,
  saveSession,
  saveUser,
} from '../api/session'

const AuthContext = createContext(null)

/**
 * Holds who is signed in, and owns the two transitions in and out of that
 * state. It reads storage once on mount rather than on every render, so a
 * reload restores the session without a request and without a flash of the
 * signed-out layout.
 */
export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => getUser())

  useEffect(() => {
    // The API client cannot import this module without a cycle, so it calls
    // back instead. This fires when a refresh has already been tried and
    // failed, meaning storage is cleared and only the UI is left to catch up.
    setSessionExpiredHandler(() => {
      setUser(null)
      navigate('/login', {
        replace: true,
        state: { notice: 'Your session expired. Sign in again.' },
      })
    })
    return () => setSessionExpiredHandler(null)
  }, [navigate])

  // Revalidate once per load. Three things fall out of it: a business renamed
  // in another session stops showing its old name, a session revoked server-side
  // is noticed immediately rather than on the first thing the user clicks, and
  // an access token that expired while the tab was closed gets refreshed before
  // any screen asks for data. A failure that isn't an expired session is left
  // alone -- being briefly offline should not throw anyone out.
  useEffect(() => {
    if (!getUser()) return undefined

    let cancelled = false
    getCurrentUser()
      .then((fresh) => {
        if (cancelled) return
        saveUser(fresh)
        setUser(fresh)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback((data) => {
    saveSession(data)
    setUser(data.user)
  }, [])

  const signOut = useCallback(async () => {
    const refresh = getRefreshToken()
    try {
      if (refresh) await logoutRequest(refresh)
    } catch {
      // A token that is already blacklisted, or a server that is unreachable,
      // answers with an error. Neither is a reason to leave someone signed in
      // on this device, so the local session ends either way.
    }
    clearSession()
    setUser(null)
    navigate('/login', { replace: true, state: { notice: 'Signed out.' } })
  }, [navigate])

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth must be used inside an AuthProvider.')
  }
  return value
}
