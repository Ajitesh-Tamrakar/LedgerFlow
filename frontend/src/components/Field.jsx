/** A labelled input that wires up its own error and hint text.
 *
 *  The ids matter more than they look: `aria-describedby` is what makes a
 *  screen reader announce the error along with the field instead of leaving it
 *  as orphaned text somewhere on the page. That wiring is unchanged from the
 *  first version of this component; only the presentation moved. */
export default function Field({ name, label, error, hint, className = '', ...input }) {
  const errorId = `${name}-error`
  const hintId = `${name}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-[12.5px] font-semibold">
        {label}
      </label>

      {hint && (
        <p id={hintId} className="text-xs text-ink-2 leading-snug">
          {hint}
        </p>
      )}

      <input
        id={name}
        name={name}
        type="text"
        className={`control ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />

      {error && (
        <p id={errorId} className="text-[12.5px] font-medium text-clay">
          {error}
        </p>
      )}
    </div>
  )
}
