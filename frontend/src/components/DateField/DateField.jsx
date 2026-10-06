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
  maxDate,
}) {
  const today = maxDate || getToday();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState("days");
  const [viewMonth, setViewMonth] = useState(
    value ? value.slice(0, 7) : today.slice(0, 7)
  );

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

      cells.push({
        iso,
        day,
        selected,
        isToday,
        future,
        saved,
      });
    }

    return cells;
  }, [viewMonth, selectedDate, today, savedSet]);

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

    setViewMonth(iso);
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
            setViewMonth(
              value ? value.slice(0, 7) : today.slice(0, 7)
            );
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="date-field__trigger-label">
            {label}
          </span>

          <span className="date-field__trigger-value">
            {formatDate(value)}
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
                  setViewMonth(
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
                    setViewMonth(
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
              <span className="date-field__saved-label">
                <span className="date-field__saved-dot" />
                Entry saved
              </span>

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
