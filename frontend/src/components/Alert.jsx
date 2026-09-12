/** The three things a form says back to you.
 *
 *  `tone` is not decoration. It picks which of the semantic colours applies,
 *  and every tone still carries its own words, so the message survives being
 *  read in greyscale or by someone who cannot separate red from green. */

const TONES = {
  error: 'border-clay/45 bg-clay-soft text-clay',
  good: 'border-brand/40 bg-brand-soft text-brand',
  quiet: 'border-rule bg-surface text-ink-2',
}

const ROLES = { error: 'alert', good: 'status', quiet: 'status' }

export default function Alert({ tone = 'error', children }) {
  return (
    <div
      role={ROLES[tone]}
      className={`rounded-inner border px-4 py-3 text-[13.5px] leading-relaxed [&_p+p]:mt-1.5 [&_a]:font-semibold [&_a]:underline ${TONES[tone]}`}
    >
      {children}
    </div>
  )
}
