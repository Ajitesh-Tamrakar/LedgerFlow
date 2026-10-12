import Card from "../../../components/Card/Card";
import "./DealerBreakdown.css";

/*
 * "Where it went this month" -- the wide card under the headline. The
 * per-dealer split comes from the purchases endpoint (biggest first);
 * the bars scale off the biggest bar. Clicking a row narrows the list
 * to that dealer for the month.
 *
 * Pure presentation: the page hands it finished rows.
 */
function DealerBreakdown({ rows, onPick }) {
  return (
    <Card className="dealer-breakdown card--wide card--full">
      <div className="dealer-breakdown__header">
        <h2 className="dealer-breakdown__title">Where it went this month</h2>
        <span className="dealer-breakdown__hint">
          By dealer · own endpoint, never summed from the list
        </span>
      </div>

      {rows.length > 0 && (
        <div className="dealer-breakdown__rows">
          {rows.map((row, index) => (
            <button
              key={row.id}
              type="button"
              className="dealer-breakdown__row"
              aria-label={row.aria}
              onClick={() => onPick(row.id)}
            >
              <span className="dealer-breakdown__line">
                <span className="dealer-breakdown__name">{row.name}</span>
                <span className="dealer-breakdown__figures">
                  <span className="dealer-breakdown__share">
                    {row.share}%
                  </span>
                  <span className="dealer-breakdown__amount">
                    {row.amountText}
                  </span>
                </span>
              </span>

              <span
                className="dealer-breakdown__track"
                aria-hidden="true"
              >
                <span
                  className={
                    "dealer-breakdown__fill" +
                    (index === 0
                      ? " dealer-breakdown__fill--lead"
                      : index === 1
                        ? " dealer-breakdown__fill--second"
                        : " dealer-breakdown__fill--rest")
                  }
                  style={{ width: `${row.width}%` }}
                />
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="dealer-breakdown__note">
        Per-dealer purchasing lives here rather than on the dashboard — the
        design doc puts this breakdown on Bills by name.
      </p>
    </Card>
  );
}

export default DealerBreakdown;
