import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { confirmPasswordReset, requestPasswordReset } from '../api/auth'
import { readErrors } from '../api/client'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import Button from '../components/Button'
import Field from '../components/Field'

const CODE_LENGTH = 6

// Matches the server's own window. otp.issue runs with enforce_cooldown=True
// for password resets, so a second request inside sixty seconds sends nothing
// and still answers 200. Holding the button for the same sixty seconds is the
// only way the screen can tell the truth about what just happened.
const COOLDOWN_SECONDS = 60

// No `email` here on purpose. Step two is only reachable once step one has
// already had the address accepted, so the form has no email input to put an
// error on. Leaving it off the list means an unexpected one is promoted to the
// banner instead of being written to a field nobody renders.
const RESET_FIELDS = ['code', 'new_password1', 'new_password2']

/** Two steps, one route. The second step is only ever entered by completing
 *  the first, so it holds no address field of its own. */
const ASK = 'ask'
const RESET = 'reset'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const location = useLocation()

  const [step, setStep] = useState(ASK)
  const [email, setEmail] = useState(location.state?.email ?? '')
  const [code, setCode] = useState('')
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')

  const [fieldErrors, setFieldErrors] = useState({})
  const [formErrors, setFormErrors] = useState([])
  const [pending, setPending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  function clearErrors() {
    setFieldErrors({})
    setFormErrors([])
  }

  async function sendCode(nextStep) {
    if (!email.trim()) {
      setFieldErrors({ email: 'Enter your email address.' })
      return false
    }
    setPending(true)
    clearErrors()
    try {
      await requestPasswordReset(email)
      setCooldown(COOLDOWN_SECONDS)
      if (nextStep) setStep(RESET)
      return true
    } catch (error) {
      const { fields, form } = readErrors(error, ['email'])
      setFieldErrors(fields)
      setFormErrors(form)
      return false
    } finally {
      setPending(false)
    }
  }

  async function handleAsk(event) {
    event.preventDefault()
    if (pending) return
    await sendCode(true)
  }

  async function handleReset(event) {
    event.preventDefault()
    if (pending) return

    const errors = {}
    if (code.length !== CODE_LENGTH) errors.code = `Enter all ${CODE_LENGTH} digits.`
    if (!password1) errors.new_password1 = 'Choose a new password.'
    else if (password1 !== password2) errors.new_password2 = 'The two passwords do not match.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormErrors([])
      return
    }

    setPending(true)
    clearErrors()
    try {
      await confirmPasswordReset({
        email,
        code,
        new_password1: password1,
        new_password2: password2,
      })
      navigate('/login', {
        replace: true,
        state: { email, notice: 'Password updated. Sign in with your new password.' },
      })
    } catch (error) {
      const { fields, form } = readErrors(error, RESET_FIELDS)
      let remaining = form

      // Django's password validators raise at the serializer level, so "too
      // short" and "too common" arrive as non_field_errors even though they
      // are unambiguously about the new password. Put them where the mistake
      // is. A throttle response carries `detail` instead and is left alone, so
      // it still reaches the banner.
      const validatorMessages = error?.payload?.non_field_errors
      if (Array.isArray(validatorMessages) && validatorMessages.length > 0) {
        const joined = validatorMessages.join(' ')
        fields.new_password1 = joined
        remaining = form.filter((message) => message !== joined)
      }

      setFieldErrors(fields)
      setFormErrors(remaining)
    } finally {
      setPending(false)
    }
  }

  const banner = formErrors.length > 0 && (
    <Alert>
      {formErrors.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </Alert>
  )

  if (step === ASK) {
    return (
      <AuthLayout
        step="Step 1 of 2"
        title="Reset your password"
        lede={`Tell us the address on your account and we will send a ${CODE_LENGTH}-digit code.`}
        footer={
          <>
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-brand">
              Sign in
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {banner}

          <form onSubmit={handleAsk} noValidate className="flex flex-col gap-4">
            <Field
              name="email"
              label="Email address"
              type="email"
              value={email}
              error={fieldErrors.email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearErrors()
              }}
              autoComplete="email"
              autoFocus
            />

            <Button type="submit" busy={pending} className="mt-1 w-full">
              {pending ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      step="Step 2 of 2"
      title="Choose a new password"
      lede={`Enter the code sent to ${email}. It expires in 10 minutes.`}
      footer={
        <button
          type="button"
          className="font-semibold text-brand underline"
          onClick={() => {
            clearErrors()
            setCode('')
            setStep(ASK)
          }}
        >
          Use a different email address
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {banner}

        <form onSubmit={handleReset} noValidate className="flex flex-col gap-4">
          <Field
            name="code"
            label="Reset code"
            className="control-code"
            value={code}
            error={fieldErrors.code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
              clearErrors()
            }}
            inputMode="numeric"
            maxLength={CODE_LENGTH}
            autoComplete="one-time-code"
            autoFocus
          />

          <Field
            name="new_password1"
            label="New password"
            type="password"
            value={password1}
            error={fieldErrors.new_password1}
            onChange={(event) => {
              setPassword1(event.target.value)
              clearErrors()
            }}
            autoComplete="new-password"
          />

          <Field
            name="new_password2"
            label="Confirm new password"
            type="password"
            value={password2}
            error={fieldErrors.new_password2}
            onChange={(event) => {
              setPassword2(event.target.value)
              clearErrors()
            }}
            autoComplete="new-password"
          />

          <Button type="submit" busy={pending} className="mt-1 w-full">
            {pending ? 'Updating…' : 'Update password'}
          </Button>
        </form>

        <div className="flex flex-col items-start gap-2.5 border-t border-rule pt-4">
          <p className="text-[13px] text-ink-2">Code not arrived, or already used?</p>
          <Button
            variant="secondary"
            busy={pending}
            disabled={cooldown > 0}
            onClick={() => sendCode(false)}
          >
            {cooldown > 0 ? `Send another in ${cooldown}s` : 'Send another code'}
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
