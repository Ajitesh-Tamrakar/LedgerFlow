const API_BASE_URL = "http://127.0.0.1:8000/api";

let refreshPromise = null;

async function actuallyRefreshToken() {
    const response = await fetch(
        `${API_BASE_URL}/auth/token/refresh/`,
        {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        }
    );

    const data = await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
        throw new Error("Token refresh failed");
    }

    localStorage.setItem("access_token", data.access);

    return data.access;
}

export async function refreshAccessToken() {
    if (!refreshPromise) {
        refreshPromise = actuallyRefreshToken()
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}