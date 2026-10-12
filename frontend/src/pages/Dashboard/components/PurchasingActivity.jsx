import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr } from "../../../lib/format";
import "./PurchasingActivity.css";

/*
 * "Purchasing activity" -- the lavender card.
 *
 * The design writes the "Outstanding rose/fell …" sentence on the client,
 * so this card builds it from the numbers it is handed (that is
 * presentation, not data-fetching -- the API still returns raw sums).
 */
const PERIOD_WORDS = {
  week: "this week",
  month: "this month",
  quarter: "this quarter",
};

function PurchasingActivity({ purchasing, period = "month" }) {
  const word = PERIOD_WORDS[period] || "this period";
  const net = Number(purchasing.bills) - Number(purchasing.payments);

  const explain =
    net === 0
      ? `Billing and payments matched ${word}, so outstanding did not move.`
      : `Outstanding ${net > 0 ? "rose" : "fell"} ${formatInr(Math.abs(net))} ${word} because ${formatInr(
          purchasing.bills
        )} was billed and ${formatInr(purchasing.payments)} was paid.`;

  return (
    <Card className="purchasing-activity">
      <h2 className="purchasing-activity__title">Purchasing activity</h2>

      <div className="purchasing-activity__block">
        <div className="purchasing-activity__caption">
          Purchases · {word}
        </div>
        <div className="purchasing-activity__figures">
          <span className="purchasing-activity__amount">
            <CountUp
              value={Number(purchasing.bills)}
              duration={800}
              format={formatInr}
            />
          </span>
          <span className="purchasing-activity__count">
            · <CountUp value={purchasing.bill_count} duration={800} /> bills
          </span>
        </div>
      </div>

      <div className="purchasing-activity__block">
        <div className="purchasing-activity__caption">
          Supplier payments · {word}
        </div>
        <div className="purchasing-activity__figures">
          <span className="purchasing-activity__amount">
            <CountUp
              value={Number(purchasing.payments)}
              duration={800}
              format={formatInr}
            />
          </span>
          <span className="purchasing-activity__count">
            · <CountUp value={purchasing.payment_count} duration={800} /> payments
          </span>
        </div>
      </div>

      <p className="purchasing-activity__explain">{explain}</p>
    </Card>
  );
}

export default PurchasingActivity;
