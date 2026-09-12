/** A stand-in for screens that have not been built yet. Used inside the shell
 *  for the seven unbuilt sections, and outside it for an unknown URL -- which
 *  is why it can supply its own page frame when asked. */
export default function Placeholder({ title, standalone = false }) {
  const body = (
    <section className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="t-title">{title}</h1>
        <p className="text-sm text-ink-2">This screen has not been built yet.</p>
      </header>

      {/* Two rows of a table that does not exist yet. Same 44px rhythm the
          real one will use, so the page does not jump when it arrives. */}
      <div className="panel overflow-hidden" aria-hidden="true">
        {Array.from({ length: 5 }, (unused, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-4 border-b border-rule-soft px-4 last:border-b-0"
          >
            <span className="h-2.5 flex-1 rounded bg-sunken" />
            <span className="h-2.5 w-20 rounded bg-sunken" />
            <span className="h-2.5 w-16 rounded bg-sunken" />
          </div>
        ))}
      </div>
    </section>
  )

  if (!standalone) return body

  return <main className="px-5 py-10 lg:px-8">{body}</main>
}
