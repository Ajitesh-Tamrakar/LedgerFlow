import { apiRequest, API_BASE_URL } from "./auth";

/*
 * Dealers. The page needs the WHOLE list: search, tab counts, sorts and
 * screen paging all happen in the browser (the design does the same), so
 * the one fetch follows `next` until it is null and hands back the merged
 * rows. Money comes back as 2-decimal strings; outstanding_balance is
 * computed server-side (opening + all bills - all payments).
 *
 * Dealers are never deleted: PUT and DELETE are off on the backend, so
 * the only writes here are create and correct (PATCH).
 */

// Every dealer, every page merged into one array.
export async function getDealersAll() {
    // `next` is an absolute URL; apiRequest expects a path off its base,
    // so hand it back the part after the base.
    let endpoint = "/dealers/";

    const rows = [];

    while (endpoint) {
        const data = await apiRequest(endpoint);
        rows.push(...data.results);
        endpoint = data.next ? data.next.slice(API_BASE_URL.length) : "";
    }

    return rows;
}

// The dealer's editable fields, shaped the way the page's forms hold
// them (gstin is the trimmed/uppercased text, openingBalance a number).
// Maps them onto the API's field names: a blank GSTIN goes up as null
// ("not on file" -- the model stores null, not an empty string).
function dealerPayload({ name, gstin, openingBalance, isActive }) {
    return JSON.stringify({
        name,
        gstin: gstin || null,
        opening_balance: openingBalance,
        is_active: isActive,
    });
}

// Add a dealer. The API re-reads the row after saving, so the 201
// receipt already carries outstanding_balance -- for a new dealer that
// is just its opening balance, having no bills or payments yet.
export async function createDealer(fields) {
    return apiRequest("/dealers/", {
        method: "POST",
        body: dealerPayload(fields),
    });
}

// Correct an existing dealer (the only update the UI does). The API
// re-reads the row after saving, so the 200 receipt carries the
// RECOMPUTED outstanding_balance after the opening balance moves.
export async function updateDealer(id, fields) {
    return apiRequest(`/dealers/${id}/`, {
        method: "PATCH",
        body: dealerPayload(fields),
    });
}
