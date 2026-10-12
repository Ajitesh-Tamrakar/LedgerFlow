import { useEffect, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr } from "../../../lib/format";
import "./QuickStatus.css";

/*
 * "Quick status" -- the lavender card. Pure presentation over the
 * derived window: days recorded, days missing, range total.
 * `invalid` is the custom-range error state (from after to): the numbers
 * read "—" instead of a misleading "every day recorded" zero.
 */
function QuickStatus({ recorded, missing, total, label, invalid = false }) {
  // The design re-pops the three figures whenever any of them changes.
  const [pop, setPop] = useState("a");
  const last = useRef(`${recorded}:${missing}:${total}`);

  useEffect(() => {
    const key = `${recorded}:${missing}:${total}`;
    if (last.current !== key) {
      last.current = key;
      setPop((current) => (current === "a" ? "b" : "a"));
    }
  }, [recorded, missing, total]);

  const popClass = ` quick-status__figure--${pop}`;

  return (
    <Card className="quick-status">
      <h2 className="quick-status__title">Quick status</h2>

      <div className="quick-status__stats">
        <div className="quick-status__stat">
          <span className={`quick-status__figure${popClass}`}>
            {invalid ? "—" : <CountUp value={recorded} duration={500} />}
          </span>
          <span className="quick-status__stat-label">recorded</span>
        </div>
        <div className="quick-status__stat quick-status__stat--missing">
          <span className={`quick-status__figure${popClass}`}>
            {invalid ? "—" : <CountUp value={missing} duration={500} />}
          </span>
          <span className="quick-status__stat-label">missing</span>
        </div>
      </div>

      <div className="quick-status__break" aria-hidden="true" />

      <div className="quick-status__total">
        <span className={`quick-status__figure quick-status__figure--total${popClass}`}>
          {invalid ? "—" : <CountUp value={total} duration={700} format={formatInr} />}
        </span>
        <div className="quick-status__total-label">
          {invalid ? "Pick a valid range" : label}
        </div>
      </div>

      <p className="quick-status__note">
        {invalid
          ? "Set a From date before the To date to see this range."
          : missing === 0
            ? "Every day in this range has a record."
            : `${missing} ${missing === 1 ? "day has" : "days have"} no record yet — pick one below to fill it in.`}
      </p>
    </Card>
  );
}

export default QuickStatus;
