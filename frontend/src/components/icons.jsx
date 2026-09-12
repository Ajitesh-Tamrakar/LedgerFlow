/** The eight navigation marks, plus two utility glyphs.
 *
 *  Hand-drawn rather than pulled from an icon set: eight icons is not worth a
 *  dependency, and a set would bring its own stroke weight and corner radius
 *  that would then have to be argued with. These share one geometry -- a 20px
 *  box, 1.6 stroke, round joins -- so they sit together without adjustment. */

function Svg({ children, ...rest }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* Four unequal panes: the bento grid the dashboard is actually built from. */
export const IconDashboard = (p) => (
  <Svg {...p}>
    <rect x="2.5" y="2.5" width="7" height="9" rx="1.8" />
    <rect x="12" y="2.5" width="5.5" height="5" rx="1.8" />
    <rect x="12" y="10" width="5.5" height="7.5" rx="1.8" />
    <rect x="2.5" y="14" width="7" height="3.5" rx="1.5" />
  </Svg>
)

/* A note of cash. */
export const IconCashbook = (p) => (
  <Svg {...p}>
    <rect x="2" y="5" width="16" height="10" rx="2" />
    <circle cx="10" cy="10" r="2.3" />
    <path d="M5 10h.01M15 10h.01" />
  </Svg>
)

/* A supplier's shopfront, awning and all. */
export const IconDealers = (p) => (
  <Svg {...p}>
    <path d="M3 8v8.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M2.5 8 4 3.2h12L17.5 8a2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0Z" />
    <path d="M8 17.5v-4.2h4v4.2" />
  </Svg>
)

/* A bill: a sheet with a torn foot. */
export const IconBills = (p) => (
  <Svg {...p}>
    <path d="M4.5 2.5h11v15l-2.2-1.4-2.15 1.4L9 16.1l-2.15 1.4L4.5 16.1Z" />
    <path d="M7.5 6.5h5M7.5 10h5" />
  </Svg>
)

/* Money leaving: an arrow out of the stack. */
export const IconPayments = (p) => (
  <Svg {...p}>
    <rect x="2.5" y="6.5" width="15" height="10" rx="2" />
    <path d="M2.5 10h15" />
    <path d="M10 5.5 10 1.8M10 1.8 8.2 3.6M10 1.8l1.8 1.8" />
  </Svg>
)

/* A list with the first line struck through. */
export const IconTasks = (p) => (
  <Svg {...p}>
    <path d="m2.5 5.6 1.8 1.8L7.5 4" />
    <path d="m2.5 11.6 1.8 1.8 3.2-3.4" />
    <path d="M10.5 6h7M10.5 12h7" />
  </Svg>
)

/* Bars, because every report on the list is a comparison. */
export const IconReports = (p) => (
  <Svg {...p}>
    <path d="M3 17h14" />
    <path d="M5.5 17V9.5M10 17V4M14.5 17v-5.5" />
  </Svg>
)

/* Sliders rather than a gear: settings here are values, not machinery. */
export const IconSettings = (p) => (
  <Svg {...p}>
    <path d="M3 6h10M16 6h1M3 14h1M7 14h10" />
    <circle cx="14.6" cy="6" r="1.9" />
    <circle cx="5.4" cy="14" r="1.9" />
  </Svg>
)

export const IconMore = (p) => (
  <Svg {...p}>
    <circle cx="4.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconSignOut = (p) => (
  <Svg {...p}>
    <path d="M7.5 3.5H4.6a1.6 1.6 0 0 0-1.6 1.6v9.8a1.6 1.6 0 0 0 1.6 1.6h2.9" />
    <path d="M12.5 13.2 15.8 10l-3.3-3.2M15.8 10H7.2" />
  </Svg>
)
