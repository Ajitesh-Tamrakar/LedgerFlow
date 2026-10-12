import { apiRequest } from "./auth";

/*
 * Cashbook entries are addressed by date (one row per day, per the
 * unique constraint), so the endpoints take a date, not an id.
 */

// The entry for one day. The API answers 404 when a day has no
// entry, and "no entry" is a normal state here (the form just
// shows empty fields) -- so translate that one case to null.
export async function getCashbookByDate(date) {
    try {
        return await apiRequest(`/cashbook/by-date/${date}/`);
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        throw error;
    }
}


// Create or replace the entry for one day (PUT, like the backend:
// saving again for the same day replaces, never adds a second row).
export async function saveCashbookEntry(date, { upi, cash, cards }) {
    return apiRequest(`/cashbook/by-date/${date}/`, {
        method: "PUT",
        body: JSON.stringify({ upi, cash, cards }),
    });
}


// Entries as a paginated list. Pass a month's bounds to fetch just
// that month -- the dashboard uses it for the calendar's saved-date
// dots (a month has at most 31 entries, one page always holds it).
export async function getCashbookEntries({ dateFrom, dateTo } = {}) {
    const params = new URLSearchParams();

    if (dateFrom) {
        params.set("date_from", dateFrom);
    }

    if (dateTo) {
        params.set("date_to", dateTo);
    }

    const query = params.toString();

    return apiRequest(`/cashbook/${query ? `?${query}` : ""}`);
}
