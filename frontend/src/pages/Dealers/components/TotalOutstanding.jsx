import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import { formatInr } from "../../../lib/format";
import "./TotalOutstanding.css";

/*
 * "Total outstanding" -- the lime card. The dashboard has its own (tan)
 * version; this is the dealers page's, and it follows ALL dealers -- the
 * search box and tabs never narrow the money.
 *
 * Pure presentation: the page hands it the finished numbers.
 */
function TotalOutstanding({
  net,
  dealerCount,
  activeCount,
  owed,
  credit,
  creditCount,
  creditNote,
}) {
  return (
    <Card variant="accent" className="dealers-total-outstanding">
      <h2 className="dealers-total-outstanding__title">Total outstanding</h2>

      <div>
        <div className="dealers-total-outstanding__amount">
          <CountUp value={net} duration={900} format={formatInr} />
        </div>
        <div className="dealers-total-outstanding__scope">
          across all {dealerCount} dealers — {activeCount} active,{" "}
          {dealerCount - activeCount} inactive
        </div>
      </div>

      <div className="dealers-total-outstanding__bottom">
        <div className="dealers-total-outstanding__row">
          <span>Owed to dealers</span>
          <span className="dealers-total-outstanding__value">
            {formatInr(owed)}
          </span>
        </div>
        <div className="dealers-total-outstanding__row">
          <span>Held in credit</span>
          <span className="dealers-total-outstanding__value dealers-total-outstanding__value--credit">
            {formatInr(credit)}
          </span>
        </div>
        {creditCount > 0 && (
          <p className="dealers-total-outstanding__note">{creditNote}</p>
        )}
      </div>
    </Card>
  );
}

export default TotalOutstanding;
