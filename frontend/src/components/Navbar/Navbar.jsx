import "./Navbar.css";
import { Link, useLocation } from "react-router-dom";
import LedgerFlowLogo from "../../assets/LedgerFlowLogo.png";
const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Cashbook", path: "/cashbook" },
  { label: "Dealers", path: "/dealers" },
  { label: "Bills", path: "/bills" },
  { label: "Payments", path: "/payments" },
  { label: "Settings", path: "/settings" },
];

function Navbar({ userInitials = "RS" }) {
  const location = useLocation()
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
        <button
          type="button"
          className="navbar__avatar"
          aria-label={`Account — signed in as ${userInitials}`}
        >
          {userInitials}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
