import { apiRequest } from "./auth";

/*
 * The dashboard's computed numbers, all period-based.
 * period is "week" | "month" | "quarter" -- the same value the
 * Collection trend buttons use, so one state drives both fetches.
 */

// The summary tray: in progress, net cash flow, purchasing activity,
// total outstanding, outstanding per dealer -- five cards, one request.
export async function getDashboardSummary(period) {
    return apiRequest(`/dashboard-summary/?period=${period}`);
}


// The bar chart series for the Collection trend card.
export async function getCollectionTrend(period) {
    return apiRequest(`/collection-trend/?period=${period}`);
}
