import { useEffect, useRef, useState } from "react";
import Card from "../../../components/Card/Card";
import CountUp from "../../../components/CountUp/CountUp";
import DateField from "../../../components/DateField/DateField";
import { formatDay, formatInr, getToday, weekdayName } from "../../../lib/format";
import "./DailyEntry.css";

/*
 * "Daily entry" -- the wide card with the day form. The design's entry
 * section, adapted from the dashboard's cashbook card (same fields, same
 * number rules) with the two-state calendar, Record ₹0 and the flash.
 *
 * Like its dashboard twin, the card holds the field *text* (draft state)
 * and reports onDateChange / onSave up; the page does the fetching.
 * "Record ₹0" is a local zero-fill, not a save -- the design makes the
 * user confirm it with the Save button, so a mistap can't blank a day.
 */
const FIELDS = [
  { key: "upi", label: "UPI" },
  { key: "cash", label: "Cash" },
  { key: "cards", label: "Card" },
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

// The entry's four states; the pill and the CTA both read from it.
// "saving" keeps the underlying stored/blank style (the design does too).
function stateOf({ entry, dirty, saving }) {
  if (saving) return "saving";
  if (!entry) return "blank";
  return dirty ? "editing" : Number(entry.total) === 0 ? "zero" : "recorded";
}

function DailyEntry({
  date,
  entry,
  saving,
  savedDates = [],
  zeroDates = [],
  // The page owns the viewed month: it fetches that month's entries
  // for the dots, and the calendar reports its navigation back up.
  viewMonth = null,
  onViewMonthChange,
  flash = "",
  onDateChange,
  onSave,
}) {
  const [fields, setFields] = useState(() => fromEntry(entry));

  // The page hands a fresh row (or a 404 blank) whenever the selected
  // day changes or a save lands -- re-sync the fields each time.
  useEffect(() => {
    setFields(fromEntry(entry));
  }, [entry, date]);

  const today = getToday();
  const isToday = date === today;

  const stored = !!entry;
  const zeroDay = stored && Number(entry.total) === 0;
  const validity = FIELDS.map((field) => isClean(fields[field.key]));
  const anyBad = validity.some((ok) => !ok);
  const allEmpty = FIELDS.every(
    (field) => String(fields[field.key] ?? "").trim() === ""
  );
  const dirty = FIELDS.some(
    (field) => num(fields[field.key]) !== Number(entry ? entry[field.key] : 0)
  );

  const state = stateOf({ entry, dirty, saving });

  const total = FIELDS.reduce((sum, field) => sum + num(fields[field.key]), 0);
  const showTotal = stored && !dirty ? Number(entry.total) : total;

  // While the selected day has unsaved edits, hide its saved dot -- the
  // design clears a day's saved flag the moment a field is edited.
  const dots = dirty ? savedDates.filter((d) => d !== date) : savedDates;
  const zeroDots = dirty ? zeroDates.filter((d) => d !== date) : zeroDates;

  // The design re-fires a small rise on the total every time it changes
  // (it moves with every keystroke) -- same A/B keyframe alternation.
  const [pop, setPop] = useState("a");
  const lastTotal = useRef(showTotal);

  useEffect(() => {
    if (lastTotal.current !== showTotal) {
      lastTotal.current = showTotal;
      setPop((current) => (current === "a" ? "b" : "a"));
    }
  }, [showTotal]);

  const cta = saving
    ? "Saving…"
    : stored
      ? dirty
        ? "Save changes"
        : "Saved"
      : isToday
        ? "Save today’s entry"
        : "Save entry";

  const blocked = saving || anyBad || allEmpty || (stored && !dirty);

  const hint = stored
    ? dirty
      ? `You are editing the entry already saved for ${formatDay(date)}. Saving replaces it — no duplicate row is created.`
      : zeroDay
        ? "This day is already saved as a deliberate ₹0 collection."
        : "This day is already saved. Change any amount to enable Save changes."
    : allEmpty
      ? `Nothing on file for ${formatDay(date)} — the fields are blank, not zero. Use Record ₹0 if the shop collected nothing.`
      : `New entry for ${formatDay(date)}. One entry per date.`;

  return (
    <Card className="daily-entry card--wide">
      <div className="daily-entry__header">
        <div className="daily-entry__header-left">
          <h2 className="daily-entry__title">Daily entry</h2>
          <span className={`daily-entry__state daily-entry__state--${state}`}>
            {state === "saving"
              ? "Saving…"
              : state === "editing"
                ? "Editing saved entry"
                : state === "zero"
                  ? "Recorded as ₹0"
                  : state === "recorded"
                    ? "Recorded"
                    : "Not recorded"}
          </span>
        </div>
        <div className="daily-entry__header-tools">
          {!isToday && (
            <button
              type="button"
              className="daily-entry__back-today"
              onClick={() => onDateChange(today)}
            >
              Back to today
            </button>
          )}
          <DateField
            value={date}
            onChange={onDateChange}
            savedDates={dots}
            zeroDates={zeroDots}
            viewMonth={viewMonth}
            onViewMonthChange={onViewMonthChange}
            triggerLabel={(iso) => `${formatDay(iso)} · ${weekdayName(iso)}`}
          />
        </div>
      </div>

      <div className="daily-entry__fields">
        {FIELDS.map(({ key, label }, i) => {
          const value = fields[key];

          return (
            <label className="daily-entry__field" key={key}>
              <span className="daily-entry__field-label">{label}</span>
              <span
                className={
                  "daily-entry__field-box" +
                  (validity[i] ? "" : " daily-entry__field-box--invalid")
                }
              >
                <span className="daily-entry__field-symbol" aria-hidden="true">
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
                  aria-describedby={
                    validity[i] ? undefined : `daily-entry-err-${key}`
                  }
                  aria-label={`${label} collected on ${formatDay(date)}`}
                />
              </span>
              {!validity[i] && (
                <span
                  className="daily-entry__field-error"
                  id={`daily-entry-err-${key}`}
                >
                  Numbers only — “{value}” would save as {formatInr(num(value))}.
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="daily-entry__footer">
        <div className="daily-entry__total">
          <span className="daily-entry__total-label">
            {stored && !dirty ? "Day total · saved" : "Day total · preview"}
          </span>
          <span
            className={`daily-entry__total-value daily-entry__total-value--${pop}`}
          >
            {!stored && allEmpty ? (
              "—"
            ) : (
              <CountUp value={showTotal} duration={420} format={formatInr} />
            )}
          </span>
        </div>
        <button
          type="button"
          className={
            "daily-entry__save" +
            (saving ? " daily-entry__save--busy" : "") +
            (blocked ? " daily-entry__save--blocked" : "")
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
        <button
          type="button"
          className="daily-entry__zero"
          onClick={() => setFields({ upi: "0", cash: "0", cards: "0" })}
        >
          Record ₹0
        </button>
      </div>

      <p className="daily-entry__hint">{hint}</p>

      {flash && (
        <div className="daily-entry__flash" role="status">
          <span aria-hidden="true" />
          {flash}
        </div>
      )}
    </Card>
  );
}

export default DailyEntry;
