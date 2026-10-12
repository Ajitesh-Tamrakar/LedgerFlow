import { useEffect, useRef, useState } from "react";
import DealerPicker from "../../../components/DealerPicker/DealerPicker";
import DateField from "../../../components/DateField/DateField";
import { firstMessage } from "../../../lib/errors";
import { formatDate, formatInr, getToday } from "../../../lib/format";
import "./PaymentPanel.css";

/*
 * The side panel -- the only way in and out of a payment. Add and
 * correct share it: a scrim over the page and a right-hand drawer with
 * the amount preview, the dealer picker, the date calendar, the amount
 * field, the method pills and the save row.
 *
 * The draft is local to this card (the BillCorrect / DailyEntry pattern):
 * it is seeded from the row it opened on -- the page remounts the card
 * for each open, so no re-sync wiring is needed -- and nothing is
 * committed until Save. Save hands the page the values; the page runs
 * the real create/correct (the design's 620 ms mock timeout) and its
 * rejection surfaces the server's own message in the alert below.
 */

// The design's lenient number rule: an optional minus, digits, at most
// one dot, commas dropped.
function num(value) {
  const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function seedFor(mode, payment) {
  if (mode === "edit" && payment) {
    return {
      dealer: payment.dealer,
      amount: payment.amount,
      date: payment.date,
      method: payment.method,
    };
  }

  return { dealer: null, amount: "", date: getToday(), method: "upi" };
}

function PaymentPanel({
  mode,
  payment,
  dealers,
  methods,
  savedDates,
  saving,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() => seedFor(mode, payment));
  const [error, setError] = useState("");

  // The design re-pops the preview amount whenever the field's length
  // moves (its flipAnim off the string length).
  const [amountAnim, setAmountAnim] = useState("a");
  const lastAmountLen = useRef(String(draft.amount).length);

  useEffect(() => {
    const length = String(draft.amount).length;

    if (length !== lastAmountLen.current) {
      lastAmountLen.current = length;
      setAmountAnim((current) => (current === "a" ? "b" : "a"));
    }
  }, [draft.amount]);

  // The drawer is modal: Escape exits it.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isEdit = mode === "edit";
  const orig = isEdit ? payment : null;
  const draftDealer = draft.dealer
    ? dealers.find((dealer) => dealer.id === draft.dealer) || null
    : null;
  const amt = num(draft.amount);
  const negative = /^\s*-/.test(String(draft.amount));
  const methodLabel = (value) => {
    const found = methods.find((item) => item.value === value);
    return found ? found.label : value;
  };

  const dirty =
    !orig ||
    draft.dealer !== orig.dealer ||
    draft.date !== orig.date ||
    draft.method !== orig.method ||
    num(draft.amount) !== num(orig.amount);

  function patch(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSave() {
    if (saving) {
      return;
    }

    if (!draft.dealer) {
      setError(
        'Choose a dealer. A dealer from another business comes back as the same generic "No such dealer." — the server never says which.'
      );
      return;
    }

    if (!String(draft.amount).trim() || num(draft.amount) <= 0) {
      setError(
        "Amount must be greater than zero — rejected here, before submit, like every money field in the app."
      );
      return;
    }

    setError("");

    onSave({
      dealer: draft.dealer,
      date: draft.date,
      amount: num(draft.amount).toFixed(2),
      method: draft.method,
    }).catch((saveError) => {
      setError(
        firstMessage(saveError) ||
          "The payment didn't save — nothing was changed. Your entries are still here."
      );
    });
  }

  function handleSecondary() {
    if (!isEdit) {
      onClose();
      return;
    }

    if (orig) {
      setDraft(seedFor("edit", orig));
      setError("");
    }
  }

  const previewNote = negative
    ? "Negative amounts are rejected before submit."
    : isEdit
      ? dirty
        ? "Edited — not saved yet."
        : `As stored, string "${orig ? orig.amount : ""}" parsed for display.`
      : draftDealer
        ? `To ${draftDealer.name} by ${methodLabel(draft.method).toLowerCase()}.`
        : "Pick a dealer to finish this.";

  return (
    <div className="payments-panel">
      <button
        type="button"
        className="payments-panel__scrim"
        aria-label="Close panel"
        onClick={onClose}
      />

      <div
        className="payments-panel__drawer"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Correct payment ${payment.id}` : "Add payment"}
      >
        <div className="payments-panel__header">
          <h2 className="payments-panel__title">
            {isEdit ? `Correct payment #${payment.id}` : "Add payment"}
          </h2>
          <button
            type="button"
            className="payments-panel__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="payments-panel__preview">
          <span className="payments-panel__preview-label">
            {isEdit ? "Amount on file" : "Amount going out"}
          </span>
          <span
            className={`payments-panel__preview-amount payments-panel__preview-amount--${amountAnim}`}
          >
            {formatInr(amt)}
          </span>
          <span className="payments-panel__preview-note">{previewNote}</span>
        </div>

        <div className="payments-panel__dealer">
          <DealerPicker
            dealers={dealers}
            value={draft.dealer}
            onChange={(id) => patch("dealer", id)}
            label="Dealer — retired ones included"
            placeholder="Choose a dealer"
          />
          <span className="payments-panel__picker-note">
            Unlike a new bill, a retired supplier stays selectable — settling
            a final balance after retiring a dealer is the common case, not
            an edge one.
          </span>
        </div>

        <div className="payments-panel__fields">
          <label className="payments-panel__field">
            <span className="payments-panel__label">Amount</span>
            <span
              className={
                "payments-panel__amount-box" +
                (negative || error ? " payments-panel__amount-box--invalid" : "")
              }
            >
              <span aria-hidden="true">₹</span>
              <input
                type="text"
                inputMode="decimal"
                value={draft.amount}
                onChange={(event) => patch("amount", event.target.value)}
                aria-invalid={negative || error ? true : undefined}
                placeholder="0.00"
              />
            </span>
          </label>

          <DateField
            label="Paid on"
            value={draft.date}
            onChange={(iso) => patch("date", iso)}
            savedDates={savedDates}
          />
        </div>

        <span
          className={
            "payments-panel__hint" +
            (negative ? " payments-panel__hint--warn" : "")
          }
        >
          {negative
            ? "Amount can't be negative — a refund isn't modelled here."
            : "Four fields, full stop. No file, no attachment, and no field linking this to a bill — the two resources are independent by design."}
        </span>

        <div className="payments-panel__methods">
          <span className="payments-panel__label">Method</span>
          <div
            className="payments-panel__method-pills"
            role="group"
            aria-label="Method"
          >
            {methods.map((item) => {
              const on = draft.method === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  className="payments-panel__method"
                  style={{
                    background: on ? item.bg : "#FFFFFF",
                    color: on ? item.fg : "#5C6055",
                    borderColor: on ? item.border : "#E6E6DE",
                  }}
                  aria-pressed={on}
                  onClick={() => patch("method", item.value)}
                >
                  <span
                    className="payments-panel__method-dot"
                    style={{ background: on ? item.fg : "#D5D5CC" }}
                    aria-hidden="true"
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
          <span className="payments-panel__method-note">
            {isEdit
              ? "Logged as cash when it was really UPI is the everyday correction — one tap here, no separate screen for it."
              : "Five fixed values, read from the same endpoint as the list filter rather than hardcoded twice."}
          </span>
        </div>

        {error && (
          <div className="payments-panel__error" role="alert">
            {error}
          </div>
        )}

        {isEdit && (
          <div className="payments-panel__recorded">
            <span>Recorded</span>
            <span>{formatDate(String(payment.created_at).slice(0, 10))}</span>
          </div>
        )}

        <div className="payments-panel__footer">
          <div className="payments-panel__actions">
            <button
              type="button"
              className={
                "payments-panel__save" +
                (saving || (isEdit && !dirty)
                  ? " payments-panel__save--off"
                  : "") +
                (saving ? " payments-panel__save--busy" : "")
              }
              disabled={saving || (isEdit && !dirty)}
              onClick={handleSave}
            >
              {saving
                ? "Saving…"
                : isEdit
                  ? dirty
                    ? "Save correction"
                    : "Saved"
                  : "Record payment"}
            </button>
            <button
              type="button"
              className={
                "payments-panel__secondary" +
                (isEdit && !dirty ? " payments-panel__secondary--off" : "")
              }
              disabled={isEdit && !dirty}
              onClick={handleSecondary}
            >
              {isEdit ? "Revert" : "Cancel"}
            </button>
          </div>

          <span className="payments-panel__foot">
            {isEdit
              ? "Corrections go straight through PATCH — no confirmation, because django-simple-history keeps every previous value. There is no delete on a payment."
              : "Saved with POST. Amounts travel as strings both ways and are parsed before any arithmetic."}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PaymentPanel;
