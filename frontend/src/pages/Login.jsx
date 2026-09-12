import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { isUnverifiedEmailError, login } from '../api/auth'
import { readErrors } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import Button from '../components/Button'
import Field from '../components/Field'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()

  // Where the guard bounced them from, so a deep link survives signing in.
  const from = location.state?.from ?? '/'

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formErrors, setFormErrors] = useState([])
  const [unverified, setUnverified] = useState(false)
  const [pending, setPending] = useState(false)

  // Whatever screen sent them here writes its own one-line message: confirmed
  // an email, changed a password, and later, an expired session. Keeping the
  // wording with the sender means this page doesn't grow a flag per origin.
  const notice = location.state?.notice

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending) return

    const errors = {}
    if (!email.trim()) errors.email = 'Enter your email address.'
    if (!password) errors.password = 'Enter your password.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormErrors([])
      return
    }

    setPending(true)
    setFieldErrors({})
    setFormErrors([])
    setUnverified(false)
    try {
      const data = await login({ email, password })
      // The response already carries the user and their business, so there is
      // no follow-up call to /auth/user/ before the app can paint.
      signIn(data)
      navigate(from, { replace: true })
    } catch (error) {
      if (isUnverifiedEmailError(error)) {
        // Right password, unconfirmed address. Saying "invalid credentials"
        // here would send someone off to reset a password that works fine.
        setUnverified(true)
        setFormErrors([])
      } else {
        const { fields, form } = readErrors(error, ['email', 'password'])
        setFieldErrors(fields)
        setFormErrors(form)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      lede="Your ledger, your dealers, and today's collection."
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="font-semibold text-brand">
            Create one
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {notice && !unverified && formErrors.length === 0 && <Alert tone="good">{notice}</Alert>}

        {unverified && (
          <Alert>
            <p>This email has not been confirmed yet.</p>
            <p>
              <Link to="/verify-email" state={{ email }}>
                Enter your code
              </Link>{' '}
              to finish setting up the account.
            </p>
          </Alert>
        )}

        {formErrors.length > 0 && (
          <Alert>
            {formErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field
            name="email"
            label="Email address"
            type="email"
            value={email}
            error={fieldErrors.email}
            onChange={(event) => {
              setEmail(event.target.value)
              setFieldErrors({})
              setUnverified(false)
            }}
            autoComplete="email"
            autoFocus={!location.state?.email}
          />
          <Field
            name="password"
            label="Password"
            type="password"
            value={password}
            error={fieldErrors.password}
            onChange={(event) => {
              setPassword(event.target.value)
              setFieldErrors({})
            }}
            autoComplete="current-password"
            autoFocus={Boolean(location.state?.email)}
          />

          <Button type="submit" busy={pending} className="mt-1 w-full">
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-[13px]">
          <Link to="/forgot-password" state={{ email }} className="font-medium text-brand">
            Forgot your password?
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
