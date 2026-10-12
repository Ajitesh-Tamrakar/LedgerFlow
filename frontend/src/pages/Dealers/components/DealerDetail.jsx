import { useEffect, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import { formatDate, formatInr } from "../../../lib/format";
import "./DealerDetail.css";

/*
 * "Dealer" -- the detail panel. Opening a dealer swaps it in for the Add
 * panel in the same grid slot; Close puts the Add panel back.
 *
 * The field text is a draft local to this card (the DailyEntry pattern):
 * it is seeded from the row, and re-syncs whenever the page hands a fresh
 * row object -- which happens after every save and after a row's
 * Retire/Restore, so the switch follows along without any extra wiring.
 * Nothing is committed until Save.
 */

// The design's lenient number rule: an optional minus, digits, at most
// one dot. (Unlike the cashbook's fields, a minus is legitimate here --
// a negative opening balance means the dealer started in credit.)
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

// The row, into the form's field text: a 2-dp API string ("20000.00")
// reads back clean ("20000"); a null GSTIN is "not on file".
function seedDraft(dealer) {
  return {
    name: dealer.name,
    gstin: dealer.gstin || "",
    opening: String(Number(dealer.opening_balance)),
    isActive: dealer.is_active,
  };
}

function DealerDetail({ dealer, dealers, saving, onSave, onClose }) {
  const [draft, setDraft] = useState(() => seedDraft(dealer));

  // A fresh row object means "the stored values moved" -- re-sync.
  useEffect(() => {
    setDraft(seedDraft(dealer));
  }, [dealer]);

  const balance = Number(dealer.outstanding_balance);

  // The design re-pops the figure whenever the dealer or its balance
  // changes -- same A/B keyframe alternation as QuickStatus.
  const [pop, setPop] = useState("a");
  const lastKey = useRef(`${dealer.id}:${dealer.outstanding_balance}`);

  useEffect(() => {
    const key = `${dealer.id}:${dealer.outstanding_balance}`;
    if (lastKey.current !== key) {
      lastKey.current = key;
      setPop((current) => (current === "a" ? "b" : "a"));
    }
  }, [dealer.id, dealer.outstanding_balance]);

  // The design's clash check against every OTHER dealer.
  const trimmedName = draft.name.trim().toLowerCase();
  const nameClash =
    trimmedName !== "" &&
    dealers.some(
      (other) =>
        other.id !== dealer.id &&
        other.name.trim().toLowerCase() === trimmedName
    );
  const nameInvalid = trimmedName === "" || nameClash;

  const openingInvalid = isBadNumber(draft.opening);

  // A changed opening balance moves the stored figure, so compare the
  // parsed numbers, not the text.
  const dirty =
    draft.name !== dealer.name ||
    draft.gstin !== (dealer.gstin || "") ||
    num(draft.opening) !== Number(dealer.opening_balance) ||
    draft.isActive !== dealer.is_active;

  const blocked = saving || !dirty || nameInvalid || openingInvalid;

  const answer = balance < 0 ? "credit" : balance === 0 ? "settled" : "owed";

  function handleSave() {
    if (blocked) {
      return;
    }
    onSave({
      name: draft.name.trim(),
      gstin: draft.gstin.trim().toUpperCase(),
      openingBalance: num(draft.opening),
      isActive: draft.isActive,
    });
  }

  return (
    <Card className="dealer-detail">
      <div className="dealer-detail__header">
        <h2 className="dealer-detail__title">Dealer</h2>
        <button
          type="button"
          className="dealer-detail__close"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div
        className={`dealer-detail__answer dealer-detail__answer--${answer}`}
      >
        <span className="dealer-detail__answer-label">
          {balance < 0
            ? "You owe them nothing — they are in credit"
            : balance === 0
              ? "Settled up"
              : `Outstanding to ${dealer.name}`}
        </span>
        <span
          className={`dealer-detail__answer-amount dealer-detail__answer-amount--${pop}`}
        >
          {formatInr(balance)}
        </span>
        <span className="dealer-detail__answer-note">
          {balance < 0
            ? `Payments to ${dealer.name} exceed what was billed by ${formatInr(
                Math.abs(balance)
              )}. It nets off against their next bill.`
            : balance === 0
              ? "Nothing is due in either direction right now."
              : `Due to ${dealer.name} as of today, across everything on record.`}
        </span>
      </div>

      <label className="dealer-detail__field">
        <span className="dealer-detail__label">Name</span>
        <span
          className={
            "dealer-detail__box" +
            (nameInvalid ? " dealer-detail__box--invalid" : "")
          }
        >
          <input
            type="text"
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            aria-invalid={nameInvalid || undefined}
          />
        </span>
        {nameInvalid && (
          <span className="dealer-detail__field-error">
            {trimmedName === ""
              ? "A name is required."
              : "You already have a dealer with this name."}
          </span>
        )}
      </label>

      <div className="dealer-detail__grid">
        <label className="dealer-detail__field">
          <span className="dealer-detail__label">GSTIN</span>
          <span className="dealer-detail__box">
            <input
              type="text"
              className="dealer-detail__gstin"
              value={draft.gstin}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  gstin: event.target.value,
                }))
              }
              placeholder="Not on file"
            />
          </span>
        </label>

        <label className="dealer-detail__field">
          <span className="dealer-detail__label">Opening balance</span>
          <span
            className={
              "dealer-detail__box" +
              (openingInvalid ? " dealer-detail__box--invalid" : "")
            }
          >
            <span aria-hidden="true" className="dealer-detail__symbol">
              ₹
            </span>
            <input
              type="text"
              inputMode="decimal"
              className="dealer-detail__opening"
              value={draft.opening}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  opening: event.target.value,
                }))
              }
              aria-invalid={openingInvalid || undefined}
            />
          </span>
        </label>
      </div>
      <span
        className={
          "dealer-detail__opening-note" +
          (openingInvalid ? " dealer-detail__opening-note--bad" : "")
        }
      >
        {openingInvalid
          ? "Numbers only — a minus sign is allowed."
          : "What stood before LedgerFlow. Negative means they started in credit."}
      </span>

      <button
        type="button"
        className="dealer-detail__switch"
        aria-pressed={draft.isActive}
        onClick={() =>
          setDraft((current) => ({ ...current, isActive: !current.isActive }))
        }
      >
        <span
          className={
            "dealer-detail__track" +
            (draft.isActive ? " dealer-detail__track--on" : "")
          }
          aria-hidden="true"
        >
          <span
            className={
              "dealer-detail__knob" +
              (draft.isActive ? " dealer-detail__knob--on" : "")
            }
          />
        </span>
        <span className="dealer-detail__switch-text">
          <span>{draft.isActive ? "Active dealer" : "Retired dealer"}</span>
          <span className="dealer-detail__switch-note">
            {draft.isActive
              ? "Appears when recording bills and payments."
              : "Hidden from pickers, all history kept."}
          </span>
        </span>
      </button>

      <div className="dealer-detail__added">
        <span>Added</span>
        <span>{formatDate(String(dealer.created_at).slice(0, 10))}</span>
      </div>

      <div className="dealer-detail__footer">
        <div className="dealer-detail__buttons">
          <button
            type="button"
            className={
              "dealer-detail__save" +
              (saving ? " dealer-detail__save--busy" : "") +
              (blocked ? " dealer-detail__save--blocked" : "")
            }
            disabled={blocked}
            onClick={handleSave}
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
          <button
            type="button"
            className={
              "dealer-detail__revert" +
              (!dirty || saving ? " dealer-detail__revert--idle" : "")
            }
            disabled={!dirty || saving}
            onClick={() => setDraft(seedDraft(dealer))}
          >
            Revert
          </button>
        </div>
        <p className="dealer-detail__footnote">
          Dealers are never deleted — switching them off keeps every bill and
          payment intact. A full statement of this dealer's bills and payments
          is a separate screen, not built yet.
        </p>
      </div>
    </Card>
  );
}

export default DealerDetail;
