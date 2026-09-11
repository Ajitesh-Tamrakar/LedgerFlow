import { request } from './client'

/**
 * Create the user and their business in one call.
 *
 * Returns 201 with {"detail": "Verification e-mail sent."} -- no tokens,
 * because ACCOUNT_EMAIL_VERIFICATION is 'mandatory'. The caller's next step is
 * the verification screen, never the app.
 *
 * Registering an address that already has an unverified account also returns
 * 201, and deliberately so: it quietly reuses that account and re-sends a code
 * rather than creating a second one. The response is identical to an original
 * signup, so this screen has no "email taken" state to render and must not
 * invent one. An address that is already *verified* is a different matter and
 * does come back as a 400 on the email field.
 */
export function register(values) {
  return request('/auth/registration/', { method: 'POST', body: values, anonymous: true })
}

/**
 * Exchange a six-digit code for a verified email address.
 *
 * 200 on success. Failures arrive as {"code": ["..."]} with one of four
 * messages, and they are not interchangeable:
 *   "Incorrect code."                  -- a wrong digit, attempts remain
 *   "No active code. Request a new one." -- never issued, already spent, or
 *                                         burned through all five attempts
 *   "Code expired. Request a new one." -- past the fifteen-minute window
 *   "Too many attempts. Request a new one."
 * Only the first is worth retrying with the same code in hand.
 */
export function verifyEmail({ email, code }) {
  return request('/auth/otp/verify-email/', { method: 'POST', body: { email, code }, anonymous: true })
}

/**
 * Send a fresh verification code.
 *
 * Always answers 200 {"detail": "ok"}, whether it sent anything or not: an
 * unknown address gets the same response as a real one, on purpose, so the
 * endpoint can't be used to discover who has an account. The consequence for
 * the UI is that the response proves nothing, so the cooldown has to be ours.
 *
 * Each send invalidates the previous code. Someone who clicks resend and then
 * types the digits from the older email gets "Incorrect code."
 */
export function resendVerification(email) {
  return request('/auth/registration/resend-email/', { method: 'POST', body: { email }, anonymous: true })
}

/**
 * Sign in. 200 returns {access, refresh, user}, where user already carries the
 * nested business -- so the post-login bootstrap needs no second call to
 * /auth/user/.
 *
 * Both failure modes arrive as non_field_errors and have to be told apart by
 * their text: wrong credentials, or a correct password on an account whose
 * email was never verified.
 */
export function login({ email, password }) {
  return request('/auth/login/', { method: 'POST', body: { email, password }, anonymous: true })
}

/** True when a login failure was caused by an unverified email rather than bad
 *  credentials. Matching on the message text is fragile, but the server gives
 *  the two situations the same shape and no code to tell them apart. */
export function isUnverifiedEmailError(error) {
  const messages = error?.payload?.non_field_errors
  if (!Array.isArray(messages)) return false
  return messages.some((message) => /not verified/i.test(message))
}

/**
 * Ask for a password-reset code.
 *
 * Always 200 with the same sentence, whether or not the address has an
 * account: the endpoint refuses to confirm who is registered. It is also
 * silent when it does nothing -- otp.issue runs with enforce_cooldown=True, so
 * a second request inside sixty seconds sends no email and still answers 200.
 * Unlike the verification resend, this cooldown is real and server-side.
 */
export function requestPasswordReset(email) {
  return request('/auth/otp/password/request/', { method: 'POST', body: { email }, anonymous: true })
}

/**
 * Spend the code and set the new password. 200 on success.
 *
 * Failures land in three different places, which is why the form maps them by
 * hand rather than trusting one rule:
 *   {"new_password2": [...]}    -- the two entries differ
 *   {"code": [...]}             -- wrong, expired, spent, or an unknown email
 *                                  (an unknown address is reported as a bad
 *                                  code, again to avoid confirming accounts)
 *   {"non_field_errors": [...]} -- Django's password validators, which raise
 *                                  at the top level rather than on the field
 */
export function confirmPasswordReset(values) {
  return request('/auth/otp/password/confirm/', { method: 'POST', body: values, anonymous: true })
}

/**
 * End the session server-side by blacklisting the refresh token.
 *
 * Sent without an Authorization header: the view is AllowAny and reads the
 * token out of the body, so signing out keeps working even when the access
 * token has already expired. Verified against the running server.
 *
 * It answers 401 when the token is missing or already blacklisted, so the
 * caller must clear local state regardless of what comes back. A failed
 * blacklist is not a reason to keep someone signed in.
 *
 * Note what this does and does not revoke: the refresh token dies immediately,
 * but the access token stays valid until it expires on its own, up to an hour
 * later. Signing out caps the session, it does not cut it off.
 */
export function logout(refresh) {
  return request('/auth/logout/', { method: 'POST', body: { refresh }, anonymous: true })
}

/** The signed-in user, with their business nested. Same payload the login
 *  response carries, so the shell uses it to refresh what was cached at sign-in
 *  rather than trusting a copy that could be days old. */
export function getCurrentUser() {
  return request('/auth/user/')
}
