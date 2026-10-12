import { apiRequest } from "./auth";

/*
 * Bills. The dashboard only needs the most recent few (the
 * Recent bills card takes the first 4 of the first page); the
 * Bills page will grow this file with its filters when we get
 * there.
 */

// Bills, newest first (paginated).
export async function getBills() {
    return apiRequest("/bills/");
}
