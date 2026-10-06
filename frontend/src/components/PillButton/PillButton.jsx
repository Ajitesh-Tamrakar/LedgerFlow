import "./PillButton.css";

function PillButton({ children, type = "button", variant = "default", onClick }) {
  return (
    <button
      type={type}
      className={`pill-button pill-button--${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default PillButton;