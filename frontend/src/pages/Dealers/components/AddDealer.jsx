import { useState } from "react";
import Card from "../../../components/Card/Card";
import { formatInr } from "../../../lib/format";
import "./AddDealer.css";

/*
 * "Add a dealer" -- the lavender panel. It shares the detail panel's grid
 * slot: the page renders one or the other, never both.
 *
 * The field text is a draft local to this card; the name clash is checked
 * against the page's dealer list (the design's first guard -- the API's
 * 400 on a duplicate name is the final one). Nothing is sent until the
 * user confirms, and the drafts clear only when the save actually lands.
 */

// The design's lenient number rule: an optional minus, digits, at most
// one dot (a negative opening balance means the dealer starts in credit).
function isBadNumber(value) {
  const text = String(value).trim();
  return !!text && !/^-?[0-9]*\.?[0-9]*$/.test(text);
}

// The design's number reading: keep digits, the dot and the minus;
// anything else drops. A blank or mangled field reads as 0.
function num(value) {
  const parsed = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

const BLANK = { name: "", gstin: "", balance: "", active: true, touched: false };

function AddDealer({ dealers, saving, onSave }) {
  const [draft, setDraft] = useState(BLANK);

  const nameVal = draft.name.trim();
  const clash =
    nameVal !== "" &&
    dealers.some(
      (other) => other.name.trim().toLowerCase() === nameVal.toLowerCase()
    );
  // The design only shows the name error after a Save attempt (touched) --
  // a half-typed name is not yet an error.
  const nameError = draft.touched && (!nameVal || clash);

  // The GSTIN length warning is informational, never blocking.
  const gstVal = draft.gstin.trim();
  const gstBad = !!gstVal && gstVal.length !== 15;

  const balanceBad = isBadNumber(draft.balance);
  const balanceNum = num(draft.balance);

  const blocked = saving || !nameVal || clash || balanceBad;

  async function handleSave() {
    // The design's guard: a blocked attempt marks the form touched (so an
    // Enter press on a bad field shows why), and stops there.
    if (!nameVal || clash || balanceBad) {
      setDraft((current) => ({ ...current, touched: true }));
      return;
    }
    if (saving) {
      return;
    }

    const ok = await onSave({
      name: nameVal,
      gstin: gstVal.toUpperCase(),
      openingBalance: balanceNum,
      isActive: draft.active,
    });

    if (ok) {
      setDraft(BLANK);
    } else {
      setDraft((current) => ({ ...current, touched: true }));
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    }
  }

  const gstNote = !gstVal
    ? "Leave blank if the dealer is unregistered."
    : gstBad
      ? `${gstVal.length} of 15 characters — it will save, but won’t match GST lookups.`
      : "Valid length.";

  const balanceNote = balanceBad
    ? "Numbers only — a minus sign is allowed."
    : balanceNum === 0
      ? "What they owed before LedgerFlow. Negative if they start in credit."
      : balanceNum < 0
        ? `Starts ${formatInr(Math.abs(balanceNum))} in credit.`
        : `Starts ${formatInr(balanceNum)} outstanding.`;

  return (
    <Card className="add-dealer">
      <h2 className="add-dealer__title">Add a dealer</h2>

      <label className="add-dealer__field">
        <span className="add-dealer__label">Name</span>
        <span
          className={
            "add-dealer__box" +
            (nameError ? " add-dealer__box--invalid" : "")
          }
        >
          <input
            type="text"
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            onKeyDown={handleKeyDown}
            aria-invalid={nameError || undefined}
            placeholder="Vasant Agencies"
          />
        </span>
        {nameError && (
          <span className="add-dealer__field-error">
            {clash
              ? "You already have a dealer with this name."
              : "A name is required."}
          </span>
        )}
      </label>

      <label className="add-dealer__field">
        <span className="add-dealer__label">GSTIN — optional</span>
        <span
          className={
            "add-dealer__box" + (gstBad ? " add-dealer__box--invalid" : "")
          }
        >
          <input
            type="text"
            className="add-dealer__gstin"
            value={draft.gstin}
            onChange={(event) =>
              setDraft((current) => ({ ...current, gstin: event.target.value }))
            }
            onKeyDown={handleKeyDown}
            aria-invalid={gstBad || undefined}
            placeholder="27AABCV1234F1Z5"
          />
        </span>
        <span
          className={
            "add-dealer__note" + (gstBad ? " add-dealer__note--warn" : "")
          }
        >
          {gstNote}
        </span>
      </label>

      <label className="add-dealer__field">
        <span className="add-dealer__label">Opening balance</span>
        <span
          className={
            "add-dealer__box" +
            (balanceBad ? " add-dealer__box--invalid" : "")
          }
        >
          <span aria-hidden="true" className="add-dealer__symbol">
            ₹
          </span>
          <input
            type="text"
            inputMode="decimal"
            className="add-dealer__balance"
            value={draft.balance}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                balance: event.target.value,
              }))
            }
            onKeyDown={handleKeyDown}
            aria-invalid={balanceBad || undefined}
            placeholder="0.00"
          />
        </span>
        <span
          className={
            "add-dealer__note" +
            (balanceBad ? " add-dealer__note--warn" : "")
          }
        >
          {balanceNote}
        </span>
      </label>

      <button
        type="button"
        className="add-dealer__switch"
        aria-pressed={draft.active}
        onClick={() =>
          setDraft((current) => ({ ...current, active: !current.active }))
        }
      >
        <span
          className={
            "add-dealer__track" +
            (draft.active ? " add-dealer__track--on" : "")
          }
          aria-hidden="true"
        >
          <span
            className={
              "add-dealer__knob" + (draft.active ? " add-dealer__knob--on" : "")
            }
          />
        </span>
        <span className="add-dealer__switch-text">
          <span>{draft.active ? "Active dealer" : "Inactive dealer"}</span>
          <span className="add-dealer__switch-note">
            {draft.active
              ? "Shows up when recording bills and payments."
              : "Kept on the books, hidden from pickers."}
          </span>
        </span>
      </button>

      <div className="add-dealer__footer">
        <button
          type="button"
          className={
            "add-dealer__cta" +
            (saving ? " add-dealer__cta--busy" : "") +
            (blocked ? " add-dealer__cta--blocked" : "")
          }
          disabled={blocked}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Add dealer"}
        </button>
        <p className="add-dealer__footnote">
          Names are unique per business. Open any dealer in the list to edit
          it — nothing is ever deleted.
        </p>
      </div>
    </Card>
  );
}

export default AddDealer;
