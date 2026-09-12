import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

/** Stands in for the dashboard, which cannot be built until /api/dashboard/
 *  exists.
 *
 *  The tiles below are skeletons on purpose. Filling them with plausible
 *  figures would look better in a screenshot and lie to the person reading it,
 *  and this is a ledger. A shape-matched placeholder says "a number is coming
 *  here" without inventing one. */

function SkeletonTile({ className = '', lines = 1 }) {
  return (
    <div className={`tile ${className}`} aria-hidden="true">
      <span className="h-2.5 w-24 rounded bg-sunken" />
      <span className="h-8 w-40 max-w-full rounded-md bg-sunken" />
      {Array.from({ length: lines }, (unused, i) => (
        <span key={i} className="h-2.5 w-full rounded bg-sunken" />
      ))}
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="t-title">Good to see you</h1>
        <p className="text-sm text-ink-2">
          Signed in to {user.business?.name ?? 'your business'}.
        </p>
      </header>

      {/* The shape the dashboard will take: twelve columns, unequal tiles,
          16px gaps. Worth standing up now so the layout is settled before
          there is data to pour into it. */}
      <div className="grid grid-cols-12 gap-4" role="presentation">
        <SkeletonTile className="col-span-12 md:col-span-6" lines={2} />
        <SkeletonTile className="col-span-6 md:col-span-3" />
        <SkeletonTile className="col-span-6 md:col-span-3" />
        <SkeletonTile className="col-span-12 md:col-span-7" lines={3} />
        <SkeletonTile className="col-span-12 md:col-span-5" lines={3} />
      </div>

      <div className="panel p-5">
        <h2 className="mb-2 text-sm font-semibold">Why this is empty</h2>
        <p className="text-[13.5px] text-ink-2">
          The dashboard needs four figures that no endpoint returns yet: the week and
          month totals, the dealers carrying the largest balances, and the day&rsquo;s
          collection. Until then,{' '}
          <Link to="/cashbook" className="font-semibold text-brand">
            the cashbook
          </Link>{' '}
          is where the day starts.
        </p>
      </div>
    </section>
  )
}
