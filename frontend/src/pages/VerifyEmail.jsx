import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { resendVerification, verifyEmail } from '../api/auth'
import { readErrors } from '../api/client'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import Button from '../components/Button'
import Field from '../components/Field'

const CODE_LENGTH = 6

// The resend endpoint answers 200 whether or not it actually sent anything,
// and dj-rest-auth's resend view calls EmailAddress.send_confirmation directly,
// which skips allauth's own cooldown. So nothing on the server paces this: the
// only thing standing between an impatient user and a mailbox full of codes is
// the timer below. It is a courtesy, not a control.
const RESEND_COOLDOWN_SECONDS = 60

/** The server distinguishes "you typed it wrong" from "that code is gone".
 *  Only the second one means the button they want is Resend, not Try again. */
function needsFreshCode(message) {
  return /request a new one/i.test(message || '')
}

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()

  // Registration hands the address over in route state. Someone who opens this
  // URL directly, or reloads the page, has no state -- so the field stays
  // editable rather than trapping them on a screen with no way forward.
  const handedOver = location.state?.email ?? ''

  const [email, setEmail] = useState(handedOver)
  const [code, setCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formErrors, setFormErrors] = useState([])
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const codeError = fieldErrors.code
  const stale = needsFreshCode(codeError)

  function updateCode(event) {
    // Strip anything that isn't a digit as it is typed. Pasting a code out of
    // an email often brings whitespace with it.
    setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
    setFieldErrors({})
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending) return

    const errors = {}
    if (!email.trim()) errors.email = 'Enter the email address you registered with.'
    if (code.length !== CODE_LENGTH) errors.code = `Enter all ${CODE_LENGTH} digits.`
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormErrors([])
      return
    }

    setPending(true)
    setFieldErrors({})
    setFormErrors([])
    setNotice('')
    try {
      await verifyEmail({ email, code })
      navigate('/login', {
        replace: true,
        state: { email, notice: 'Email confirmed. Sign in to continue.' },
      })
    } catch (error) {
      const { fields, form } = readErrors(error, ['email', 'code'])
      setFieldErrors(fields)
      setFormErrors(form)
    } finally {
      setPending(false)
    }
  }

  async function handleResend() {
    if (resending || cooldown > 0) return
    if (!email.trim()) {
      setFieldErrors({ email: 'Enter the email address you registered with.' })
      return
    }

    setResending(true)
    setFieldErrors({})
    setFormErrors([])
    try {
      await resendVerification(email)
      // Each send invalidates the one before it, so say so plainly -- otherwise
      // someone reads the older email and gets told their code is wrong.
      setNotice('A new code is on its way. Use the most recent email, older codes stop working.')
      setCode('')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      const { form } = readErrors(error)
      setFormErrors(form)
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      title="Confirm your email"
      lede={
        handedOver
          ? `We sent a ${CODE_LENGTH}-digit code to ${handedOver}. It expires in 15 minutes.`
          : `Enter the ${CODE_LENGTH}-digit code from your confirmation email.`
      }
      footer={
        <>
          Wrong address?{' '}
          <Link to="/register" className="font-semibold text-brand">
            Start over
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formErrors.length > 0 && (
          <Alert>
            {formErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </Alert>
        )}

        {notice && <Alert tone="quiet">{notice}</Alert>}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {!handedOver && (
            <Field
              name="email"
              label="Email address"
              type="email"
              value={email}
              error={fieldErrors.email}
              onChange={(event) => {
                setEmail(event.target.value)
                setFieldErrors({})
              }}
              autoComplete="email"
              autoFocus
            />
          )}

          <Field
            name="code"
            label="Confirmation code"
            className="control-code"
            value={code}
            error={codeError}
            onChange={updateCode}
            inputMode="numeric"
            maxLength={CODE_LENGTH}
            // Lets iOS and Android offer the code straight from the notification.
            autoComplete="one-time-code"
            autoFocus={Boolean(handedOver)}
          />

          <Button type="submit" busy={pending} disabled={stale} className="mt-1 w-full">
            {pending ? 'Checking…' : 'Confirm email'}
          </Button>
        </form>

        <div className="flex flex-col items-start gap-2.5 border-t border-rule pt-4">
          <p className="text-[13px] text-ink-2">
            {stale
              ? 'That code can no longer be used. Send yourself a new one.'
              : 'Nothing in your inbox? Check spam, then try again.'}
          </p>
          <Button
            variant="secondary"
            busy={resending}
            disabled={cooldown > 0}
            onClick={handleResend}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Send a new code'}
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
