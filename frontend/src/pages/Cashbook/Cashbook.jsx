import { useEffect, useMemo, useRef, useState } from "react";
import PageShell from "../../components/PageShell/PageShell";
import Navbar from "../../components/Navbar/Navbar";
import {
    getCashbookByDate,
    getCashbookEntries,
    getCashbookEntriesAll,
    saveCashbookEntry,
} from "../../api/cashbook";
import { addDays, deriveWindow, listDays, monthBounds, rangeBounds } from "../../lib/cashbook";
import { formatDay, formatDate, formatInr, getToday, weekdayName } from "../../lib/format";
import DailyEntry from "./components/DailyEntry";
import QuickStatus from "./components/QuickStatus";
import DailyChart from "./components/DailyChart";
import MethodsDonut from "./components/MethodsDonut";
import RecentRecords from "./components/RecentRecords";
import SelectedDay from "./components/SelectedDay";
import "./Cashbook.css";

/*
 * The cashbook page.
 *
 * Same architecture as the dashboard: the page owns every piece of
 * state and makes every API call; the cards are presentational and
 * report actions back through the handlers below.
 *
 * Three independent fetch groups:
 *   range changes     -> the window's rows, every page (one fetch feeds
 *                        the chart, quick status, methods donut and the
 *                        recent-records table)
 *   selectedDate      -> the day's own row (404 -> null)
 *   viewed calendar month -> that month's entries (the calendar dots)
 */
function Cashbook() {
    const today = getToday();

    /* The chart's range: "7" | "14" | "30" | "custom". One state drives
       the window; the custom from/to only matter for "custom". */
    const [range, setRange] = useState("14");
    const [customFrom, setCustomFrom] = useState(() => addDays(getToday(), -29));
    const [customTo, setCustomTo] = useState(getToday());

    /* The window's rows, all pages merged. null = still loading; [] =
       an empty or invalid range. */
    const [windowRows, setWindowRows] = useState(null);

    /* The selected day: its row (null while loading / no entry). */
    const [selectedDate, setSelectedDate] = useState(today);
    const [entry, setEntry] = useState(null);

    /* The calendar dots follow the viewed month: the selected day's
       month, or whichever month the user browsed to inside the
       calendar. `browsedMonth` is set by the calendar and cleared
       again when a new day is picked elsewhere. */
    const [browsedMonth, setBrowsedMonth] = useState(null);
    const viewMonth = browsedMonth || selectedDate.slice(0, 7);
    const [monthDates, setMonthDates] = useState([]);
    const [monthZeroDates, setMonthZeroDates] = useState([]);

    /* Save state + the design's short-lived confirmation flash. */
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState("");

    /* The range window, re-fetched whenever the range moves. */
    useEffect(() => {
        let active = true;
        const bounds = rangeBounds(range, { from: customFrom, to: customTo }, today);

        if (!bounds.valid) {
            setWindowRows([]);
            return () => {
                active = false;
            };
        }

        getCashbookEntriesAll(bounds)
            .then((rows) => {
                if (active) {
                    setWindowRows(rows);
                }
            })
            .catch((error) => {
                console.error("Cashbook range failed:", error);
                if (active) {
                    setWindowRows([]);
                }
            });

        return () => {
            active = false;
        };
    }, [range, customFrom, customTo, today]);

    /*
     * The selected day -- the same pattern as the dashboard's cashbook
     * card. GET 404s on a day with no entry; the API layer turns that
     * into null. Blank first, so a day switch never briefly shows the
     * old day's numbers.
     */
    const selectedDateRef = useRef(selectedDate);
    useEffect(() => {
        selectedDateRef.current = selectedDate;

        let active = true;
        setEntry(null);
        // A day picked elsewhere owns the calendar's month again.
        setBrowsedMonth(null);

        getCashbookByDate(selectedDate)
            .then((row) => {
                if (active) {
                    setEntry(row);
                }
            })
            .catch((error) => {
                console.error("Cashbook entry failed:", error);
            });

        return () => {
            active = false;
        };
    }, [selectedDate]);

    /*
     * The calendar dots, for whichever month the calendar is showing.
     * A month has at most 31 entries -- one page always holds it, so
     * the single-page list call (the dashboard's pattern) is the
     * right one.
     */
    useEffect(() => {
        let active = true;
        setMonthDates([]);
        setMonthZeroDates([]);

        const { from, to } = monthBounds(viewMonth + "-01");

        getCashbookEntries({ dateFrom: from, dateTo: to })
            .then((data) => {
                if (!active) {
                    return;
                }
                setMonthDates(data.results.map((row) => row.date));
                setMonthZeroDates(
                    data.results
                        .filter((row) => Number(row.total) === 0)
                        .map((row) => row.date)
                );
            })
            .catch((error) => {
                console.error("Cashbook dates failed:", error);
            });

        return () => {
            active = false;
        };
    }, [viewMonth]);

    /* The design lets the flash expire on its own. */
    useEffect(() => {
        if (!flash) {
            return;
        }
        const timer = setTimeout(() => setFlash(""), 6000);
        return () => clearTimeout(timer);
    }, [flash]);

    /*
     * The one derivation (Option A): rows + range -> everything the
     * cards show. Per-day status, recorded/missing counts, range total
     * and the method split, computed here once; cards receive the
     * finished numbers as props.
     */
    const derived = useMemo(() => {
        if (windowRows === null) {
            return null;
        }

        const bounds = rangeBounds(range, { from: customFrom, to: customTo }, today);
        const days = bounds.valid ? listDays(bounds.from, bounds.to) : [];
        return { bounds, ...deriveWindow(days, windowRows) };
    }, [windowRows, range, customFrom, customTo, today]);

    /* The cards' actions arrive here; the cards never touch the API. */

    function handleDateChange(iso) {
        if (iso === selectedDate) {
            return;
        }
        setSelectedDate(iso);
        // The design drops the "Saving…" state when a new day is chosen.
        setSaving(false);
    }

    function handleSave(values) {
        if (saving) {
            return;
        }

        setSaving(true);
        const date = selectedDate;
        const existed = !!entry;

        // One PUT either way -- the backend is a create-or-replace upsert.
        saveCashbookEntry(date, values)
            .then((row) => {
                // If the user jumped to another day while this was in
                // flight, don't paint the stale day's row anywhere.
                if (date !== selectedDateRef.current) {
                    return;
                }

                setEntry(row);

                // The window and the calendar dots hold the same fact,
                // so update them in place -- no refetch.
                setWindowRows((current) =>
                    current
                        ? [row, ...current.filter((r) => r.date !== date)]
                        : current
                );
                if (date.slice(0, 7) === viewMonth) {
                    setMonthDates((current) =>
                        current.includes(date) ? current : [...current, date]
                    );
                    setMonthZeroDates((current) => {
                        const others = current.filter((d) => d !== date);
                        return Number(row.total) === 0 ? [...others, date] : others;
                    });
                }

                const total = Number(row.total);
                setFlash(
                    (existed ? "Updated " : "Recorded ") +
                        formatDate(date) +
                        " — " +
                        formatInr(total) +
                        (total === 0 ? ". Recorded as ₹0, not a gap." : ".")
                );
            })
            .catch((error) => {
                console.error("Could not save cashbook entry:", error);
            })
            .finally(() => {
                setSaving(false);
            });
    }

    /* "Last 14 days" / "25 Aug – 14 Sep" / "Pick a valid range" -- the
       range reading the methods card shows. */
    const rangeLabel =
        range === "custom"
            ? !derived || !derived.bounds.valid
                ? "Pick a valid range"
                : `${formatDay(derived.bounds.from)} – ${formatDay(derived.bounds.to)}`
            : `Last ${range} days`;

    const statusLabel =
        range === "custom"
            ? "collected in the selected range"
            : `collected over ${range} days`;

    return (
        <PageShell>
            <Navbar />

            <header className="cashbook__header">
                <div>
                    <h1 className="cashbook__title">Cashbook</h1>
                    <p className="cashbook__subtitle">
                        Record what the business collected on a day, review recent
                        daily collections, and correct past entries.
                    </p>
                </div>
                <span className="cashbook__today">
                    Today · {formatDate(today)} · {weekdayName(today)}
                </span>
            </header>

            {/* Card order follows the design mock: the two wide cards
                (entry, chart, records) span two of the three columns. */}
            <main className="cashbook__grid" aria-label="Cashbook">
                <DailyEntry
                    date={selectedDate}
                    entry={entry}
                    saving={saving}
                    savedDates={monthDates}
                    zeroDates={monthZeroDates}
                    viewMonth={viewMonth}
                    onViewMonthChange={setBrowsedMonth}
                    flash={flash}
                    onDateChange={handleDateChange}
                    onSave={handleSave}
                />

                {derived && (
                    <QuickStatus
                        recorded={derived.recordedCount}
                        missing={derived.missingCount}
                        total={derived.total}
                        label={statusLabel}
                        invalid={!derived.bounds.valid}
                    />
                )}

                {derived && (
                    <DailyChart
                        perDay={derived.perDay}
                        range={range}
                        customFrom={customFrom}
                        customTo={customTo}
                        today={today}
                        invalid={!derived.bounds.valid}
                        recordedCount={derived.recordedCount}
                        missingCount={derived.missingCount}
                        total={derived.total}
                        onRangeChange={setRange}
                        onCustomFrom={setCustomFrom}
                        onCustomTo={setCustomTo}
                        onDateChange={handleDateChange}
                    />
                )}

                {derived && (
                    <MethodsDonut
                        byMethod={derived.byMethod}
                        recordedCount={derived.recordedCount}
                        rangeLabel={rangeLabel}
                    />
                )}

                {derived && (
                    <RecentRecords
                        perDay={derived.perDay}
                        selectedDate={selectedDate}
                        recorded={derived.recordedCount}
                        missing={derived.missingCount}
                        onDateChange={handleDateChange}
                    />
                )}

                <SelectedDay date={selectedDate} entry={entry} />
            </main>
        </PageShell>
    );
}

export default Cashbook;
