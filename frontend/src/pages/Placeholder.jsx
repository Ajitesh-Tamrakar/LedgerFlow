/** A stand-in for screens that have not been built yet. Used inside the shell
 *  for the seven unbuilt sections, and outside it for an unknown URL. */
export default function Placeholder({ title }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <p className="page__lede">This screen has not been built yet.</p>
    </section>
  )
}
