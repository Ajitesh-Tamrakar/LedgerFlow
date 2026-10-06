import "./Card.css";

function Card({ children, variant = "default", className = "" }) {
  return (
    <section className={`card card--${variant} ${className}`}>
      {children}
    </section>
  );
}

export default Card;