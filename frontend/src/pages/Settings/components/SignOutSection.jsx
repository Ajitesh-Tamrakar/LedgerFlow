import "./SignOutSection.css";

/*
 * The sign-out strip (grey). The busy state lives in the confirm modal,
 * so the button itself always reads "Sign out".
 * Presentational -- the page owns the modal and the logout call.
 */
function SignOutSection({ onAsk }) {
  return (
    <section
      id="signout"
      className="settings-signout"
      aria-labelledby="settings-out-title"
    >
      <h2 id="settings-out-title" className="settings-card__title">
        Sign out
      </h2>
      <button type="button" className="settings-signout__button" onClick={onAsk}>
        Sign out
      </button>
    </section>
  );
}

export default SignOutSection;
