import { useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../../components/Card/Card";
import { formatInr } from "../../../lib/format";
import "./OutstandingPerDealer.css";

/*
 * "Outstanding per dealer" -- the wide white card.
 *
 * One list from the summary's `outstanding.dealers`, biggest balance
 * first (the API sorts it). The credits toggle is a *view* filter, so
 * it is card-local state: it re-filters the same data, it never
 * fetches anything.
 */
function OutstandingPerDealer({ dealers }) {
  const [showCredits, setShowCredits] = useState(true);

  const visible = showCredits
    ? dealers
    : dealers.filter((d) => Number(d.balance) > 0);

  // Bar widths are relative to the biggest *visible* balance.
  const maxAbs =
    visible.reduce((max, d) => Math.max(max, Math.abs(Number(d.balance))), 0) ||
    1;

  return (
    <Card className="outstanding-per-dealer card--wide">
      <div className="outstanding-per-dealer__header">
        <h2 className="outstanding-per-dealer__title">Outstanding per dealer</h2>
        <div className="outstanding-per-dealer__actions">
          <button
            type="button"
            className="outstanding-per-dealer__credit-toggle"
            aria-pressed={showCredits}
            onClick={() => setShowCredits((value) => !value)}
          >
            {showCredits ? "Showing credits" : "Credits hidden"}
          </button>
          <Link className="outstanding-per-dealer__all" to="/dealers">
            All dealers
          </Link>
        </div>
      </div>

      <div className="outstanding-per-dealer__list">
        {visible.map((d, i) => {
          const balance = Number(d.balance);
          const inCredit = balance < 0;

          return (
            <div className="outstanding-per-dealer__row" key={d.id}>
              <span className="outstanding-per-dealer__rank">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="outstanding-per-dealer__who">
                <div className="outstanding-per-dealer__name">{d.name}</div>
                <div className="outstanding-per-dealer__gstin">
                  {d.gstin || "—"}
                </div>
              </div>
              <div className="outstanding-per-dealer__bar" aria-hidden="true">
                <div
                  className={
                    "outstanding-per-dealer__bar-fill" +
                    (inCredit ? " outstanding-per-dealer__bar-fill--credit" : "")
                  }
                  style={{ width: `${Math.round((Math.abs(balance) / maxAbs) * 100)}%` }}
                />
              </div>
              <div className="outstanding-per-dealer__amount-wrap">
                <div
                  className={
                    "outstanding-per-dealer__amount" +
                    (inCredit ? " outstanding-per-dealer__amount--credit" : "")
                  }
                >
                  {formatInr(balance)}
                </div>
                <div className="outstanding-per-dealer__tag">
                  {inCredit ? "in credit" : "outstanding"}
                </div>
              </div>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="outstanding-per-dealer__empty">
            {showCredits
              ? "No dealer balances yet. Add a dealer with an opening balance, or record a bill."
              : "Every dealer is in credit right now — nothing is outstanding. Turn credits back on to see them."}
          </div>
        )}
      </div>
    </Card>
  );
}

export default OutstandingPerDealer;
