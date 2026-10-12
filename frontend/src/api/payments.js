import { apiRequest, API_BASE_URL } from "./auth";

/*
 * Payments. The page needs the WHOLE list: the month tile, the donut
 * breakdown, the dealer filter, the sorts and the paging all happen in
 * the browser (the design does the same), so the one fetch follows
 * `next` until it is null and hands back the merged rows -- the dealers
 * pattern. Money comes back as 2-decimal strings.
 *
 * Payments are never deleted: PUT and DELETE are off on the backend, so
 * the only writes here are create and correct (PATCH), and both receipts
 * carry the complete row (id, dealer_name, timestamps), which the page
 * swaps into the list in place -- no refetch.
 *
 * getPaymentMethods feeds BOTH the filter's chips and the panel's pills
 * from one call; it returns {value, label} pairs, no envelope.
 */

// Every payment, every page merged into one array (newest date first,
// the backend's default order).
export async function getPaymentsAll() {
    // `next` is an absolute URL; apiRequest expects a path off its base,
    // so hand it back the part after the base.
    let endpoint = "/payments/";

    const rows = [];

    while (endpoint) {
        const data = await apiRequest(endpoint);
        rows.push(...data.results);
        endpoint = data.next ? data.next.slice(API_BASE_URL.length) : "";
    }

    return rows;
}

// The payment-method choices: {value, label} pairs straight from the
// backend, in its order (Cash, UPI, Card, Cheque, Bank transfer).
export async function getPaymentMethods() {
    return apiRequest("/payments/methods/");
}

// Add a payment. All four fields travel; business never does (the
// kitchen injects it from the logged-in user). Resolves the 201
// receipt -- the complete row as saved. A rejected write throws
// {status: 400, data: {field: [message, ...]}}; "No such dealer."
// (a dealer from another business) rides in data.dealer.
export async function createPayment({ dealer, date, amount, method }) {
    return apiRequest("/payments/", {
        method: "POST",
        body: JSON.stringify({ dealer, date, amount, method }),
    });
}

// Correct an existing payment (the only update the UI does): any subset
// of dealer / date / amount / method, the rest untouched. Resolves the
// 200 receipt -- the row as saved, dealer_name refreshed if the dealer
// moved. A payment that isn't yours throws {status: 404}.
export async function updatePayment(id, { dealer, date, amount, method }) {
    return apiRequest(`/payments/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ dealer, date, amount, method }),
    });
}
