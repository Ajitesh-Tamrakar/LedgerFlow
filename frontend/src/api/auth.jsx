import { refreshAccessToken } from "./tokenRefresh";

export const API_BASE_URL = "http://127.0.0.1:8000/api";


export async function apiRequest(endpoint, options = {}, retry = true) {
    const accessToken = localStorage.getItem("access_token");

    // A FormData body is a multipart upload: the BROWSER must set the
    // Content-Type itself, because it only knows the boundary string.
    // Stamping "application/json" on one would break the parse, so the
    // JSON header is omitted for FormData bodies only -- every existing
    // JSON caller is byte-identical to before.
    const isFormData =
        typeof FormData !== "undefined" &&
        options.body instanceof FormData;

    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            ...options,

            // let the browser send/store the HttpOnly refresh cookie
            // (login sets it; the refresh flow depends on it)
            credentials: "include",

            headers: {
                ...(isFormData
                    ? {}
                    : {
                        "Content-Type": "application/json",
                    }),

                ...(accessToken
                    ? {
                        Authorization: `Bearer ${accessToken}`,
                    }
                    : {}),

                ...(options.headers || {}),
            },
        }
    );

    // `raw: true` hands back the Response itself instead of the parsed JSON
    // (the bill PDF viewer needs the bytes). It skips the .json() read --
    // reading the body would consume the stream -- and everything below
    // (the token refresh-retry) runs unchanged.
    const data = options.raw
        ? {}
        : await response
            .json()
            .catch(() => ({}));


    // Access token expired
    if (response.status === 401 && retry) {
        try {
            await refreshAccessToken();

            // Retry original request with new access token
            return apiRequest(
                endpoint,
                options,
                false
            );

        } catch (error) {
            localStorage.removeItem("access_token");

            window.location.href = "/login";

            throw error;
        }
    }


    if (options.raw) {
        return response;
    }

    if (!response.ok) {
        throw {
            status: response.status,
            data,
        };
    }

    return data;
}


export async function registerUser({
    email,
    password1,
    password2,
    business_name,
}) {
    return apiRequest(
        "/auth/registration/",
        {
            method: "POST",

            body: JSON.stringify({
                email,
                password1,
                password2,
                business_name,
            }),
        }
    );
}


export async function verifyEmailOtp({
    email,
    code,
}) {
    return apiRequest(
        "/auth/otp/verify-email/",
        {
            method: "POST",

            body: JSON.stringify({
                email,
                code,
            }),
        }
    );
}


export async function resendVerificationEmail(email) {
    return apiRequest(
        "/auth/registration/resend-email/",
        {
            method: "POST",

            body: JSON.stringify({
                email,
            }),
        }
    );
}


export async function loginUser({
    email,
    password,
}) {
    return apiRequest(
        "/auth/login/",
        {
            method: "POST",

            body: JSON.stringify({
                email,
                password,
            }),
        }
    );
}


/* ========================================
   Forgot Password
   ======================================== */

export async function requestPasswordReset(email) {
    return apiRequest(
        "/auth/otp/password/request/",
        {
            method: "POST",

            body: JSON.stringify({
                email,
            }),
        }
    );
}


export async function confirmPasswordReset({
    email,
    code,
    new_password1,
    new_password2,
}) {
    return apiRequest(
        "/auth/otp/password/confirm/",
        {
            method: "POST",

            body: JSON.stringify({
                email,
                code,
                new_password1,
                new_password2,
            }),
        }
    );
}