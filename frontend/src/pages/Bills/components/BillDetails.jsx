import Card from "../../../components/Card/Card";
import DealerSelect from "./DealerSelect";
import { formatInr } from "../../../lib/format";
import "./BillDetails.css";

/*
 * "Bill details" -- the lime card on the upload screen: the dealer
 * picker (active only), the bill date and the amount. All three travel
 * with the file in the same request.
 *
 * The design's "Prototype switches" block is a mock-only convenience
 * (it simulated failures in the static preview) and is not built.
 *
 * Pure presentation: the page owns the upload draft's three fields and
 * the error state; in replace mode the page seeds them from the bill.
 */

// The design's lenient number rule, same as the dealers forms.
function num(value) {
  const parsed = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function BillDetails({
  dealers,
  activeDealers,
  upDealer,
  onDealerChange,
  upDate,
  onDateChange,
  upAmount,
  onAmountChange,
  upError,
  pickerOpen,
  onPickerOpen,
  onPickerClose,
}) {
  // The design's invalid state: any validation error reddens the amount
  // border; the aria-invalid is only for a rejected AND empty amount.
  const invalid = !!upError && upError.kind === "validation";
  const amountInvalid = invalid && !String(upAmount).trim();

  const amountNote = String(upAmount).trim()
    ? `Parsed as ${formatInr(
        num(upAmount)
      )} — this API returns money as strings, so it is parsed both ways.`
    : "Dealer, date and amount travel with the file in the same request.";

  return (
    <Card className="bill-details card--wide">
      <h2 className="bill-details__title">Bill details</h2>

      <DealerSelect
        theme="accent"
        label="Dealer — active only"
        dealers={dealers}
        options={activeDealers}
        value={upDealer}
        onChange={onDealerChange}
        placeholder="Choose a dealer"
        emptyMuted
        note="Retired dealers are left out here — you wouldn't attach a new bill to a closed supplier relationship. The list's filter does include them."
        noteWithQuery="Matching runs in the browser — the dealer list arrives once, so typing never costs a request."
        open={pickerOpen}
        onOpen={onPickerOpen}
        onClose={onPickerClose}
      />

      <div className="bill-details__grid">
        <label className="bill-details__field">
          <span className="bill-details__label">Bill date</span>
          <span className="bill-details__box">
            <input
              type="date"
              value={upDate}
              onChange={(event) => onDateChange(event.target.value)}
            />
          </span>
        </label>

        <label className="bill-details__field">
          <span className="bill-details__label">Amount</span>
          <span
            className={
              "bill-details__box bill-details__box--amount" +
              (invalid ? " bill-details__box--invalid" : "")
            }
          >
            <span aria-hidden="true" className="bill-details__symbol">
              ₹
            </span>
            <input
              type="text"
              inputMode="decimal"
              className="bill-details__amount"
              value={upAmount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="0.00"
              aria-invalid={amountInvalid || undefined}
            />
          </span>
        </label>
      </div>

      <span className="bill-details__amount-note">{amountNote}</span>
    </Card>
  );
}

export default BillDetails;
