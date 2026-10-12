import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr } from "../../../lib/format";
import "./TotalOutstanding.css";

/*
 * "Total outstanding" -- the tan card.
 *
 * A balance as of today, so the period toggle never moves it.
 * Pure presentation: the page hands it the summary's `outstanding`
 * slice and it draws. No state, no API calls.
 */
function TotalOutstanding({ outstanding }) {
  return (
    <Card className="total-outstanding">
      <h2 className="total-outstanding__title">Total outstanding</h2>

      <div className="total-outstanding__figure">
        <div className="total-outstanding__amount">
          <CountUp
            value={Number(outstanding.total)}
            duration={900}
            format={formatInr}
          />
        </div>
        <div className="total-outstanding__scope">
          across {outstanding.dealer_count}{" "}
          {outstanding.dealer_count === 1 ? "dealer" : "dealers"}
        </div>
      </div>

      <div className="total-outstanding__breakdown">
        <div className="total-outstanding__row">
          <span>Owed</span>
          <span className="total-outstanding__value">
            {formatInr(outstanding.owed)}
          </span>
        </div>
        <div className="total-outstanding__row">
          <span>In credit</span>
          <span className="total-outstanding__value total-outstanding__value--credit">
            {formatInr(outstanding.credit)}
          </span>
        </div>
        <p className="total-outstanding__note">
          A balance as of today, so the period toggle does not change it.
          Includes opening balances; overpaid dealers net off as credit
          rather than dropping out.
        </p>
      </div>
    </Card>
  );
}

export default TotalOutstanding;
