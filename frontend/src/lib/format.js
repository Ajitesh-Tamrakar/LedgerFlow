/*
 * Currency formatting, shared by the dashboard cards.
 *
 * Mirrors the design mock: Indian digit grouping (12,34,568),
 * a typographic minus for negatives, rounded to whole rupees.
 * Accepts the strings the API returns for Decimal fields,
 * so cards can pass API values straight in.
 */
export function formatInr(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "₹0";
    }

    const negative = number < 0;
    const digits = Math.round(Math.abs(number)).toString();
    const last = digits.slice(-3);
    let rest = digits.slice(0, -3);

    if (rest) {
        rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    }

    return (negative ? "−" : "") + "₹" + (rest ? rest + "," + last : last);
}

/*
 * Percent with an explicit sign, e.g. 25 -> "+25.0%", -12.34 -> "−12.3%".
 * The design uses a typographic minus, and the API sends null when there
 * is no baseline to compare against -- that reads as "—".
 */
const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/*
 * Today in the app's ISO day format ("2026-10-10"), from the local
 * calendar -- the same day Django reports with timezone.localdate().
 */
export function getToday() {
    const now = new Date();
    return (
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0")
    );
}

/*
 * An API date string ("2026-09-12") to the design's reading
 * ("12 Sep 2026"). Non-ISO input is passed through untouched,
 * so a wrong shape is visible instead of silently mangled.
 */
export function formatDate(iso) {
    const parts = String(iso || "").split("-");

    if (parts.length !== 3 || parts.some((part) => !/^[0-9]+$/.test(part))) {
        return String(iso || "");
    }

    const [year, month, day] = parts;
    return `${Number(day)} ${MONTHS[Number(month) - 1] || month} ${year}`;
}

/*
 * The design's short day form: "2026-09-14" -> "14 Sep", with the year
 * only when it differs from the current one ("14 Sep 2025").
 */
export function formatDay(iso) {
    const parts = String(iso || "").split("-");

    if (parts.length !== 3 || parts.some((part) => !/^[0-9]+$/.test(part))) {
        return String(iso || "");
    }

    const [year, month, day] = parts;
    const thisYear = String(new Date().getFullYear());

    return `${Number(day)} ${MONTHS[Number(month) - 1] || month}${
        year === thisYear ? "" : " " + year
    }`;
}

export function formatPercent(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "—";
    }

    const sign = value >= 0 ? "+" : "−";
    return sign + Math.abs(value).toFixed(1) + "%";
}
