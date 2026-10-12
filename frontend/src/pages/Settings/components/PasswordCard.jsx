import "./PasswordCard.css";

/*
 * The password card (dark). Two modes, exactly the design's:
 *   "password" -- current + new + confirm, straight to the API
 *   "code"     -- a 6-digit code from the email; new/confirm stay
 *                 locked (dimmed + disabled) until the code verifies
 * Presentational -- the page owns every value, error, timer and handler.
 * The shake lives on the field span only (the design's placement), so the
 * labels' entrance animation is never clobbered.
 */
function PasswordCard({
  email,
  mode,
  current,
  curError,
  curShake,
  onCurrentChange,
  next,
  nextInputRef,
  onNewChange,
  confirm,
  onConfirmChange,
  confError,
  confShake,
  reveal,
  onToggleReveal,
  locked,
  strengthScore,
  strengthLabel,
  strengthBad,
  submitCta,
  submitDisabled,
  saving,
  done,
  onDoneDismiss,
  onForgot,
  onSubmitForm,
  // code mode
  otp,
  onOtpChange,
  otpInputRef,
  otpVerified,
  otpSending,
  otpVerifying,
  otpError,
  otpShake,
  onVerify,
  onResend,
  cooldown,
  onCancelCodeMode,
}) {
  const codeMode = mode === "code";
  const inputType = reveal ? "text" : "password";
  const mismatch = confirm.length > 0 && confirm !== next;
  const confBad = !!confError || mismatch;

  const otpBusy = otpSending || otpVerifying;
  const otpMsg = otpError
    ? otpError
    : otpSending
      ? `Sending a code to ${email}…`
      : otpVerifying
        ? "Checking your code…"
        : otpVerified
          ? "Verified — you can set a new password now."
          : `We sent a 6-digit code to ${email}.`;

  const otpMsgTone = otpError
    ? "is-error"
    : otpVerified
      ? "is-verified"
      : "";

  const verifyDisabled = otpBusy || otp.length !== 6;

  /* The design's A/B parity trick: the counter's parity picks the
     keyframe name, so a repeat shake replays without a remount (which
     would drop the input's focus). */
  const shakeClass = (n) =>
    n ? (n % 2 ? "settings-shake-b" : "settings-shake-a") : "";

  return (
    <section
      id="password"
      className="settings-card settings-card--password"
      aria-labelledby="settings-pw-title"
    >
      <div className="settings-pw__head">
        <h2 id="settings-pw-title" className="settings-card__title">
          Password
        </h2>
        {!codeMode && (
          <button
            type="button"
            className="settings-pw__forgot"
            onClick={onForgot}
          >
            Forgot your current password?
          </button>
        )}
      </div>

      <form className="settings-pw__form" onSubmit={onSubmitForm} noValidate>
        <div className="settings-pw__grid">
          {/* Current password -- password mode only */}
          {!codeMode && (
            <label className="settings-pw__col">
              <span className="settings-pw__label">Current password</span>
              <span
                className={`settings-pw__field ${
                  curError ? "is-invalid" : ""
                } ${shakeClass(curShake)}`}
              >
                <input
                  className="settings-pw__input"
                  type={inputType}
                  value={current}
                  onChange={onCurrentChange}
                  disabled={saving}
                  autoComplete="current-password"
                  aria-invalid={curError || undefined}
                  aria-describedby="settings-pw-cur-msg"
                  placeholder="Your current password"
                />
              </span>
              <span
                id="settings-pw-cur-msg"
                className={`settings-pw__msg ${curError ? "is-error" : ""}`}
                aria-live="polite"
              >
                {curError || "Just to be sure it's you."}
              </span>
            </label>
          )}

          {/* Code from the email -- code mode only. Dims once verified,
              so the eye lands on the now-unlocked password fields. */}
          {codeMode && (
            <label className="settings-pw__col settings-pw__col--otp">
              <span
                className={
                  otpVerified
                    ? "settings-pw__dim settings-pw__dim--otp"
                    : ""
                }
              >
                <span className="settings-pw__label">
                  Code from your email
                </span>
                <span
                  className={`settings-otp__field ${
                    otpError
                      ? "is-invalid"
                      : otpVerified
                        ? "is-verified"
                        : ""
                  } ${shakeClass(otpShake)}`}
                >
                  <input
                    className="settings-otp__input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={onOtpChange}
                    ref={otpInputRef}
                    disabled={otpVerified || otpBusy}
                    aria-invalid={otpError || undefined}
                    aria-describedby="settings-otp-msg"
                    placeholder="6-digit code"
                  />
                  {otpVerified && (
                    <span className="settings-otp__tick" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </span>
                <span
                  id="settings-otp-msg"
                  className={`settings-pw__msg ${otpMsgTone}`}
                  aria-live="polite"
                >
                  {otpMsg}
                </span>
                {!otpVerified && (
                  <div className="settings-otp__actions">
                    <button
                      type="button"
                      className={`settings-otp__verify ${
                        verifyDisabled ? "is-disabled" : ""
                      } ${otpVerifying ? "is-busy" : ""}`}
                      disabled={verifyDisabled}
                      onClick={onVerify}
                    >
                      {otpVerifying ? "Verifying…" : "Verify code"}
                    </button>
                    <button
                      type="button"
                      className={`settings-otp__resend ${
                        cooldown > 0 || otpBusy ? "is-disabled" : ""
                      }`}
                      disabled={otpBusy || cooldown > 0}
                      onClick={onResend}
                    >
                      {cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : otpSending
                          ? "Sending…"
                          : "Send a new code"}
                    </button>
                  </div>
                )}
              </span>
            </label>
          )}

          {/* New password -- waits for verification in code mode */}
          <label className="settings-pw__col settings-pw__col--new">
            <span className={locked ? "settings-pw__dim" : ""}>
              <span className="settings-pw__label">New password</span>
              <span
                className={`settings-pw__field ${
                  strengthBad && !locked ? "is-invalid" : ""
                }`}
              >
                <input
                  className="settings-pw__input"
                  type={inputType}
                  value={next}
                  onChange={onNewChange}
                  ref={nextInputRef}
                  disabled={locked || saving}
                  autoComplete="new-password"
                  aria-describedby="settings-pw-rule"
                  placeholder="At least 8 characters"
                />
              </span>
              <span className="settings-pw__meter" aria-hidden="true">
                <span
                  className={`settings-pw__meter-fill score-${strengthScore} ${
                    strengthBad ? "is-bad" : ""
                  }`}
                  style={{ width: `${(strengthScore / 4) * 100}%` }}
                />
              </span>
              <span
                id="settings-pw-rule"
                className={`settings-pw__msg ${
                  strengthBad && !locked ? "is-error" : ""
                }`}
                aria-live="polite"
              >
                {locked
                  ? "Available once your code is verified."
                  : strengthLabel}
              </span>
            </span>
          </label>

          {/* Confirm -- waits for verification in code mode */}
          <label className="settings-pw__col settings-pw__col--confirm">
            <span className={locked ? "settings-pw__dim" : ""}>
              <span className="settings-pw__label">
                Confirm new password
              </span>
              <span
                className={`settings-pw__field ${
                  confBad ? "is-invalid" : ""
                } ${shakeClass(confShake)}`}
              >
                <input
                  className="settings-pw__input"
                  type={inputType}
                  value={confirm}
                  onChange={onConfirmChange}
                  disabled={locked || saving}
                  autoComplete="new-password"
                  aria-invalid={confBad || undefined}
                  aria-describedby="settings-pw-conf-msg"
                  placeholder="Type it once more"
                />
              </span>
              <span
                id="settings-pw-conf-msg"
                className={`settings-pw__msg ${confBad ? "is-error" : ""}`}
                aria-live="polite"
              >
                {confError ||
                  (mismatch
                    ? "These two don't match yet."
                    : "Type the new password again to be safe.")}
              </span>
            </span>
          </label>
        </div>

        <div className="settings-pw__actions">
          <button
            type="submit"
            className={`settings-pw__submit ${
              submitDisabled ? "is-disabled" : ""
            } ${saving ? "is-saving" : ""}`}
            disabled={submitDisabled}
          >
            {submitCta}
          </button>
          <button
            type="button"
            className="settings-pw__reveal"
            aria-pressed={reveal || undefined}
            onClick={onToggleReveal}
          >
            {reveal ? "Hide passwords" : "Show passwords"}
          </button>
          {codeMode && (
            <button
              type="button"
              className="settings-pw__back"
              onClick={onCancelCodeMode}
            >
              Use my current password instead
            </button>
          )}
        </div>

        {done && (
          <div className="settings-pw__done" role="status">
            <span className="settings-pw__done-dot" aria-hidden="true" />
            <span className="settings-pw__done-text">
              Done — your password is updated.
            </span>
            <button
              type="button"
              className="settings-pw__done-close"
              onClick={onDoneDismiss}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

export default PasswordCard;
