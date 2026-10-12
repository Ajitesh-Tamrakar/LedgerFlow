import { useEffect, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatDay, formatInr, weekdayName } from "../../../lib/format";
import "./SelectedDay.css";

/*
 * "Selected day" -- the right-hand card with the day's saved figures.
 * Pure presentation over the by-date row; the note carries the design's
 * three readings (saved / deliberate ₹0 / gap).
 */
const LINES = [
  { key: "upi", label: "UPI" },
  { key: "cash", label: "Cash" },
  { key: "cards", label: "Card" },
];

function SelectedDay({ date, entry }) {
  const stored = !!entry;
  const zeroDay = stored && Number(entry.total) === 0;
  const total = stored ? Number(entry.total) : 0;

  // The design re-pops the total when the day's figures change.
  const [pop, setPop] = useState("a");
  const lastTotal = useRef(total);

  useEffect(() => {
    if (lastTotal.current !== total) {
      lastTotal.current = total;
      setPop((current) => (current === "a" ? "b" : "a"));
    }
  }, [total]);

  const note = stored
    ? zeroDay
      ? "Saved as a deliberate ₹0 collection for this day."
      : "These are the saved figures. Edit them above to correct the day."
    : "No collection record exists for this day yet — a gap, not ₹0.";

  return (
    <Card className="selected-day">
      <div className="selected-day__header">
        <h2 className="selected-day__title">Selected day</h2>
        <span className="selected-day__label">
          {formatDay(date)} · {weekdayName(date)}
        </span>
      </div>

      <div className="selected-day__lines">
        {LINES.map(({ key, label }) => (
          <div className="selected-day__line" key={key}>
            <span className="selected-day__line-label">{label}</span>
            <span
              className={
                "selected-day__line-value" +
                (stored ? "" : " selected-day__line-value--none")
              }
            >
              {stored ? formatInr(entry[key]) : "—"}
            </span>
          </div>
        ))}
      </div>

      <div
        className={
          "selected-day__total" + (stored ? "" : " selected-day__total--none")
        }
      >
        <span className="selected-day__total-label">Total</span>
        <span
          className={`selected-day__total-value selected-day__total-value--${pop}`}
        >
          {stored ? (
            <CountUp value={total} duration={420} format={formatInr} />
          ) : (
            "Not recorded"
          )}
        </span>
      </div>

      <p className="selected-day__note">{note}</p>
    </Card>
  );
}

export default SelectedDay;
