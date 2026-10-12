import { useEffect, useMemo, useState } from "react";
import "./DateField.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function getToday() {
  const date = new Date();

  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

function shiftMonth(ym, amount) {
  const [year, month] = ym.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1 + amount, 1)
  );

  return (
    date.getUTCFullYear() +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0")
  );
}

function formatDate(iso) {
  if (!iso) return "";

  const [year, month, day] = iso.split("-");

  return (
    Number(day) +
    " " +
    MONTHS[Number(month) - 1] +
    (year === getToday().slice(0, 4) ? "" : " " + year)
  );
}

function DateField({
  label = "Date",
  value,
  onChange,
  savedDates = [],
  // Days saved as a deliberate ₹0 (hollow dot). `null` = caller doesn't
  // track zero-days (the dashboard), in which case the footer keeps its
  // single "Entry saved" legend line.
  zeroDates = null,
  // How the trigger renders the value (the cashbook page shows
  // "14 Sep · Wed"); defaults to the full "14 Sep 2026" reading.
  triggerLabel = null,
  // Which month the calendar should show. When the caller supplies it,
  // the calendar reports navigation back via onViewMonthChange, so the
  // caller can fetch that month's entries for the dots.
  viewMonth: viewMonthProp = null,
  onViewMonthChange,
  maxDate,
}) {
  const today = maxDate || getToday();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState("days");
  const [viewMonth, setViewMonth] = useState(
    value ? value.slice(0, 7) : today.slice(0, 7)
  );

  // Controlled month: follow the caller when it changes (a new day was
  // picked elsewhere), without fighting the user's in-calendar navigation.
  useEffect(() => {
    if (viewMonthProp && viewMonthProp !== viewMonth) {
      setViewMonth(viewMonthProp);
    }
  }, [viewMonthProp]); // eslint-disable-line react-hooks/exhaustive-deps

  function goMonth(ym) {
    setViewMonth(ym);
    onViewMonthChange?.(ym);
  }

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        event.target.closest &&
        event.target.closest("[data-date-field]")
      ) {
        return;
      }

      setOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selectedDate = value || "";

  const savedSet = useMemo(
    () => new Set(savedDates),
    [savedDates]
  );

  const zeroSet = useMemo(
    () => (zeroDates ? new Set(zeroDates) : null),
    [zeroDates]
  );

  const calendar = useMemo(() => {
    const [year, month] = viewMonth.split("-").map(Number);

    const firstDay = new Date(
      Date.UTC(year, month - 1, 1)
    ).getUTCDay();

    // Original design starts the week on Monday.
    const firstMondayIndex = (firstDay + 6) % 7;

    const daysInMonth = new Date(
      Date.UTC(year, month, 0)
    ).getUTCDate();

    const cells = [];

    for (let i = 0; i < firstMondayIndex; i++) {
      cells.push({
        empty: true,
        id: `empty-${i}`,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso =
        year +
        "-" +
        String(month).padStart(2, "0") +
        "-" +
        String(day).padStart(2, "0");

      const selected = iso === selectedDate;
      const isToday = iso === today;
      const future = iso > today;
      const saved = savedSet.has(iso);
      const zero = zeroSet ? zeroSet.has(iso) : false;

      cells.push({
        iso,
        day,
        selected,
        isToday,
        future,
        saved,
        zero,
      });
    }

    return cells;
  }, [viewMonth, selectedDate, today, savedSet, zeroSet]);

  const [year, month] = viewMonth.split("-").map(Number);

  const monthView = view === "months";

  const atToday =
    monthView
      ? year >= Number(today.slice(0, 4))
      : viewMonth >= today.slice(0, 7);

  function selectDate(iso) {
    if (iso > today) return;

    onChange(iso);
    setOpen(false);
  }

  function selectMonth(monthIndex) {
    const iso =
      year +
      "-" +
      String(monthIndex + 1).padStart(2, "0");

    if (iso > today.slice(0, 7)) return;

    goMonth(iso);
    setView("days");
  }

  function goToday() {
    onChange(today);
    setViewMonth(today.slice(0, 7));
    setView("days");
    setOpen(false);
  }

  return (
    <div className="date-field">
      {label && (
        <label className="date-field__label">
          {label}
        </label>
      )}

      <div className="date-field__calendar-root" data-date-field>
        <button
          type="button"
          className={`date-field__trigger ${
            open ? "date-field__trigger--open" : ""
          }`}
          onClick={() => {
            setOpen((current) => !current);
            setView("days");
            goMonth(value ? value.slice(0, 7) : today.slice(0, 7));
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="date-field__trigger-label">
            {label}
          </span>

          <span className="date-field__trigger-value">
            {triggerLabel ? triggerLabel(value) : formatDate(value)}
          </span>

          <span
            className={`date-field__caret ${
              open ? "date-field__caret--open" : ""
            }`}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {open && (
          <div
            className="date-field__calendar"
            role="dialog"
            aria-label="Choose date"
          >
            <div className="date-field__calendar-header">
              <button
                type="button"
                className="date-field__nav"
                onClick={() =>
                  goMonth(
                    shiftMonth(
                      viewMonth,
                      monthView ? -12 : -1
                    )
                  )
                }
                aria-label={
                  monthView
                    ? "Previous year"
                    : "Previous month"
                }
              >
                ‹
              </button>

              <button
                type="button"
                className={`date-field__month-button ${
                  monthView
                    ? "date-field__month-button--active"
                    : ""
                }`}
                onClick={() =>
                  setView((current) =>
                    current === "months"
                      ? "days"
                      : "months"
                  )
                }
              >
                {monthView
                  ? String(year)
                  : `${MONTHS[month - 1]} ${year}`}

                <span
                  className={`date-field__month-caret ${
                    monthView
                      ? "date-field__month-caret--open"
                      : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              <button
                type="button"
                className="date-field__nav"
                disabled={atToday}
                onClick={() => {
                  if (!atToday) {
                    goMonth(
                      shiftMonth(
                        viewMonth,
                        monthView ? 12 : 1
                      )
                    );
                  }
                }}
                aria-label={
                  monthView
                    ? "Next year"
                    : "Next month"
                }
              >
                ›
              </button>
            </div>

            {monthView ? (
              <div className="date-field__months">
                {MONTHS.map((name, index) => {
                  const monthIso =
                    year +
                    "-" +
                    String(index + 1).padStart(2, "0");

                  const future =
                    monthIso > today.slice(0, 7);

                  const selected =
                    monthIso ===
                    selectedDate.slice(0, 7);

                  const isCurrent =
                    monthIso === today.slice(0, 7);

                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={future}
                      className={`date-field__month-cell ${
                        selected
                          ? "date-field__month-cell--selected"
                          : ""
                      } ${
                        isCurrent
                          ? "date-field__month-cell--today"
                          : ""
                      }`}
                      onClick={() =>
                        selectMonth(index)
                      }
                    >
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="date-field__weekdays">
                  {WEEKDAYS.map((day, index) => (
                    <span key={index}>{day}</span>
                  ))}
                </div>

                <div className="date-field__days">
                  {calendar.map((cell) => {
                    if (cell.empty) {
                      return (
                        <span
                          key={cell.id}
                          className="date-field__empty"
                        />
                      );
                    }

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={cell.future}
                        aria-current={
                          cell.isToday
                            ? "date"
                            : undefined
                        }
                        className={`date-field__day ${
                          cell.selected
                            ? "date-field__day--selected"
                            : ""
                        } ${
                          cell.isToday
                            ? "date-field__day--today"
                            : ""
                        } ${
                          cell.future
                            ? "date-field__day--future"
                            : ""
                        }`}
                        onClick={() =>
                          selectDate(cell.iso)
                        }
                      >
                        <span>{cell.day}</span>

                        <span
                          className={`date-field__dot ${
                            cell.saved
                              ? "date-field__dot--saved"
                              : ""
                          } ${
                            cell.zero
                              ? "date-field__dot--zero"
                              : ""
                          } ${
                            cell.selected
                              ? "date-field__dot--selected"
                              : ""
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="date-field__footer">
              {zeroDates ? (
                <span className="date-field__legend">
                  <span className="date-field__legend-row">
                    <span className="date-field__dot date-field__dot--saved" />
                    Recorded
                  </span>
                  <span className="date-field__legend-row">
                    <span className="date-field__dot date-field__dot--zero" />
                    Recorded as ₹0
                  </span>
                </span>
              ) : (
                <span className="date-field__saved-label">
                  <span className="date-field__saved-dot" />
                  Entry saved
                </span>
              )}

              <button
                type="button"
                className="date-field__today"
                onClick={goToday}
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DateField;
