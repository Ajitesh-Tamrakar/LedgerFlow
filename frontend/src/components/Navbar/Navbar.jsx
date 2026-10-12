import { useEffect, useState } from "react";
import "./Navbar.css";
import { Link, useLocation } from "react-router-dom";
import LedgerFlowLogo from "../../assets/LedgerFlowLogo.png";
import { getBusiness } from "../../api/business";
import { initials } from "../../lib/format";

const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Cashbook", path: "/cashbook" },
  { label: "Dealers", path: "/dealers" },
  { label: "Bills", path: "/bills" },
  { label: "Payments", path: "/payments" },
  { label: "Settings", path: "/settings" },
];

/*
 * The account circle is real: its letters come from the business name,
 * and clicking it opens /settings.
 *
 * Pages that already hold the name pass it as `businessName` (the
 * settings page does, so a rename shows up without a refetch); every
 * other page gets it from the one small GET on mount.
 */
function Navbar({ businessName }) {
  const location = useLocation();
  const [fetchedName, setFetchedName] = useState("");

  useEffect(() => {
    if (businessName) {
      return; // the page is the source; no fetch needed
    }

    let active = true;

    getBusiness()
      .then((row) => {
        if (active) {
          setFetchedName(row.name || "");
        }
      })
      .catch(() => {
        // Signed out or a hiccup: the circle just reads "—".
      });

    return () => {
      active = false;
    };
  }, [businessName]);

  const name = businessName || fetchedName;
  const letters = initials(name);

  return (
    <nav className="navbar" aria-label="Sections">
      <div className="navbar__brand">
        <img src={LedgerFlowLogo} alt="LedgerFlow" />
      </div>

      <div className="navbar__links">
        {navItems.map((item) => {
          const active = item.path === location.pathname;

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`navbar__link ${active ? "navbar__link--active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="navbar__account">
        {name && <span className="navbar__name">{name}</span>}
        <Link
          to="/settings"
          className="navbar__avatar"
          aria-label={`Settings — ${name || "your business"}`}
        >
          {letters}
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;
