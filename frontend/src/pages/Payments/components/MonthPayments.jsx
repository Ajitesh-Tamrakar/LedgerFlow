import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr } from "../../../lib/format";
import "./MonthPayments.css";

/*
 * "Supplier payments this month" -- the pale lime headline tile: the
 * running calendar month, summed in the browser from the merged rows
 * (payments has no own aggregate endpoint; this tile IS the aggregate).
 *
 * Pure presentation: the page hands it the finished figures.
 */
function MonthPayments({ total, count, periodLabel }) {
  const countLabel = count === 1 ? "1 payment" : `${count} payments`;

  return (
    <Card className="payments-month card--wide">
      <h2 className="payments-month__title">Supplier payments this month</h2>

      <div>
        <div className="payments-month__amount">
          <CountUp value={total} duration={900} format={formatInr} />
        </div>
        <div className="payments-month__scope">
          {countLabel} · {periodLabel}
        </div>
      </div>

      <p className="payments-month__note">
        Same non-treatment as Purchases on Bills — no badge, no trend, no
        implied direction. Money going out gets no warning colour it hasn't
        earned.
      </p>
    </Card>
  );
}

export default MonthPayments;
