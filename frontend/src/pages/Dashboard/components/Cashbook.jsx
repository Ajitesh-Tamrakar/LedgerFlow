import { useEffect, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import DateField from "../../../components/DateField/DateField";
import { formatDay, formatInr, getToday } from "../../../lib/format";
import "./Cashbook.css";

/*
 * "Cashbook" -- the wide card with the day form.
 *
 * Two branches on load, one branch on save:
 *   GET by-date -> 200 : the page hands the row, the fields fill from it
 *   GET by-date -> 404 : the page hands null,  the fields render blank
 *   Save (always)      : PUT the three values -- the backend's
 *                         create-or-replace does the branching itself.
 *
 * The card holds the field *text* (draft state, like the task composer)
 * and reports onDateChange / onSave up; the page does the fetching.
 */
const FIELDS = [
  { key: "upi", label: "UPI" },
  { key: "cash", label: "Cash" },
  { key: "cards", label: "Cards" },
];

// The design's lenient number rule: digits with at most one dot.
function isClean(value) {
  return /^[0-9]*\.?[0-9]*$/.test(String(value).trim());
}

// The design's number reading: digits/dot only; anything else counts as 0.
// (Also the save guard -- a blank or mangled field goes up as "0", because
// the API's Decimal fields reject empty strings.)
function num(value) {
  const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

// API strings ("32500.00") into clean input text ("32500"); a 404 row
// becomes three blanks.
function fromEntry(entry) {
  if (!entry) {
    return { upi: "", cash: "", cards: "" };
  }
  return {
    upi: String(Number(entry.upi)),
    cash: String(Number(entry.cash)),
    cards: String(Number(entry.cards)),
  };
}

function Cashbook({ selectedDate, entry, saving, savedDates, onDateChange, onSave }) {
  const [fields, setFields] = useState(() => fromEntry(entry));

  // The page hands a fresh row (or a 404 blank) whenever the selected
  // day changes or a save lands -- re-sync the fields each time.
  useEffect(() => {
    setFields(fromEntry(entry));
  }, [entry, selectedDate]);

  const today = getToday();
  const isToday = selectedDate === today;

  const validity = FIELDS.map((field) => isClean(fields[field.key]));
  const dirty = FIELDS.some(
    (field) =>
      num(fields[field.key]) !== Number(entry ? entry[field.key] : 0)
  );
  const isSaved = !!entry && !dirty;
  const blocked = saving || validity.some((ok) => !ok);

  const total = FIELDS.reduce((sum, field) => sum + num(fields[field.key]), 0);

  // While the selected day has unsaved edits, hide its saved-dot -- the
  // design clears a day's saved flag the moment a field is edited.
  const dots = dirty
    ? savedDates.filter((date) => date !== selectedDate)
    : savedDates;

  // The design re-fires a small rise on the total every time it changes
  // (it moves with every keystroke) -- same A/B keyframe alternation.
  const [pop, setPop] = useState("a");
  const lastTotal = useRef(total);

  useEffect(() => {
    if (lastTotal.current !== total) {
      lastTotal.current = total;
      setPop((current) => (current === "a" ? "b" : "a"));
    }
  }, [total]);

  const status = saving
    ? "Saving…"
    : isSaved
      ? `Saved for ${formatDay(selectedDate)}`
      : isToday
        ? "Not recorded yet"
        : `No entry for ${formatDay(selectedDate)} yet`;

  const cta = saving
    ? "Saving…"
    : isSaved
      ? "Saved"
      : isToday
        ? "Save today’s entry"
        : `Save entry for ${formatDay(selectedDate)}`;

  return (
    <Card className="cashbook card--wide">
      <div className="cashbook__header">
        <h2 className="cashbook__title">Cashbook</h2>
        <div className="cashbook__header-tools">
          <span className="cashbook__status">{status}</span>
          {!isToday && (
            <button
              type="button"
              className="cashbook__back-today"
              onClick={() => onDateChange(today)}
            >
              Back to today
            </button>
          )}
          <DateField
            value={selectedDate}
            onChange={onDateChange}
            savedDates={dots}
          />
        </div>
      </div>

      <div className="cashbook__fields">
        {FIELDS.map(({ key, label }, i) => {
          const value = fields[key];

          return (
            <label className="cashbook__field" key={key}>
              <span className="cashbook__field-label">{label}</span>
              <span
                className={
                  "cashbook__field-box" +
                  (validity[i] ? "" : " cashbook__field-box--invalid")
                }
              >
                <span className="cashbook__field-symbol" aria-hidden="true">
                  ₹
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={value}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  aria-invalid={validity[i] ? undefined : true}
                />
              </span>
              {!validity[i] && (
                <span className="cashbook__field-error">
                  Numbers only — “{value}” would save as {formatInr(num(value))}.
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="cashbook__footer">
        <div className="cashbook__total">
          <span className="cashbook__total-label">Total</span>
          <span
            className={`cashbook__total-value cashbook__total-value--${pop}`}
          >
            <CountUp value={total} duration={420} format={formatInr} />
          </span>
        </div>
        <button
          type="button"
          className={
            "cashbook__save" +
            (saving ? " cashbook__save--busy" : "") +
            (blocked ? " cashbook__save--blocked" : "")
          }
          disabled={blocked}
          onClick={() =>
            onSave({
              upi: String(num(fields.upi)),
              cash: String(num(fields.cash)),
              cards: String(num(fields.cards)),
            })
          }
        >
          {cta}
        </button>
        <span className="cashbook__hint">
          Saving again for the same day replaces the entry — it does not add a
          second one.
        </span>
      </div>
    </Card>
  );
}

export default Cashbook;
