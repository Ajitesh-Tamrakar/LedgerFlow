/** A labelled input that wires up its own error and hint text.
 *
 *  The ids matter more than they look: `aria-describedby` is what makes a
 *  screen reader announce the error along with the field instead of leaving it
 *  as orphaned text somewhere on the page. */
export default function Field({ name, label, error, hint, ...input }) {
  const errorId = `${name}-error`
  const hintId = `${name}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      <input
        id={name}
        name={name}
        type="text"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}
