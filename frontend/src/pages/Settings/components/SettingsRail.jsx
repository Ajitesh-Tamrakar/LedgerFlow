import "./SettingsRail.css";

const SECTIONS = [
  { label: "Business name", href: "#business" },
  { label: "Password", href: "#password" },
  { label: "Sign out", href: "#signout" },
];

/*
 * The left rail: who the signed-in person is (avatar initials, business
 * name, email, member-since line) plus the in-page section jumps.
 * Presentational -- the page fetches the account data. `nameTick` is the
 * save counter: when it flips, the name replays its pop (the design's
 * A/B animation parity trick).
 */
function SettingsRail({ initials, name, email, since, nameTick }) {
  return (
    <aside className="settings-rail">
      <div className="settings-rail__card">
        <span className="settings-rail__avatar" aria-hidden="true">
          {initials}
        </span>
        <div className="settings-rail__meta">
          <span
            className={`settings-rail__name ${
              nameTick % 2 ? "settings-pop-b" : "settings-pop-a"
            }`}
          >
            {name}
          </span>
          <span className="settings-rail__email">{email}</span>
          {since ? (
            <span className="settings-rail__since">Member since {since}</span>
          ) : null}
        </div>
      </div>

      <nav className="settings-rail__nav" aria-label="Settings sections">
        {SECTIONS.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="settings-rail__link"
          >
            {section.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

export default SettingsRail;
