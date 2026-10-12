import Card from "../../../components/Card/Card";
import "./RecordPayment.css";

/*
 * "Record a payment" -- the dark card on the list screen: the door into
 * the side panel. Pure presentation -- one callback.
 */
function RecordPayment({ onAdd }) {
  return (
    <Card variant="dark" className="payments-record card--wide">
      <h2 className="payments-record__title">Record a payment</h2>

      <p className="payments-record__text">
        Dealer, amount, date, method. Nothing else — no file, no attachment,
        and no field pairing this to a bill.
      </p>

      <div className="payments-record__actions">
        <button type="button" className="payments-record__button" onClick={onAdd}>
          Add payment
        </button>
        <span className="payments-record__hint">
          Retired dealers stay selectable here — a final settlement is the
          usual reason to touch a closed account.
        </span>
      </div>
    </Card>
  );
}

export default RecordPayment;
