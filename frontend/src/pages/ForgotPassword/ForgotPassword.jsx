import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import "./ForgotPassword.css";
import openLedgerImg from "../../assets/open-ledger.png";

import {
    requestPasswordReset,
    confirmPasswordReset,
} from "../../api/auth";


export default function ForgotPassword() {
    // ==========================================
    // STATE
    // ==========================================

    const [phase, setPhase] = useState("request");

    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [emailTouched, setEmailTouched] = useState(false);

    const [code, setCode] = useState([
        "",
        "",
        "",
        "",
        "",
        "",
    ]);

    const [codeError, setCodeError] = useState("");

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [passwordTouched, setPasswordTouched] = useState({
        newPassword: false,
        confirmPassword: false,
    });

    const [showPassword, setShowPassword] = useState(false);

    const [busy, setBusy] = useState(false);
    const [passwordBusy, setPasswordBusy] = useState(false);

    const [cooldown, setCooldown] = useState(0);
    const [resent, setResent] = useState(false);

    const [redirectIn, setRedirectIn] = useState(3);

    const codeRefs = useRef([]);


    // ==========================================
    // COOLDOWN TIMER
    // ==========================================

    useEffect(() => {
        if (cooldown <= 0) {
            return;
        }

        const timer = setInterval(() => {
            setCooldown((current) => {
                if (current <= 1) {
                    clearInterval(timer);
                    return 0;
                }

                return current - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [cooldown]);


    // ==========================================
    // REDIRECT TIMER
    // ==========================================

    useEffect(() => {
        if (phase !== "done" || redirectIn <= 0) {
            return;
        }

        const timer = setInterval(() => {
            setRedirectIn((current) => {
                if (current <= 1) {
                    clearInterval(timer);
                    return 0;
                }

                return current - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [phase]);


    useEffect(() => {
        if (phase === "done" && redirectIn === 0) {
            window.location.href = "/login";
        }
    }, [phase, redirectIn]);


    // ==========================================
    // EMAIL VALIDATION
    // ==========================================

    function validateEmail(value) {
        const trimmed = value.trim();

        if (!trimmed) {
            return "Enter your email address.";
        }

        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(trimmed)) {
            return "That doesn't look like a valid email.";
        }

        return "";
    }


    // ==========================================
    // PASSWORD STRENGTH
    // ==========================================

    function getPasswordStrength(password) {
        if (!password) {
            return 0;
        }

        let strength = 0;

        if (password.length >= 8) {
            strength++;
        }

        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
            strength++;
        }

        if (/\d/.test(password)) {
            strength++;
        }

        if (
            password.length >= 12 ||
            /[^A-Za-z0-9]/.test(password)
        ) {
            strength++;
        }

        return Math.min(strength, 4);
    }


    function getPasswordHint() {
        const password = newPassword;

        if (!password) {
            return "Password strength";
        }

        const strength = getPasswordStrength(password);

        const missing = [];

        if (password.length < 8) {
            missing.push("more characters");
        }

        if (!(/[a-z]/.test(password) && /[A-Z]/.test(password))) {
            missing.push("a capital");
        }

        if (!/\d/.test(password)) {
            missing.push("a number");
        }

        if (strength >= 4) {
            return "Strong";
        }

        const levels = [
            "Weak",
            "Weak",
            "Fair",
            "Good",
        ];

        const level = levels[strength];

        if (missing.length > 1) {
            return `${level} — add ${missing
                .slice(0, -1)
                .join(", ")} and ${missing[missing.length - 1]}`;
        }

        if (missing.length === 1) {
            return `${level} — add ${missing[0]}`;
        }

        return `${level} — try a longer phrase or a symbol`;
    }


    // ==========================================
    // PASSWORD VALIDATION
    // ==========================================

    function getNewPasswordError() {
        if (!newPassword) {
            return "Choose a new password.";
        }

        if (newPassword.length < 8) {
            return "At least 8 characters.";
        }

        if (/^\d+$/.test(newPassword)) {
            return "Can't be all numbers.";
        }

        return "";
    }


    function getConfirmPasswordError() {
        if (!confirmPassword) {
            return "Re-type the new password.";
        }

        if (confirmPassword !== newPassword) {
            return "Passwords don't match.";
        }

        return "";
    }


    // ==========================================
    // REQUEST RESET CODE
    // ==========================================

    async function handleRequestCode(event) {
        event.preventDefault();

        if (busy) {
            return;
        }

        setEmailTouched(true);

        const error = validateEmail(email);

        if (error) {
            setEmailError(error);
            return;
        }

        setEmailError("");
        setBusy(true);

        try {
            await requestPasswordReset(email.trim());

            setPhase("confirm");
            setCooldown(60);
            setResent(false);

            setTimeout(() => {
                codeRefs.current[0]?.focus();
            }, 0);
        } catch (error) {
            setEmailError(
                "Something went wrong. Please try again."
            );
        } finally {
            setBusy(false);
        }
    }


    // ==========================================
    // BACK TO REQUEST
    // ==========================================

    function backToRequest() {
        setPhase("request");

        setCooldown(0);
        setResent(false);

        setCode([
            "",
            "",
            "",
            "",
            "",
            "",
        ]);

        setCodeError("");
    }


    // ==========================================
    // OTP INPUT
    // ==========================================

    function handleCodeChange(index, value) {
        const digits = value
            .replace(/\D/g, "");

        if (!digits) {
            const updatedCode = [...code];
            updatedCode[index] = "";

            setCode(updatedCode);
            setCodeError("");

            return;
        }

        const updatedCode = [...code];

        // Supports pasting multiple digits into an input.
        digits
            .slice(0, 6 - index)
            .split("")
            .forEach((digit, offset) => {
                updatedCode[index + offset] = digit;
            });

        setCode(updatedCode);
        setCodeError("");

        const nextIndex = Math.min(
            index + digits.length,
            code.length - 1
        );

        setTimeout(() => {
            codeRefs.current[nextIndex]?.focus();
        }, 0);
    }


    function handleCodeKeyDown(index, event) {
        if (
            event.key === "Backspace" &&
            !code[index] &&
            index > 0
        ) {
            event.preventDefault();

            const updatedCode = [...code];
            updatedCode[index - 1] = "";

            setCode(updatedCode);
            setCodeError("");

            codeRefs.current[index - 1]?.focus();
        }

        if (event.key === "ArrowLeft" && index > 0) {
            event.preventDefault();
            codeRefs.current[index - 1]?.focus();
        }

        if (
            event.key === "ArrowRight" &&
            index < code.length - 1
        ) {
            event.preventDefault();
            codeRefs.current[index + 1]?.focus();
        }
    }


    function handleCodePaste(index, event) {
        const pasted = event.clipboardData
            ?.getData("text")
            ?.replace(/\D/g, "");

        if (!pasted) {
            return;
        }

        event.preventDefault();

        const updatedCode = [...code];

        pasted
            .slice(0, 6 - index)
            .split("")
            .forEach((digit, offset) => {
                updatedCode[index + offset] = digit;
            });

        setCode(updatedCode);
        setCodeError("");

        const nextIndex = Math.min(
            index + pasted.length,
            code.length - 1
        );

        setTimeout(() => {
            codeRefs.current[nextIndex]?.focus();
        }, 0);
    }


    // ==========================================
    // RESEND CODE
    // ==========================================

    async function handleResend() {
        if (cooldown > 0 || busy) {
            return;
        }

        setBusy(true);
        setCodeError("");

        try {
            await requestPasswordReset(email.trim());

            setCode([
                "",
                "",
                "",
                "",
                "",
                "",
            ]);

            setResent(true);
            setCooldown(60);

            setTimeout(() => {
                codeRefs.current[0]?.focus();
            }, 0);
        } catch (error) {
            setCodeError(
                "Unable to send a new code."
            );
        } finally {
            setBusy(false);
        }
    }


    // ==========================================
    // CONFIRM PASSWORD RESET
    // ==========================================

    async function handleConfirm(event) {
        event.preventDefault();

        if (passwordBusy) {
            return;
        }

        const completeCode = code.join("");

        if (completeCode.length !== 6) {
            setCodeError("Enter all six digits.");
            return;
        }

        setPasswordTouched({
            newPassword: true,
            confirmPassword: true,
        });

        const newPasswordError =
            getNewPasswordError();

        const confirmPasswordError =
            getConfirmPasswordError();

        if (
            newPasswordError ||
            confirmPasswordError
        ) {
            return;
        }

        setPasswordBusy(true);
        setCodeError("");

        try {
            await confirmPasswordReset({
                email: email.trim(),
                code: completeCode,
                new_password1: newPassword,
                new_password2: confirmPassword,
            });

            setPhase("done");
            setResent(false);
            setRedirectIn(3);
        } catch (error) {
            const data = error?.data;

            if (data?.code) {
                setCodeError(
                    Array.isArray(data.code)
                        ? data.code[0]
                        : data.code
                );
            } else if (data?.new_password2) {
                setCodeError(
                    Array.isArray(data.new_password2)
                        ? data.new_password2[0]
                        : data.new_password2
                );
            } else if (data?.non_field_errors) {
                setCodeError(
                    Array.isArray(
                        data.non_field_errors
                    )
                        ? data.non_field_errors[0]
                        : data.non_field_errors
                );
            } else {
                setCodeError(
                    "Unable to reset your password. Please try again."
                );
            }
        } finally {
            setPasswordBusy(false);
        }
    }


    // ==========================================
    // INPUT HANDLERS
    // ==========================================

    function handleEmailChange(event) {
        setEmail(event.target.value);

        if (emailError) {
            setEmailError("");
        }
    }


    function handleNewPasswordChange(event) {
        setNewPassword(event.target.value);

        if (codeError) {
            setCodeError("");
        }
    }


    function handleConfirmPasswordChange(event) {
        setConfirmPassword(event.target.value);

        if (codeError) {
            setCodeError("");
        }
    }


    // ==========================================
    // DERIVED VALUES
    // ==========================================

    const emailValidationError =
        emailError ||
        (emailTouched
            ? validateEmail(email)
            : "");

    const newPasswordError =
        passwordTouched.newPassword
            ? getNewPasswordError()
            : "";

    const confirmPasswordError =
        passwordTouched.confirmPassword
            ? getConfirmPasswordError()
            : "";

    const passwordStrength =
        getPasswordStrength(newPassword);

    const passwordHint =
        getPasswordHint();


    // ==========================================
    // RENDER
    // ==========================================

    return (
        <main className="forgot-password-page">

            <section className="forgot-password-card">

                {/* ==================================
                    LEFT PANEL
                    ================================== */}

                <aside className="forgot-password-panel">

                    <div className="forgot-password-logo">
                        LedgerFlow
                    </div>


                    <div className="forgot-password-intro">

                        <span className="forgot-password-kicker">
                            Account recovery
                        </span>

                        <h1>
                            Forgot it? Let's get you back in.
                        </h1>

                        <p>
                            Two short steps and you're back at
                            your cashbook. Nothing in your book
                            changes while you do this.
                        </p>

                    </div>


                    <div className="forgot-password-status">

                        <span
                            className="forgot-status-dot"
                            aria-hidden="true"
                        />

                        <span className="forgot-status-text">
                            Every entry stays exactly where
                            you left it.
                        </span>

                    </div>


                    <div
                        className="forgot-password-art"
                        aria-hidden="true"
                    >
                        <img
                            src={openLedgerImg}
                            alt=""
                        />
                    </div>

                </aside>


                {/* ==================================
                    RIGHT CONTENT
                    ================================== */}

                <div className="forgot-password-content">

                    {/* TOP */}

                    <div className="forgot-password-top">

                        <span className="forgot-password-badge">
                            {phase === "request"
                                ? "Step 1 of 2"
                                : phase === "confirm"
                                    ? "Step 2 of 2"
                                    : "Password reset"}
                        </span>

                        <Link to="/login">
                            Remembered it? Sign in
                        </Link>

                    </div>


                    {/* PROGRESS */}

                    {phase !== "done" && (
                        <div
                            className="forgot-password-steps"
                            aria-hidden="true"
                        >

                            <div>

                                <span
                                    className={
                                        phase === "request"
                                            ? "active"
                                            : "completed"
                                    }
                                />

                                <label>
                                    Request a code
                                </label>

                            </div>


                            <div>

                                <span
                                    className={
                                        phase === "confirm"
                                            ? "active"
                                            : ""
                                    }
                                />

                                <label>
                                    Set a new password
                                </label>

                            </div>

                        </div>
                    )}


                    {/* ==================================
                        REQUEST PHASE
                        ================================== */}

                    {phase === "request" && (

                        <form
                            className="forgot-password-form"
                            onSubmit={handleRequestCode}
                            noValidate
                        >

                            <div className="forgot-password-heading">

                                <h2>
                                    Where should the code go?
                                </h2>

                                <p>
                                    Enter the email you sign in
                                    with. We'll send a six-digit
                                    code — good for fifteen minutes.
                                </p>

                            </div>


                            <label className="forgot-password-field">

                                <span>
                                    Email
                                </span>

                                <input
                                    type="email"
                                    value={email}
                                    onChange={handleEmailChange}
                                    onBlur={() =>
                                        setEmailTouched(true)
                                    }
                                    placeholder="you@business.in"
                                    autoComplete="email"
                                    aria-invalid={
                                        !!emailValidationError
                                    }
                                    disabled={busy}
                                />

                                {emailValidationError && (
                                    <span
                                        className="forgot-password-error"
                                        role="alert"
                                    >
                                        {emailValidationError}
                                    </span>
                                )}

                            </label>


                            <div className="forgot-password-actions">

                                <Link
                                    to="/login"
                                    className="secondary-button"
                                >
                                    Back to sign in
                                </Link>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={busy}
                                >
                                    {busy
                                        ? "Sending code..."
                                        : "Send reset code"}

                                    <span aria-hidden="true">
                                        →
                                    </span>

                                </button>

                            </div>

                        </form>
                    )}


                    {/* ==================================
                        CONFIRM PHASE
                        ================================== */}

                    {phase === "confirm" && (

                        <form
                            className="forgot-password-form"
                            onSubmit={handleConfirm}
                            noValidate
                        >

                            <div className="forgot-password-heading">

                                <h2>
                                    Enter the code and a new password
                                </h2>

                                <p>
                                    Sent to{" "}
                                    <strong>
                                        {email.trim()}
                                    </strong>
                                    . If nothing arrives,
                                    check spam before asking
                                    for another.{" "}

                                    <button
                                        type="button"
                                        className="inline-button"
                                        onClick={backToRequest}
                                    >
                                        Use a different email
                                    </button>
                                </p>

                            </div>


                            {/* OTP */}

                            <div
                                className="forgot-password-field"
                            >

                                <span>
                                    Six-digit reset code
                                </span>

                                <div
                                    className="otp-inputs"
                                    role="group"
                                    aria-label="Six-digit reset code"
                                >

                                    {code.map(
                                        (digit, index) => (
                                            <input
                                                key={index}
                                                ref={(element) => {
                                                    codeRefs.current[
                                                        index
                                                    ] = element;
                                                }}
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete={
                                                    index === 0
                                                        ? "one-time-code"
                                                        : "off"
                                                }
                                                maxLength={1}
                                                value={digit}
                                                onChange={(event) =>
                                                    handleCodeChange(
                                                        index,
                                                        event.target.value
                                                    )
                                                }
                                                onKeyDown={(event) =>
                                                    handleCodeKeyDown(
                                                        index,
                                                        event
                                                    )
                                                }
                                                onPaste={(event) =>
                                                    handleCodePaste(
                                                        index,
                                                        event
                                                    )
                                                }
                                                aria-label={`Digit ${
                                                    index + 1
                                                } of 6`}
                                                aria-invalid={
                                                    !!codeError
                                                }
                                                disabled={passwordBusy}
                                            />
                                        )
                                    )}

                                </div>


                                {codeError && (
                                    <span
                                        className="forgot-password-error"
                                        role="alert"
                                    >
                                        {codeError}
                                    </span>
                                )}


                                <div className="forgot-password-actions">

                                    {resent && cooldown > 0 && (
                                        <span className="forgot-password-note">
                                            A newer code is on its way —
                                            the previous one stopped working.
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        className="inline-button"
                                        onClick={handleResend}
                                        disabled={
                                            cooldown > 0 ||
                                            busy ||
                                            passwordBusy
                                        }
                                    >
                                        {cooldown > 0
                                            ? `Resend in ${cooldown}s`
                                            : "Send another code"}
                                    </button>

                                </div>

                            </div>


                            {/* PASSWORDS */}

                            <div className="forgot-password-passwords">

                                {/* NEW PASSWORD */}

                                <label className="forgot-password-field">

                                    <span>
                                        New password
                                    </span>

                                    <div className="password-input-wrapper">

                                        <input
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={newPassword}
                                            onChange={
                                                handleNewPasswordChange
                                            }
                                            onBlur={() =>
                                                setPasswordTouched(
                                                    (current) => ({
                                                        ...current,
                                                        newPassword: true,
                                                    })
                                                )
                                            }
                                            placeholder="At least 8 characters"
                                            autoComplete="new-password"
                                            disabled={passwordBusy}
                                        />

                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() =>
                                                setShowPassword(
                                                    (current) =>
                                                        !current
                                                )
                                            }
                                        >
                                            {showPassword
                                                ? "Hide"
                                                : "Show"}
                                        </button>

                                    </div>


                                    <div className="password-strength">

                                        <div className="password-strength-bars">

                                            {[0, 1, 2, 3].map(
                                                (index) => (
                                                    <span
                                                        key={index}
                                                        className={
                                                            index <
                                                            passwordStrength
                                                                ? "active"
                                                                : ""
                                                        }
                                                    />
                                                )
                                            )}

                                        </div>

                                        <span>
                                            {passwordHint}
                                        </span>

                                    </div>


                                    {newPasswordError && (
                                        <span
                                            className="forgot-password-error"
                                            role="alert"
                                        >
                                            {newPasswordError}
                                        </span>
                                    )}

                                </label>


                                {/* CONFIRM PASSWORD */}

                                <label className="forgot-password-field">

                                    <span>
                                        Confirm new password
                                    </span>

                                    <input
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={confirmPassword}
                                        onChange={
                                            handleConfirmPasswordChange
                                        }
                                        onBlur={() =>
                                            setPasswordTouched(
                                                (current) => ({
                                                    ...current,
                                                    confirmPassword: true,
                                                })
                                            )
                                        }
                                        placeholder="Re-type it"
                                        autoComplete="new-password"
                                        disabled={passwordBusy}
                                    />


                                    {confirmPasswordError && (
                                        <span
                                            className="forgot-password-error"
                                            role="alert"
                                        >
                                            {confirmPasswordError}
                                        </span>
                                    )}

                                </label>

                            </div>


                            {/* ACTIONS */}

                            <div className="forgot-password-actions">

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={passwordBusy}
                                >
                                    {passwordBusy
                                        ? "Saving..."
                                        : "Save new password"}
                                </button>

                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={backToRequest}
                                >
                                    Cancel
                                </button>

                            </div>


                        </form>
                    )}


                    {/* ==================================
                        DONE PHASE
                        ================================== */}

                    {phase === "done" && (

                        <div className="forgot-password-success">

                            <span
                                className="success-icon"
                                aria-hidden="true"
                            >
                                ✓
                            </span>


                            <div>

                                <h2>
                                    New password saved
                                </h2>

                                <p>
                                    Sign in with it now.
                                    Anywhere else you were
                                    signed in has been signed
                                    out, so nobody keeps an
                                    old session.
                                </p>

                            </div>


                            <div className="success-actions">

                                <Link
                                    to="/login"
                                    className="success-button"
                                >
                                    Go to sign in
                                </Link>

                                {redirectIn > 0 && (
                                    <span>
                                        Taking you in{" "}
                                        {redirectIn}…
                                    </span>
                                )}

                            </div>

                        </div>
                    )}

                </div>

            </section>

        </main>
    );
}