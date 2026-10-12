import { useMemo, useState } from "react";
import Card from "../../../components/Card/Card";
import { formatDay, formatInr, weekdayName } from "../../../lib/format";
import "./RecentRecords.css";

/*
 * "Recent records" -- one row per day in the range window, newest
 * first, 8 by default with a "view all" toggle. Each day in the window
 * gets a row, gaps included: a day with no entry is a "Not recorded"
 * row (amber stripe), not a ₹0 one.
 *
 * Rows are buttons: tapping a day -- recorded or not -- loads it into
 * the entry form above, which is how a gap gets filled.
 */
function rowTag(status) {
  if (status === "recorded") {
    return { label: "Recorded", tagClass: "recent-records__tag--recorded", dotClass: "recent-records__dot--recorded" };
  }
  if (status === "zero") {
    return { label: "Recorded as ₹0", tagClass: "recent-records__tag--zero", dotClass: "recent-records__dot--zero" };
  }
  return { label: "Not recorded", tagClass: "recent-records__tag--missing", dotClass: "recent-records__dot--missing" };
}

function RecentRecords({ perDay, selectedDate, recorded, missing, onDateChange }) {
  const [showAll, setShowAll] = useState(false);

  const desc = useMemo(() => [...perDay].reverse(), [perDay]);
  const visible = showAll ? desc : desc.slice(0, 8);

  return (
    <Card className="recent-records card--wide">
      <div className="recent-records__header">
        <div className="recent-records__header-left">
          <h2 className="recent-records__title">Recent records</h2>
          <span className="recent-records__summary">
            {recorded} recorded · {missing} missing
          </span>
        </div>
        <button
          type="button"
          className="recent-records__toggle"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Show recent 8" : "View all records"}
        </button>
      </div>

      <div className="recent-records__table" role="table" aria-label="Recent daily records, newest first">
        <div className="recent-records__head" role="row">
          <span className="recent-records__col-date">Date</span>
          <span className="recent-records__col-split" data-col-split>UPI</span>
          <span className="recent-records__col-split" data-col-split>Cash</span>
          <span className="recent-records__col-split" data-col-split>Card</span>
          <span className="recent-records__col-total">Total</span>
        </div>

        {visible.map((d, i) => {
          const tag = rowTag(d.status);
          const selected = d.date === selectedDate;
          const missingDay = d.status === "missing";
          const zeroDay = d.status === "zero";

          const aria = `${tag.label}: ${
            missingDay ? "" : `${formatInr(d.total)} collected on `
          }${formatDay(d.date)}. Open in the entry form`;

          return (
            <button
              type="button"
              role="row"
              key={d.date}
              className={
                "recent-records__row recent-records__row--" +
                  d.status +
                (selected ? " recent-records__row--selected" : "")
              }
              style={{ animationDelay: `${Math.min(i * 24, 260)}ms` }}
              aria-label={aria}
              onClick={() => onDateChange(d.date)}
            >
              <span className="recent-records__date-cell">
                <span
                  className={
                    "recent-records__date" +
                    (missingDay ? " recent-records__date--missing" : "")
                  }
                >
                  {formatDay(d.date)} · {weekdayName(d.date)}
                </span>
                <span className={`recent-records__tag ${tag.tagClass}`}>
                  <span className={`recent-records__dot ${tag.dotClass}`} aria-hidden="true" />
                  {tag.label}
                </span>
              </span>

              <span
                data-col-split
                className={
                  "recent-records__split" +
                  (missingDay
                    ? " recent-records__split--missing"
                    : zeroDay
                      ? " recent-records__split--zero"
                      : "")
                }
              >
                {missingDay ? "—" : formatInr(d.upi)}
              </span>
              <span
                data-col-split
                className={
                  "recent-records__split" +
                  (missingDay
                    ? " recent-records__split--missing"
                    : zeroDay
                      ? " recent-records__split--zero"
                      : "")
                }
              >
                {missingDay ? "—" : formatInr(d.cash)}
              </span>
              <span
                data-col-split
                className={
                  "recent-records__split" +
                  (missingDay
                    ? " recent-records__split--missing"
                    : zeroDay
                      ? " recent-records__split--zero"
                      : "")
                }
              >
                {missingDay ? "—" : formatInr(d.cards)}
              </span>
              <span
                className={
                  "recent-records__total" +
                  (missingDay
                    ? " recent-records__total--missing"
                    : zeroDay
                      ? " recent-records__total--zero"
                      : "")
                }
              >
                {missingDay ? "—" : formatInr(d.total)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="recent-records__footnote">
        Tap any day to load it into the entry form above. A day with no row is{" "}
        <strong>Not recorded</strong> — a gap in the record, not a ₹0
        collection.
      </p>
    </Card>
  );
}

export default RecentRecords;
