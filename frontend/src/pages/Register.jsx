import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { register } from '../api/auth'
import { readErrors } from '../api/client'
import Field from '../components/Field'

// Form state is keyed by the server's own field names rather than camelCase
// equivalents. It means one less translation layer, and a server error can be
// dropped straight onto the input it belongs to without a lookup table that
// would quietly rot the next time a field is renamed.
const EMPTY = {
  business_name: '',
  email: '',
  password1: '',
  password2: '',
}

const FIELDS = Object.keys(EMPTY)

/** Checks worth doing before spending a round trip. Everything else -- email
 *  format, password strength, uniqueness -- is the server's call, because it
 *  is the server's rule and duplicating it here guarantees the two drift. */
function validate(values) {
  const errors = {}
  if (!values.business_name.trim()) errors.business_name = 'Enter your business name.'
  if (!values.email.trim()) errors.email = 'Enter your email address.'
  if (!values.password1) errors.password1 = 'Choose a password.'
  else if (values.password2 !== values.password1) {
    // The server reports this as non_field_errors, which has no natural home
    // in the layout. Catching it here puts the message where the mistake is.
    errors.password2 = 'The two passwords do not match.'
  }
  return errors
}

export default function Register() {
  const navigate = useNavigate()
  const [values, setValues] = useState(EMPTY)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formErrors, setFormErrors] = useState([])
  const [pending, setPending] = useState(false)

  function update(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    // Clear the error the moment the user starts fixing it, so the message
    // doesn't sit there contradicting what is now on screen.
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending) return

    const localErrors = validate(values)
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      setFormErrors([])
      return
    }

    setPending(true)
    setFieldErrors({})
    setFormErrors([])
    try {
      await register(values)
      // Registration returns no token. The email is carried forward so the
      // verification screen doesn't have to ask for it a second time.
      navigate('/verify-email', { state: { email: values.email }, replace: true })
    } catch (error) {
      const { fields, form } = readErrors(error, FIELDS)
      setFieldErrors(fields)
      setFormErrors(form)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="auth">
      <header className="auth__head">
        <h1>Create your ledger</h1>
        <p>One account, one business. You will confirm your email before signing in.</p>
      </header>

      {formErrors.length > 0 && (
        <div className="alert" role="alert">
          {formErrors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Field
          name="business_name"
          label="Business name"
          value={values.business_name}
          error={fieldErrors.business_name}
          onChange={update}
          autoComplete="organization"
          autoFocus
        />
        <Field
          name="email"
          label="Email address"
          type="email"
          value={values.email}
          error={fieldErrors.email}
          onChange={update}
          autoComplete="email"
          hint="You sign in with this, and we send your confirmation code to it."
        />
        <Field
          name="password1"
          label="Password"
          type="password"
          value={values.password1}
          error={fieldErrors.password1}
          onChange={update}
          autoComplete="new-password"
        />
        <Field
          name="password2"
          label="Confirm password"
          type="password"
          value={values.password2}
          error={fieldErrors.password2}
          onChange={update}
          autoComplete="new-password"
        />

        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Creating your ledger…' : 'Create account'}
        </button>
      </form>

      <p className="auth__foot">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  )
}
