import { motion, useReducedMotion } from 'motion/react'

/** The frame every signed-out screen sits in.
 *
 *  The bento treatment goes beside the form, never on it. A sign-in form is
 *  read straight down and should stay a plain column; the tiles carry the look
 *  without getting in the way of the one thing there is to do here. They are
 *  hidden below `lg`, where the form is the whole screen anyway. */

function SideTile({ label, value, children, className = '' }) {
  return (
    <div className={`tile ${className}`}>
      <span className="t-label">{label}</span>
      <span className="t-amount">{value}</span>
      {children}
    </div>
  )
}

/* Seven days of collection. Heights are the shape of a real week, not noise:
   quiet Monday, a Saturday peak, today still in progress. */
const WEEK = [38, 54, 41, 72, 58, 86, 64]

export default function AuthLayout({ step, title, lede, children, footer }) {
  const still = useReducedMotion()

  // The one orchestrated moment on a signed-out screen: the card settles in.
  // Under reduced motion the transform drops away and opacity carries it.
  const settle = {
    initial: { opacity: 0, y: still ? 0 : 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, ease: [0.2, 0, 0, 1] },
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl items-center gap-4 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-5 lg:px-6">
      <motion.div {...settle} className="panel mx-auto w-full max-w-md p-7 sm:p-8">
        <header className="mb-6 flex flex-col gap-1.5">
          {step && <p className="t-label">{step}</p>}
          <h1 className="t-hero text-balance">{title}</h1>
          {lede && <p className="text-sm text-ink-2">{lede}</p>}
        </header>

        {children}

        {footer && <div className="mt-7 border-t border-rule pt-5 text-[13px] text-ink-2">{footer}</div>}
      </motion.div>

      {/* Decoration, and the only place on a signed-out screen where figures
          appear. They are examples, and say so. */}
      <motion.aside
        {...settle}
        transition={{ ...settle.transition, delay: still ? 0 : 0.08 }}
        className="hidden flex-col gap-4 lg:flex"
        aria-label="What LedgerFlow keeps"
      >
        <SideTile label="Collected this week" value="₹4,82,650">
          <div className="mt-1 flex h-14 items-end gap-1.5" aria-hidden="true">
            {WEEK.map((h, i) => (
              <span
                key={h}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-t-[3px] ${i === WEEK.length - 1 ? 'bg-brand' : 'bg-rule'}`}
              />
            ))}
          </div>
          <span className="text-[12.5px] text-ink-2">UPI, cash and cards, day by day</span>
        </SideTile>

        <div className="grid grid-cols-2 gap-4">
          <SideTile label="Dealers" value="14">
            <span className="text-[12.5px] text-ink-2">One running balance each</span>
          </SideTile>
          <SideTile label="Bills" value="47">
            <span className="text-[12.5px] text-ink-2">This month, ₹6,12,480</span>
          </SideTile>
        </div>

        <p className="px-1 text-[11.5px] text-ink-3">Sample figures, not a real business.</p>
      </motion.aside>
    </main>
  )
}
