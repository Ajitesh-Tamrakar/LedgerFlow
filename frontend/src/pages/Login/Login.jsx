import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

import { loginUser } from "../../api/auth";

import openLedgerImg from "../../assets/open-ledger.png";
import { Navigate } from "react-router-dom";

function Login() {
    // Form state
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const navigate = useNavigate()

    // Validation state
    const [touched, setTouched] = useState({
        email: false,
        password: false,
    });

    // ==========================================
    // FORM FUNCTIONS
    // ==========================================

    function handleChange(e) {
        const { name, value } = e.target;

        setFormData({
            ...formData,
            [name]: value,
        });

        // Clear old backend error when user
        // starts changing the form again.
        setError("");
    }

    function handleBlur(e) {
        const { name } = e.target;

        setTouched({
            ...touched,
            [name]: true,
        });
    }

    // ==========================================
    // VALIDATION
    // ==========================================

    function validateForm() {
        const email = formData.email.trim();
        const password = formData.password;

        if (!email) {
            return "Enter your email address.";
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return "That doesn't look like a valid email.";
        }

        if (!password) {
            return "Enter your password.";
        }

        return "";
    }

    function getFieldError(fieldName) {
        if (!touched[fieldName]) {
            return "";
        }

        if (
            fieldName === "email" &&
            !formData.email.trim()
        ) {
            return "Enter your email address.";
        }

        if (
            fieldName === "email" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                formData.email.trim()
            )
        ) {
            return "That doesn't look like a valid email.";
        }

        if (
            fieldName === "password" &&
            !formData.password
        ) {
            return "Enter your password.";
        }

        return "";
    }

    // ==========================================
    // LOGIN
    // ==========================================

  async function handleLogin(e) {
        e.preventDefault();

        if (loading) {
            return;
        }

        // Mark both fields as touched
        setTouched({
            email: true,
            password: true,
        });

        setError("");

        // Frontend validation
        const validationError = validateForm();

        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);

        try {
            // Call Django login API
            const response = await loginUser({
                email: formData.email.trim(),
                password: formData.password,
            });

            /*
             * Backend returns:
             *
             * {
             *     access,
             *     refresh,
             *     user
             * }
             */

            const {
                access,
                refresh,
                user,
            } = response;

            /*
             * For now we keep the token storage simple.
             *
             * "Remember me" checked:
             *     localStorage
             *
             * "Remember me" unchecked:
             *     sessionStorage
             */

            const storage = rememberMe
                ? localStorage
                : sessionStorage;

            storage.setItem(
                "access_token",
                access
            );

            storage.setItem(
                "refresh_token",
                refresh
            );

            /*
             * We don't need to store the entire user object
             * yet. The backend already gives it to us and we
             * can add user/session handling later if needed.
             */

            console.log(
                "Login successful:",
                user
            );

            // Send user to the application.
            // window.location.href = "/";
            navigate('/dashboard')

        } catch (error) {
            console.error(
                "Login failed:",
                error
            );

            const data =
                error?.data || {};

            /*
             * dj-rest-auth / DRF commonly returns
             * authentication errors through
             * non_field_errors.
             */

            const message =
                data.non_field_errors?.[0] ||
                data.detail ||
                data.email?.[0] ||
                "Unable to sign in. Please check your email and password.";

            setError(message);

        } finally {
            setLoading(false);
        }
    }

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <main className="login-page">

            <section className="login-card">

                {/* =================================
                    LEFT SIDE
                ================================= */}

                <aside className="login-info">

                    <div className="login-logo">
                        <span>LedgerFlow</span>
                    </div>

                    <div className="login-intro">

                        <span className="login-kicker">
                            {new Date().getHours() < 12
                                ? "Good morning"
                                : new Date().getHours() < 17
                                    ? "Good afternoon"
                                    : "Good evening"}
                        </span>

                        <h1>
                            Pick up where the day left off.
                        </h1>

                        <p>
                            Nothing to set up, nothing to
                            re-enter. Sign in and the book
                            opens itself.
                        </p>

                    </div>

                    <div className="login-private-note">

                        <span aria-hidden="true" />

                        <span>
                            Your book is private — only you
                            and the people you invite.
                        </span>

                    </div>

                    <div className="login-art">

                        <img
                            src={openLedgerImg}
                            alt=""
                        />

                    </div>

                </aside>

                {/* =================================
                    RIGHT SIDE
                ================================= */}

                <section className="login-form-section">

                    {/* TOP BAR */}

                    <div className="login-topbar">

                        <span className="login-badge">
                            Returning
                        </span>

                        <Link to="/signup">
                            New here? Create an account
                        </Link>

                    </div>

                    {/* SIGN IN FORM */}

                    <form
                        className="login-form"
                        onSubmit={handleLogin}
                        noValidate
                    >

                        <div className="login-header">

                            <h2>
                                Welcome back
                            </h2>

                            <p>
                                The email and password you
                                registered your business with.
                            </p>

                        </div>

                        {/* Backend / form error */}

                        {error && (
                            <div
                                className="login-error"
                                role="alert"
                            >
                                <span>
                                    {error}
                                </span>
                            </div>
                        )}

                        {/* FIELDS */}

                        <div className="login-fields">

                            {/* EMAIL */}

                            <label className="login-field">

                                <span className="login-field-label">
                                    Email
                                </span>

                                <div
                                    className={`login-input-wrapper ${getFieldError("email")
                                            ? "has-error"
                                            : ""
                                        }`}
                                >

                                    <input
                                        name="email"
                                        type="email"
                                        placeholder="you@business.in"
                                        value={formData.email}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        autoComplete="username"
                                        aria-invalid={
                                            !!getFieldError("email")
                                        }
                                    />

                                </div>

                                {getFieldError("email") && (
                                    <span
                                        className="login-field-error"
                                        role="alert"
                                    >
                                        <span aria-hidden="true" />
                                        {getFieldError("email")}
                                    </span>
                                )}

                            </label>

                            {/* PASSWORD */}

                            <label className="login-field">

                                <span className="login-field-heading">

                                    <span className="login-field-label">
                                        Password
                                    </span>

                                    <Link
                                        to="/forgot-password"
                                        className="forgot-password"
                                    >
                                        Forgot password?
                                    </Link>

                                </span>

                                <div
                                    className={`login-input-wrapper ${getFieldError("password")
                                            ? "has-error"
                                            : ""
                                        }`}
                                >

                                    <input
                                        name="password"
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        placeholder="Your password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        autoComplete="current-password"
                                        aria-invalid={
                                            !!getFieldError("password")
                                        }
                                    />

                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() =>
                                            setShowPassword(
                                                !showPassword
                                            )
                                        }
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                    >
                                        {showPassword
                                            ? "Hide"
                                            : "Show"}
                                    </button>

                                </div>

                                {getFieldError("password") && (
                                    <span
                                        className="login-field-error"
                                        role="alert"
                                    >
                                        <span aria-hidden="true" />
                                        {getFieldError("password")}
                                    </span>
                                )}

                            </label>

                        </div>

                        {/* REMEMBER ME */}

                        <label className="remember-me">

                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) =>
                                    setRememberMe(
                                        e.target.checked
                                    )
                                }
                            />

                            <span>
                                Remember me on this device
                            </span>

                        </label>

                        {/* ACTION */}

                        <div className="login-actions">

                            <button
                                type="submit"
                                disabled={loading}
                            >

                                <span>
                                    {loading
                                        ? "Signing in..."
                                        : "Sign in"}

                                    <span aria-hidden="true">
                                        →
                                    </span>
                                </span>

                            </button>

                        </div>

                    </form>

                </section>

            </section>

        </main>
    );
}

export default Login;