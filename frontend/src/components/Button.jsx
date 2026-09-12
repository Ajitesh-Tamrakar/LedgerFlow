/** The one button in the app.
 *
 *  Primary is ink, never the brand green -- that is the decision that keeps
 *  green free to mean "settled" wherever money is on screen. `busy` is kept
 *  separate from `disabled` so a pending submit still reads as the same
 *  button rather than a greyed-out one that looks broken. */

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  quiet: 'btn-quiet',
}

export default function Button({
  variant = 'primary',
  busy = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      className={`btn ${VARIANTS[variant]} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && (
        <span
          className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
