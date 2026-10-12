import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatCompact, formatInr } from "../../../lib/format";
import "./MethodsDonut.css";

/*
 * "Collection methods" -- the donut of the range split into UPI / cash /
 * card. Pure presentation over the derived window's method split.
 * The split covers days that have a row; a deliberate-₹0 day adds
 * nothing, and missing days are excluded entirely (the note says so).
 */
const CIRC = 2 * Math.PI * 38;

const DEFS = [
  { label: "UPI", color: "#14150F" },
  { label: "Cash", color: "#6E7566" },
  { label: "Card", color: "#C9CABF" },
];

function MethodsDonut({ byMethod, recordedCount, rangeLabel }) {
  const sum = byMethod.sum;

  // Each method's arc: a stroke-dash segment of the circle, stacked in
  // order from 12 o'clock (the svg is rotated -90deg). An arc starts
  // where the fractions before it end.
  const fracs = DEFS.map(
    (def) => (sum ? byMethod[def.label.toLowerCase()] / sum : 0)
  );

  const arcs = fracs.map((frac, i) => {
    const start = fracs.slice(0, i).reduce((a, b) => a + b, 0);
    const len = frac * CIRC;
    return {
      color: DEFS[i].color,
      dash: `${len.toFixed(2)} ${(CIRC - len).toFixed(2)}`,
      offset: (-start * CIRC).toFixed(2),
    };
  });

  const alt = sum
    ? `Donut chart of collection methods: UPI ${formatInr(byMethod.upi)}, cash ${formatInr(byMethod.cash)}, card ${formatInr(byMethod.cards)}.`
    : "No recorded collections in this range yet.";

  return (
    <Card className="methods">
      <div className="methods__header">
        <h2 className="methods__title">Collection methods</h2>
        <span className="methods__range">{rangeLabel}</span>
      </div>

      <div className="methods__donut">
        <svg viewBox="0 0 100 100" role="img" aria-label={alt} className="methods__svg">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F1EA" strokeWidth="14" />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={arc.color}
              strokeWidth="14"
              strokeDasharray={arc.dash}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="methods__center">
          <span className="methods__total">
            {sum ? (
              <CountUp value={sum} duration={700} format={formatCompact} />
            ) : (
              "—"
            )}
          </span>
          <span className="methods__center-label">Collected</span>
        </div>
      </div>

      <div className="methods__legend">
        {DEFS.map((def) => {
          const value = byMethod[def.label.toLowerCase()];
          return (
            <div className="methods__row" key={def.label}>
              <span className="methods__swatch" style={{ background: def.color }} aria-hidden="true" />
              <span className="methods__label">{def.label}</span>
              <span className="methods__amount">{formatInr(value)}</span>
              <span className="methods__pct">
                {sum ? `${Math.round((value / sum) * 100)}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="methods__note">
        {sum
          ? `Split across the ${recordedCount} recorded ${recordedCount === 1 ? "day" : "days"} in this range. Missing days are excluded, not counted as ₹0.`
          : "No recorded collections in this range yet."}
      </p>
    </Card>
  );
}

export default MethodsDonut;
