import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr } from "../../../lib/format";
import "./NetCashFlow.css";

/*
 * "Net cash flow" -- collected minus paid to suppliers, for the
 * selected period. Period-based, so the page re-fetches it when
 * the toggle changes. `label` is the period's name (from the
 * collection trend: "October", "Wk of 6 Oct", "Q4 2026").
 */
function NetCashFlow({ netCashFlow, label }) {
  return (
    <Card className="net-cash-flow">
      <h2 className="net-cash-flow__title">Net cash flow</h2>

      <div className="net-cash-flow__figure">
        <div className="net-cash-flow__amount">
          <CountUp
            value={Number(netCashFlow.amount)}
            duration={800}
            format={formatInr}
          />
        </div>
        {label && <div className="net-cash-flow__period">{label}</div>}
      </div>

      <div className="net-cash-flow__breakdown">
        <div className="net-cash-flow__row">
          <span>Collected</span>
          <span className="net-cash-flow__value">
            {formatInr(netCashFlow.collected)}
          </span>
        </div>
        <div className="net-cash-flow__row">
          <span>Paid to suppliers</span>
          <span className="net-cash-flow__value">
            − {formatInr(netCashFlow.paid)}
          </span>
        </div>
        <p className="net-cash-flow__note">
          Cash retained after suppliers. Shown without a direction — it can
          rise simply because payments were delayed.
        </p>
      </div>
    </Card>
  );
}

export default NetCashFlow;
