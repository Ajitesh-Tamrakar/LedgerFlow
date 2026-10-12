/*
 * Pure date / window math for the cashbook page.
 *
 * No DOM, no React, no API -- the page composes these into the single
 * derived window the cards render, and the same file can be imported
 * from a plain node script to check the numbers.
 *
 * ISO dates ("2026-10-12") compare lexicographically, which is
 * chronological order for this format -- so comparisons are plain
 * string compares; Date objects appear only for calendar arithmetic.
 */

// The design caps the chart window at 120 days; a longer custom range
// is clipped at its newest end rather than stretched.
export const MAX_WINDOW_DAYS = 120;

function toIso(y, m, d) {
    return (
        y +
        "-" +
        String(m).padStart(2, "0") +
        "-" +
        String(d).padStart(2, "0")
    );
}

function utc(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

// "2026-10-12" shifted by n days (negative = earlier).
export function addDays(iso, n) {
    const d = utc(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/*
 * The chart's window, from the range toggle.
 *   "7" / "14" / "30" -> the last n days, always ending today (a rolling
 *                        window -- it moves forward one day a day)
 *   "custom"          -> from..to, with `to` clipped at today (the chart
 *                        never shows days that have not happened) and
 *                        `from` clipped so the window stays <= 120 days.
 * `valid` is false when a custom from ends up after the clipped to.
 */
export function rangeBounds(range, { from = "", to = "" }, today) {
    if (range === "custom") {
        const end = to && to <= today ? to : today;
        const valid = !!from && from <= end;
        const oldest = addDays(end, -(MAX_WINDOW_DAYS - 1));
        const start = valid ? (from >= oldest ? from : oldest) : end;
        return { from: start, to: end, valid };
    }

    const n = Number(range);
    const days = Number.isFinite(n) && n > 0 ? Math.floor(n) : 14;
    return { from: addDays(today, -(days - 1)), to: today, valid: true };
}

// Every ISO date in [from, to], inclusive. Nonsense spans yield []
// rather than looping -- and the loop can never run past the cap.
export function listDays(from, to) {
    const days = [];
    if (!from || !to || from > to) {
        return days;
    }

    for (let cur = from; cur <= to && days.length < MAX_WINDOW_DAYS + 1; cur = addDays(cur, 1)) {
        days.push(cur);
    }

    return days;
}

// First and last day of the month `iso` sits in -- the calendar-dot
// window. A month has at most 31 entries, one API page always holds it.
export function monthBounds(iso) {
    const [y, m] = iso.slice(0, 7).split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: toIso(y, m, 1), to: toIso(y, m, lastDay) };
}

/*
 * The one derivation the page runs when the window's rows land (Option A:
 * the page computes, the cards receive finished numbers as props).
 *
 * `days` is the full window, gaps included; `entries` the API rows.
 * Every day gets a status:
 *   "recorded" -- row exists and something was collected
 *   "zero"     -- row exists, all three methods 0 (a deliberate ₹0 day)
 *   "missing"  -- no row at all (a gap, not a ₹0 collection)
 *
 * The method split sums every row that exists: a zero row adds nothing,
 * so "recorded days only" and "rows that exist" give the same numbers --
 * and missing days are genuinely excluded, as the design's note requires.
 */
export function deriveWindow(days, entries) {
    const rowsByDate = new Map(entries.map((row) => [row.date, row]));

    const perDay = days.map((date) => {
        const row = rowsByDate.get(date);

        if (!row) {
            return { date, status: "missing", upi: 0, cash: 0, cards: 0, total: 0 };
        }

        const upi = Number(row.upi);
        const cash = Number(row.cash);
        const cards = Number(row.cards);
        const total = upi + cash + cards;

        return {
            date,
            status: total === 0 ? "zero" : "recorded",
            upi,
            cash,
            cards,
            total,
        };
    });

    const withRows = perDay.filter((d) => d.status !== "missing");
    const byMethod = withRows.reduce(
        (sum, d) => ({
            upi: sum.upi + d.upi,
            cash: sum.cash + d.cash,
            cards: sum.cards + d.cards,
        }),
        { upi: 0, cash: 0, cards: 0 }
    );
    const total = withRows.reduce((sum, d) => sum + d.total, 0);

    return {
        perDay,
        // Days that have a row (recorded or deliberate-₹0) -- the design's
        // "recorded" stat counts both; "missing" is the rest of the window.
        recordedCount: withRows.length,
        missingCount: perDay.length - withRows.length,
        total,
        byMethod: { ...byMethod, sum: total },
    };
}
