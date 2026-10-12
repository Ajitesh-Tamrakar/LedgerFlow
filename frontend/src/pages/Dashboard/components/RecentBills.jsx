import { Link } from "react-router-dom";
import Card from "../../../components/Card/Card";
import { formatDate, formatInr } from "../../../lib/format";
import "./RecentBills.css";

/*
 * "Recent bills" -- the newest few bills, straight from the bills
 * list (the page takes the first 4 of the first page). The PDF chip
 * is a label, not a link: the design shows it but rows are not
 * navigable. The list is not period-based -- it is always "latest".
 */
function RecentBills({ bills }) {
  return (
    <Card className="recent-bills">
      <div className="recent-bills__header">
        <h2 className="recent-bills__title">Recent bills</h2>
        <Link className="recent-bills__all" to="/bills">
          All bills
        </Link>
      </div>

      <div className="recent-bills__list">
        {bills.map((bill) => (
          <div className="recent-bills__row" key={bill.id}>
            <span className="recent-bills__chip" aria-hidden="true">
              PDF
            </span>
            <div className="recent-bills__who">
              <div className="recent-bills__dealer">{bill.dealer_name}</div>
              <div className="recent-bills__date">{formatDate(bill.date)}</div>
            </div>
            <span className="recent-bills__amount">{formatInr(bill.amount)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default RecentBills;
