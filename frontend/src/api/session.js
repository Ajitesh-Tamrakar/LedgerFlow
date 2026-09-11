// Where the signed-in session lives on the client.
//
// REST_AUTH['JWT_AUTH_HTTPONLY'] is False, so Django hands the tokens back in
// the response body rather than setting a cookie. That is a deliberate backend
// choice (logout has to read `refresh` out of the request body to blacklist
// it), and it makes token storage the frontend's problem.
//
// localStorage is the pragmatic pick: the session survives a reload and a
// closed tab, which is what anyone expects from a bookkeeping app they use all
// day. The cost is that any script running on this origin can read it, so an
// XSS bug becomes a stolen session. Everything that touches storage goes
// through this one module, so swapping to sessionStorage or to memory-only is
// a change in one file rather than a hunt through the app.

const ACCESS = 'ledgerflow.access'
const REFRESH = 'ledgerflow.refresh'
const USER = 'ledgerflow.user'

/** Storage throws in private-mode Safari and when a browser is set to block
 *  site data. A thrown error while reading a token should log you out, not
 *  crash the page. */
function safely(operation, fallback = null) {
  try {
    return operation()
  } catch {
    return fallback
  }
}

export function saveSession({ access, refresh, user }) {
  safely(() => {
    localStorage.setItem(ACCESS, access)
    localStorage.setItem(REFRESH, refresh)
    localStorage.setItem(USER, JSON.stringify(user))
  })
}

export function clearSession() {
  safely(() => {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
    localStorage.removeItem(USER)
  })
}

export function getAccessToken() {
  return safely(() => localStorage.getItem(ACCESS))
}

export function getRefreshToken() {
  return safely(() => localStorage.getItem(REFRESH))
}

/** The user payload cached at login: pk, email, username, names, and the
 *  nested {id, name} business. Enough to paint a header without a second call. */
export function getUser() {
  const raw = safely(() => localStorage.getItem(USER))
  if (!raw) return null
  return safely(() => JSON.parse(raw))
}

/** Replace just the token pair, keeping the cached user.
 *
 *  Used after a refresh. SIMPLE_JWT has ROTATE_REFRESH_TOKENS on with
 *  BLACKLIST_AFTER_ROTATION, so every refresh returns a *new* refresh token and
 *  invalidates the one that was spent. Storing only the new access token and
 *  keeping the old refresh would work exactly once, then log the user out. */
export function saveTokens({ access, refresh }) {
  safely(() => {
    if (access) localStorage.setItem(ACCESS, access)
    if (refresh) localStorage.setItem(REFRESH, refresh)
  })
}

/** Replace the cached user, keeping the tokens. Used by the shell's
 *  once-per-load revalidation. */
export function saveUser(user) {
  safely(() => localStorage.setItem(USER, JSON.stringify(user)))
}
