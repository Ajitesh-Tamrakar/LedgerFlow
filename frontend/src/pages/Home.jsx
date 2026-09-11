import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

/** Stands in for the dashboard, which cannot be built until /api/dashboard/
 *  exists. The shell owns the header and sign-out now, so all this has to do
 *  is say where the session stands and point at something useful. */
export default function Home() {
  const { user } = useAuth()

  return (
    <section className="page">
      <h1>Good to see you</h1>
      <p className="page__lede">
        Signed in to {user.business?.name ?? 'your business'}.
      </p>

      <div className="alert alert--quiet">
        <p>
          The dashboard needs four figures that no endpoint returns yet: the week and
          month totals, the dealers carrying the largest balances, and the day&rsquo;s
          collection.
        </p>
        <p>
          Until then, <Link to="/cashbook">the cashbook</Link> is where the day starts.
        </p>
      </div>
    </section>
  )
}
