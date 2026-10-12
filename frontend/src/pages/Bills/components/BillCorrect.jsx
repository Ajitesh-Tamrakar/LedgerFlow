import { useEffect, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import DealerSelect from "./DealerSelect";
import { firstMessage } from "../../../lib/errors";
import { formatDate, formatInr } from "../../../lib/format";
import "./BillCorrect.css";

/*
 * "Correct this bill" -- the detail screen's white card: the big amount
 * reading, the dealer picker, the date and amount fields, and the save /
 * revert row.
 *
 * The field text is a draft local to this card (the DailyEntry pattern):
 * it is seeded from the row, and re-syncs whenever the page hands a fresh
 * row object -- which happens after every save, so the CTA settles back
 * to "Saved" without any extra wiring. Nothing is committed until Save.
 * The design's mock save is a 620 ms timeout; the real one is the page's
 * PATCH, and its rejection surfaces the server's own message.
 */

// The design's lenient number rule, same as the upload's details card:
// an optional minus, digits, at most one dot, commas dropped.
function num(value) {
  const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function BillCorrect({
  bill,
  dealers,
  pickerOptions,
  pickerOpen,
  onPickerOpen,
  onPickerClose,
  saving,
  onBack,
  onSave,
}) {
  const [draft, setDraft] = useState({
    dealer: bill.dealer,
    date: bill.date,
    amount: bill.amount,
  });

  useEffect(() => {
    setDraft({ dealer: bill.dealer, date: bill.date, amount: bill.amount });
  }, [bill]);

  const [detFlash, setDetFlash] = useState("");
  const [detError, setDetError] = useState("");

  // The design re-pops the display amount whenever the field's length
  // moves (its flipAnim off the string length).
  const [amountAnim, setAmountAnim] = useState("a");
  const lastAmountLen = useRef(String(bill.amount).length);

  useEffect(() => {
    const length = String(draft.amount).length;

    if (length !== lastAmountLen.current) {
      lastAmountLen.current = length;
      setAmountAnim((current) => (current === "a" ? "b" : "a"));
    }
  }, [draft.amount]);

  const currentDealer = draft.dealer
    ? dealers.find((dealer) => dealer.id === draft.dealer) || null
    : null;

  const dirty =
    draft.dealer !== bill.dealer ||
    draft.date !== bill.date ||
    num(draft.amount) !== num(bill.amount);

  function patch(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDetFlash("");
    setDetError("");
  }

  function handleSave() {
    if (saving) {
      return;
    }

    if (!String(draft.amount).trim() || num(draft.amount) <= 0) {
      setDetError(
        "Amount is required and must be greater than zero — the server rejects the PATCH otherwise, and nothing you typed is discarded."
      );
      return;
    }

    setDetError("");

    onSave({
      dealer: draft.dealer,
      date: draft.date,
      amount: num(draft.amount).toFixed(2),
    })
      .then(() => {
        setDetFlash("Saved. Previous values stay in the history underneath.");
      })
      .catch((error) => {
        setDetError(
          firstMessage(error) ||
            "The correction didn't save — nothing was changed. Your edits are still here."
        );
      });
  }

  function handleRevert() {
    setDraft({ dealer: bill.dealer, date: bill.date, amount: bill.amount });
    setDetFlash("");
    setDetError("");
  }

  const pickerNote =
    currentDealer && !currentDealer.is_active
      ? "Reassignment offers active dealers only, but this bill's current dealer is retired — it still has to render as its own value, so it stays listed."
      : "Active dealers only. A bill already pointing at a retired dealer keeps showing it.";

  return (
    <Card className="bill-correct card--wide">
      <div className="bill-correct__header">
        <h2 className="bill-correct__title">Correct this bill</h2>
        <button
          type="button"
          className="bill-correct__back"
          onClick={onBack}
        >
          Back to bills
        </button>
      </div>

      <div className="bill-correct__amount-box">
        <span className="bill-correct__amount-label">Amount on file</span>
        <span
          className={`bill-correct__amount-display bill-correct__amount-display--${amountAnim}`}
        >
          {formatInr(num(draft.amount))}
        </span>
        <span className="bill-correct__amount-note">
          {dirty
            ? "Edited — not saved yet."
            : `As stored, string "${bill.amount}" parsed for display.`}
        </span>
      </div>

      <DealerSelect
        label="Dealer"
        dealers={dealers}
        options={pickerOptions}
        value={draft.dealer}
        onChange={(id) => patch("dealer", id)}
        placeholder="No such dealer"
        showRetiredTag
        note={pickerNote}
        noteWithQuery="Matching runs in the browser — typing never costs a request."
        open={pickerOpen}
        onOpen={onPickerOpen}
        onClose={onPickerClose}
      />

      <div className="bill-correct__grid">
        <label className="bill-correct__field">
          <span className="bill-correct__label">Bill date</span>
          <span className="bill-correct__box">
            <input
              type="date"
              value={draft.date}
              onChange={(event) => patch("date", event.target.value)}
            />
          </span>
        </label>

        <label className="bill-correct__field">
          <span className="bill-correct__label">Amount</span>
          <span
            className={
              "bill-correct__box bill-correct__box--amount" +
              (detError ? " bill-correct__box--invalid" : "")
            }
          >
            <span aria-hidden="true" className="bill-correct__symbol">
              ₹
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) => patch("amount", event.target.value)}
              aria-invalid={detError || undefined}
            />
          </span>
        </label>
      </div>

      <span
        className={
          "bill-correct__hint" + (detFlash ? " bill-correct__hint--saved" : "")
        }
      >
        {detFlash ||
          "Amount, date and dealer are the only editable fields, all through PATCH."}
      </span>

      {detError && (
        <div className="bill-correct__save-error" role="alert">
          {detError}
        </div>
      )}

      <div className="bill-correct__recorded">
        <span>Recorded</span>
        <span>{formatDate(String(bill.created_at).slice(0, 10))}</span>
      </div>

      <div className="bill-correct__footer">
        <div className="bill-correct__actions">
          <button
            type="button"
            className={
              "bill-correct__save" +
              (!dirty || saving ? " bill-correct__save--off" : "") +
              (saving ? " bill-correct__save--busy" : "")
            }
            disabled={!dirty || saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : dirty ? "Save correction" : "Saved"}
          </button>
          <button
            type="button"
            className={
              "bill-correct__revert" +
              (!dirty ? " bill-correct__revert--off" : "")
            }
            disabled={!dirty}
            onClick={handleRevert}
          >
            Revert
          </button>
        </div>

        <span className="bill-correct__note">
          Corrections save straight through PATCH — no confirmation step,
          because the history underneath keeps every previous value. There is
          no delete on a bill at all.
        </span>
      </div>
    </Card>
  );
}

export default BillCorrect;
