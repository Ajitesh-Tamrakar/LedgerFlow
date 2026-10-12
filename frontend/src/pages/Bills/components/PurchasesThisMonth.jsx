import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr } from "../../../lib/format";
import "./PurchasesThisMonth.css";

/*
 * "Purchases this month" -- the pale lime headline card. The figure and
 * the count come from the bills/purchases endpoint, never summed from the
 * (filtered, paginated) list -- the design is explicit about that.
 *
 * Pure presentation: the page hands it the finished numbers and the
 * period line.
 */
function PurchasesThisMonth({ total, count, periodLabel }) {
  const countLabel = count === 1 ? "1 bill" : `${count} bills`;

  return (
    <Card className="purchases-this-month card--wide">
      <h2 className="purchases-this-month__title">Purchases this month</h2>

      <div>
        <div className="purchases-this-month__amount">
          <CountUp value={total} duration={900} format={formatInr} />
        </div>
        <div className="purchases-this-month__scope">
          {countLabel} · {periodLabel}
        </div>
      </div>

      <p className="purchases-this-month__note">
        No percentage, no up-or-down arrow — on purpose. Purchasing is
        lumpy, not daily: one large delivery landing early in the month is
        timing, not a trend. That holds here too, extra room or not.
      </p>
    </Card>
  );
}

export default PurchasesThisMonth;
