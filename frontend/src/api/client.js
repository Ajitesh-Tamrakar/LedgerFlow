// One place that knows how to talk to Django, how to read its errors, and how
// to keep an access token alive.
//
// Every DRF validation failure comes back as 400 with a flat object of
// field -> [messages], plus the special key `non_field_errors` for anything
// that isn't about a single field. Auth failures come back as {"detail": ...}.
// Turning that into something a form can render is half the job here; the
// other half is the refresh dance below.

import { clearSession, getAccessToken, getRefreshToken, saveTokens } from './session'

const BASE = '/api'

/** Thrown for any non-2xx response. `payload` is the parsed body when the
 *  server sent JSON, and null when it sent HTML (a 500 page, usually). */
export class ApiError extends Error {
  constructor(status, payload) {
    super(`Request failed with ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

/** Thrown when the request never reached the server at all. Worth keeping
 *  separate: "your connection dropped" and "the server said no" need
 *  different words on screen. */
export class NetworkError extends Error {
  constructor(cause) {
    super('Could not reach the server.')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

// --- session expiry ---------------------------------------------------------

let onSessionExpired = () => {}

/** The app registers what should happen when the session can no longer be
 *  rescued: clear the user and send them to sign in. Kept as a callback rather
 *  than an import so this module never has to know about React or routing. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler ?? (() => {})
}

// --- refreshing -------------------------------------------------------------

// Exactly one refresh may be in flight at a time, and everyone who needs a new
// token waits on the same promise.
//
// This is not an optimisation, it is a correctness requirement. Rotation is on,
// so a refresh invalidates the token it consumed. Fire three refreshes with the
// same stored token and the first rotates it while the other two present a
// blacklisted token, get 401, and log the user out. A dashboard that loads four
// panels at once would do exactly that on the first expired access token.
let refreshInFlight = null

async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) return false

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      // A bare fetch on purpose: routing this through request() would attach
      // the dead access token and recurse straight back into here.
      const response = await fetch(`${BASE}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      if (!response.ok) return false
      saveTokens(await response.json())
      return true
    })()
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }

  return refreshInFlight
}

// --- requests ---------------------------------------------------------------

/**
 * @param {string} path        appended to /api
 * @param {object} options
 * @param {boolean} options.anonymous
 *   Send no Authorization header and never try to refresh. Set it on the auth
 *   endpoints: they are all AllowAny, and attaching an expired access token
 *   would have DRF reject the request before the view ever runs -- which would
 *   make it impossible to sign in, or out, while holding a stale token.
 */
export async function request(path, { method = 'GET', body, signal, anonymous = false } = {}) {
  const send = () => {
    const headers = {}
    if (body) headers['Content-Type'] = 'application/json'
    if (!anonymous) {
      const token = getAccessToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }
    return fetch(`${BASE}${path}`, {
      method,
      signal,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  // Remember which token this request actually went out with. Two guards are
  // needed and they cover different windows: the shared promise below catches
  // requests that fail while a refresh is already running, and this comparison
  // catches the ones that fail just *after* it finished. Without the second,
  // five parallel calls produce five refreshes, because each 401 arrives after
  // the previous refresh has already cleared the shared promise.
  const tokenUsed = !anonymous ? getAccessToken() : null
  let response = await attempt(send)

  if (response.status === 401 && tokenUsed) {
    // A different request may have replaced the token while this one was in
    // the air. If so there is nothing to refresh -- just go again with the new
    // one. Refreshing here would spend a token that is already rotated.
    const alreadyRenewed = getAccessToken() !== tokenUsed
    const refreshed = alreadyRenewed || (await refreshAccessToken())

    if (refreshed) {
      response = await attempt(send)
    }
    if (!refreshed || response.status === 401) {
      // The refresh token is gone, expired, or already blacklisted. Nothing
      // left to try, so end the session rather than letting the app sit there
      // firing requests that will all fail the same way.
      clearSession()
      onSessionExpired()
    }
  }

  return parse(response)
}

async function attempt(send) {
  try {
    return await send()
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause
    throw new NetworkError(cause)
  }
}

async function parse(response) {
  // 204 has no body to parse; DRF uses it for some deletes.
  if (response.status === 204) {
    if (!response.ok) throw new ApiError(response.status, null)
    return null
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) throw new ApiError(response.status, payload)
  return payload
}

// --- errors -----------------------------------------------------------------

/**
 * Split a DRF error payload into per-field messages and form-level ones.
 *
 * `known` lists the fields the form actually renders. Anything the server
 * complains about that isn't in that list gets promoted to a form-level
 * message, so a server-side rule we forgot to mirror still reaches the user
 * instead of vanishing into an object nobody reads.
 */
export function readErrors(error, known = []) {
  if (error instanceof NetworkError) {
    return { fields: {}, form: [error.message] }
  }
  if (!(error instanceof ApiError)) {
    return { fields: {}, form: ['Something went wrong. Please try again.'] }
  }
  if (error.payload === null) {
    return { fields: {}, form: [`The server returned an error (${error.status}).`] }
  }
  if (typeof error.payload.detail === 'string') {
    return { fields: {}, form: [error.payload.detail] }
  }

  const fields = {}
  const form = []
  for (const [key, value] of Object.entries(error.payload)) {
    // DRF sends arrays, but a custom serializer can send a bare string.
    const message = Array.isArray(value) ? value.join(' ') : String(value)
    if (known.includes(key)) fields[key] = message
    else form.push(message)
  }
  return { fields, form }
}
