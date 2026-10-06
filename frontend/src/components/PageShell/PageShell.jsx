import "./PageShell.css";

function PageShell({ children, gap = 14 }) {
  return (
    <div className="page-shell">
      <div
        className="page-shell__container"
        style={{ gap: `${gap}px` }}
      >
        {children}
      </div>
    </div>
  );
}

export default PageShell;
