import { apiRequest, API_BASE_URL } from "./auth";

/*
 * Bills. Two readers, one family of writers:
 *
 * The dashboard reads one page (getBills, for its Recent bills card);
 * the Bills page reads the WHOLE list and does its dealer filter, date
 * range, sorts and paging in the browser over it -- the design does the
 * same -- so getBillsAll follows `next` until it is null, the dealers
 * pattern.
 *
 * The money on the page's headline and breakdown cards never comes from
 * those rows: the design says "own endpoint, never summed from the
 * list", so getBillPurchases asks for it computed.
 *
 * The writes are multipart because a bill carries its file. A PDF you
 * already have goes up as `image`; photo pages go up as repeated
 * `images` parts and the server compiles them into one PDF. The dealer,
 * date and amount ride along as ordinary form fields. There is no
 * DELETE on a bill (PUT and DELETE are off in the kitchen):
 * corrections go through updateBill, a new file through replaceBillFile.
 */

// Bills, newest first, one API page (the dashboard's Recent bills card).
export async function getBills() {
    return apiRequest("/bills/");
}

// Every bill, every API page merged into one array.
export async function getBillsAll() {
    // `next` is an absolute URL; apiRequest expects a path off its base,
    // so hand it back the part after the base.
    let endpoint = "/bills/";

    const rows = [];

    while (endpoint) {
        const data = await apiRequest(endpoint);
        endpoint = data.next ? data.next.slice(API_BASE_URL.length) : "";
        rows.push(...data.results);
    }

    return rows;
}

// The purchases summary the page's headline and breakdown cards read:
// the period's total, its bill count, and the per-dealer split (biggest
// first), all computed server-side. period is "week" | "month" |
// "quarter" -- the page passes "month".
export async function getBillPurchases(period = "month") {
    return apiRequest(`/bills/purchases/?period=${period}`);
}

// The file source, shaped the way the upload card holds it: either one
// PDF (`file`) or the arranged photo pages (`files`), never both -- the
// server rejects both, and the card makes it unselectable. The metadata
// rides along as plain form fields; FormData stringifies the number.
function billForm({ file, files, dealer, date, amount }) {
    const form = new FormData();

    if (file) {
        form.append("image", file);
    }

    if (files) {
        for (const page of files) {
            form.append("images", page);
        }
    }

    if (dealer !== null && dealer !== undefined) {
        form.append("dealer", dealer);
    }

    if (date) {
        form.append("date", date);
    }

    if (amount !== null && amount !== undefined && amount !== "") {
        form.append("amount", amount);
    }

    return form;
}

// Add a bill: the file source plus the details, in one multipart
// request. Resolves the 201 receipt (it carries file_url, file_size,
// pages -- the page swaps it into the list in place).
export async function createBill({ file, files, dealer, date, amount }) {
    return apiRequest("/bills/", {
        method: "POST",
        body: billForm({ file, files, dealer, date, amount }),
    });
}

// Correct an existing bill: dealer / date / amount, as JSON -- no file
// travels, so no multipart. The 200 receipt carries the row as saved.
export async function updateBill(id, { dealer, date, amount }) {
    return apiRequest(`/bills/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ dealer, date, amount }),
    });
}

// Replace a bill's file: the upload flow run again, at the bill's own
// address. The seeded details ride along unchanged (a no-op), and a
// correction made in the card saves too.
export async function replaceBillFile(id, { file, files, dealer, date, amount }) {
    return apiRequest(`/bills/${id}/`, {
        method: "PATCH",
        body: billForm({ file, files, dealer, date, amount }),
    });
}

// The bill's PDF as a blob. The file endpoint demands the bearer token,
// which an <iframe src> can't carry -- so the page fetches it with the
// token and hands the viewer an object URL. `raw: true` skips the JSON
// read (it would consume the stream) but keeps the token + one silent
// refresh-retry; with ?download=1 the server names the file instead.
export async function getBillFile(id, download = false) {
    const endpoint = download ? `/bills/${id}/file/?download=1` : `/bills/${id}/file/`;
    const response = await apiRequest(endpoint, { raw: true });

    if (!response.ok) {
        throw { status: response.status };
    }

    return response.blob();
}
