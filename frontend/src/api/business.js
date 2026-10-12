import { apiRequest } from "./auth";

/*
 * Business. A singleton: GET/PATCH /business/, no id in the path --
 * the backend resolves the row from the signed-in user. The only
 * writable field is the name; created_at/updated_at are server-side.
 */

// The caller's own business: {id, name, created_at, updated_at}.
export async function getBusiness() {
    return apiRequest("/business/");
}

// Rename the business. The API re-reads the row after saving, so the
// 200 receipt carries the stored name.
export async function updateBusinessName(name) {
    return apiRequest("/business/", {
        method: "PATCH",
        body: JSON.stringify({ name }),
    });
}
