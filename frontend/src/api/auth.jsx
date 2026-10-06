import { refreshAccessToken } from "./tokenRefresh";

const API_BASE_URL = "http://127.0.0.1:8000/api";


async function apiRequest(endpoint, options = {}, retry = true) {
    const accessToken = localStorage.getItem("access_token");

    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            ...options,

            headers: {
                "Content-Type": "application/json",

                ...(accessToken
                    ? {
                        Authorization: `Bearer ${accessToken}`,
                    }
                    : {}),

                ...(options.headers || {}),
            },
        }
    );

    const data = await response
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