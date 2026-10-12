/*
 * The first human-readable message from an apiRequest rejection.
 *
 * DRF answers a 400 with either a plain string or a
 * { field: message | [messages] } mapping, and a nested
 * { field: [{ ... "message": ... }] } shape for multi-part uploads.
 * This finds the first message either way, so a card can show the
 * server's own wording instead of guessing it. Returns "" when the
 * payload carries none.
 */
export function firstMessage(error) {
    const data = error && error.data;

    if (!data) {
        return "";
    }

    if (typeof data === "string") {
        return data;
    }

    for (const value of Object.values(data)) {
        if (typeof value === "string") {
            return value;
        }

        if (Array.isArray(value) && value.length > 0) {
            const first = value[0];

            if (typeof first === "string") {
                return first;
            }

            if (first && typeof first === "object") {
                for (const inner of Object.values(first)) {
                    if (typeof inner === "string") {
                        return inner;
                    }
                }
            }
        }
    }

    return "";
}
