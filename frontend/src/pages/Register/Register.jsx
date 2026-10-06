import { useRef, useState } from "react";
import "./Register.css";

import {
    registerUser,
    verifyEmailOtp,
    resendVerificationEmail,
} from "../../api/auth";

import growthStacksImg from "../../assets/growth-stacks.png";


function Register() {

    // Which registration step are we currently on?
    const [step, setStep] = useState(1);

    // API states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [otpError, setOtpError] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);

    // Should the password be visible?
    const [showPassword, setShowPassword] = useState(false);

    // OTP digits
    const [otp, setOtp] = useState([
        "",
        "",
        "",
        "",
        "",
        "",
    ]);

    // All form data lives in one place
    const [formData, setFormData] = useState({
        businessName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    // References to the six OTP inputs
    const otpRefs = useRef([]);


    // ==========================================
    // FORM FUNCTIONS
    // ==========================================

    // Update the correct field in formData
    function handleChange(e) {
        const { name, value } = e.target;

        setFormData({
            ...formData,
            [name]: value,
        });

        // Clear old error when user starts typing
        setError("");
    }


    // ==========================================
    // STEP 1
    // ==========================================

    // Move from Step 1 to Step 2
    function handleContinue(e) {
        e.preventDefault();

        setError("");

        // Basic frontend validation
        if (!formData.businessName.trim()) {
            setError("Please enter your business name.");
            return;
        }

        if (!formData.email.trim()) {
            setError("Please enter your email.");
            return;
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(formData.email)) {
            setError("Please enter a valid email address.");
            return;
        }

        setStep(2);
    }


    // ==========================================
    // STEP 2
    // ==========================================

    // Move back one step
    function handleBack(e) {
        e.preventDefault();

        setError("");
        setStep((currentStep) => currentStep - 1);
    }


    // Calculate password strength
    function getPasswordStrength(password) {

        if (password.length === 0) {
            return 0;
        }

        let strength = 0;

        if (password.length >= 8) {
            strength++;
        }

        if (/[A-Z]/.test(password)) {
            strength++;
        }

        if (/[a-z]/.test(password)) {
            strength++;
        }

        if (/[0-9]/.test(password)) {
            strength++;
        }

        if (/[^A-Za-z0-9]/.test(password)) {
            strength++;
        }

        return strength;
    }


    const passwordStrength =
        getPasswordStrength(formData.password);


    // ==========================================
    // REGISTER WITH DJANGO
    // ==========================================

    async function handleRegister(e) {
        e.preventDefault();

        if (loading) {
            return;
        }

        setError("");

        // Frontend validation
        if (formData.password.length < 8) {
            setError(
                "Password must be at least 8 characters."
            );
            return;
        }

        // Reject all-number password
        if (/^\d+$/.test(formData.password)) {
            setError(
                "Password cannot contain only numbers."
            );
            return;
        }

        // Common passwords
        const commonPasswords = [
            "password",
            "password1",
            "12345678",
            "qwerty123",
            "iloveyou",
            "admin123",
        ];

        if (
            commonPasswords.includes(
                formData.password.toLowerCase()
            )
        ) {
            setError(
                "Please choose a stronger password."
            );
            return;
        }

        if (
            formData.password !==
            formData.confirmPassword
        ) {
            setError("Passwords do not match.");
            return;
        }


        setLoading(true);

        try {

            // Call Django registration API
            await registerUser({
                email: formData.email,
                password1: formData.password,
                password2: formData.confirmPassword,
                business_name: formData.businessName,
            });


            /*
             * Django registration succeeded.
             *
             * Backend sends the verification email.
             *
             * Now show Step 3.
             */
            setStep(3);

        } catch (error) {

            console.error(
                "Registration failed:",
                error
            );

            const data = error?.data || {};

            /*
             * Django / DRF errors can look like:
             *
             * {
             *   email: ["Enter a valid email."]
             * }
             */

            const message =
                data.email?.[0] ||
                data.password1?.[0] ||
                data.password2?.[0] ||
                data.business_name?.[0] ||
                data.non_field_errors?.[0] ||
                data.detail ||
                "Unable to create your account.";

            setError(message);

        } finally {

            setLoading(false);
        }
    }


    // ==========================================
    // OTP FUNCTIONS
    // ==========================================

    function handleOtpChange(index, value) {

        // Keep only numbers
        const digits = value.replace(/\D/g, "");

        if (!digits) {
            const newOtp = [...otp];

            newOtp[index] = "";

            setOtp(newOtp);
            setOtpError("");

            return;
        }

        const newOtp = [...otp];


        // Handle normal single digit input
        if (digits.length === 1) {

            newOtp[index] = digits;

            setOtp(newOtp);
            setOtpError("");

            // Move to next input
            if (index < 5) {
                otpRefs.current[index + 1]?.focus();
            }

            return;
        }


        // Handle pasting / entering multiple digits
        const pastedDigits =
            digits.slice(0, 6 - index);


        pastedDigits
            .split("")
            .forEach((digit, offset) => {
                newOtp[index + offset] = digit;
            });


        setOtp(newOtp);
        setOtpError("");


        // Focus the input after the last inserted digit
        const nextIndex = Math.min(
            index + pastedDigits.length,
            5
        );

        otpRefs.current[nextIndex]?.focus();
    }


    function handleOtpKeyDown(index, e) {

        // Backspace
        if (e.key === "Backspace") {

            if (otp[index]) {

                const newOtp = [...otp];

                newOtp[index] = "";

                setOtp(newOtp);
                setOtpError("");

                return;
            }


            if (index > 0) {

                const newOtp = [...otp];

                newOtp[index - 1] = "";

                setOtp(newOtp);
                setOtpError("");

                otpRefs.current[index - 1]?.focus();
            }
        }


        // Arrow left
        if (e.key === "ArrowLeft") {

            e.preventDefault();

            if (index > 0) {
                otpRefs.current[index - 1]?.focus();
            }
        }


        // Arrow right
        if (e.key === "ArrowRight") {

            e.preventDefault();

            if (index < 5) {
                otpRefs.current[index + 1]?.focus();
            }
        }
    }


    function handleOtpPaste(index, e) {

        e.preventDefault();

        const pastedText =
            e.clipboardData.getData("text");

        const digits =
            pastedText.replace(/\D/g, "");

        if (!digits) {
            return;
        }

        const newOtp = [...otp];

        const pastedDigits =
            digits.slice(0, 6 - index);


        pastedDigits
            .split("")
            .forEach((digit, offset) => {
                newOtp[index + offset] = digit;
            });


        setOtp(newOtp);
        setOtpError("");


        const nextIndex = Math.min(
            index + pastedDigits.length,
            5
        );

        otpRefs.current[nextIndex]?.focus();
    }


    // ==========================================
    // VERIFY OTP WITH DJANGO
    // ==========================================

    async function handleVerify(e) {

        e.preventDefault();

        if (verifying) {
            return;
        }

        setOtpError("");

        const code = otp.join("");


        if (code.length !== 6) {

            setOtpError(
                "Please enter all six digits."
            );

            return;
        }


        setVerifying(true);


        try {

            // Call Django OTP verification API
            await verifyEmailOtp({
                email: formData.email,
                code: code,
            });


            /*
             * OTP verification succeeded.
             *
             * Your backend currently returns:
             *
             * {
             *     "detail": "..."
             * }
             *
             * It does NOT return a JWT.
             *
             * So we don't save a token here.
             */

            console.log(
                "Email verified successfully."
            );


            // For now send the user to login.
            window.location.href = "/login";


        } catch (error) {

            console.error(
                "OTP verification failed:",
                error
            );

            const data =
                error?.data || {};


            const message =
                data.code?.[0] ||
                data.non_field_errors?.[0] ||
                data.detail ||
                "Invalid verification code.";

            setOtpError(message);

        } finally {

            setVerifying(false);
        }
    }


    // ==========================================
    // RESEND OTP
    // ==========================================

    async function handleResend() {

        if (resending) {
            return;
        }

        setResending(true);
        setOtpError("");


        try {

            await resendVerificationEmail(
                formData.email
            );


            // Clear current OTP
            setOtp([
                "",
                "",
                "",
                "",
                "",
                "",
            ]);


            // Focus first input
            otpRefs.current[0]?.focus();


            console.log(
                "Verification email sent again."
            );


        } catch (error) {

            console.error(
                "Resend OTP failed:",
                error
            );


            const data =
                error?.data || {};


            const message =
                data.detail ||
                data.email?.[0] ||
                "Unable to resend verification email.";


            setOtpError(message);

        } finally {

            setResending(false);
        }
    }


    // ==========================================
    // RENDER
    // ==========================================

    return (

        <main className="register-page">

            <section className="register-card">


                {/* LEFT SIDE */}

                <aside className="register-info">

                    <div className="register-logo">
                        <span>LedgerFlow</span>
                    </div>


                    <div className="register-intro">

                        <h1>
                            Every rupee, accounted for.
                        </h1>

                        <p>
                            Cashbook, dealer balances and bills —
                            closing the day in one place instead of four.
                        </p>

                    </div>


                    <ol className="register-steps">

                        <li
                            className={`register-step ${
                                step >= 1
                                    ? "active"
                                    : ""
                            }`}
                        >

                            <span className="step-number">
                                {step > 1 ? "✓" : "1"}
                            </span>

                            <span>
                                Name your business
                            </span>

                        </li>


                        <li
                            className={`register-step ${
                                step >= 2
                                    ? "active"
                                    : ""
                            }`}
                        >

                            <span className="step-number">
                                {step > 2 ? "✓" : "2"}
                            </span>

                            <span>
                                Secure your account
                            </span>

                        </li>


                        <li
                            className={`register-step ${
                                step >= 3
                                    ? "active"
                                    : ""
                            }`}
                        >

                            <span className="step-number">
                                3
                            </span>

                            <span>
                                Verify
                            </span>

                        </li>

                    </ol>


                    <div className="register-art">

                        <img
                            src={growthStacksImg}
                            alt="Growth illustration"
                        />

                    </div>

                </aside>


                {/* RIGHT SIDE */}

                <section className="register-form-section">


                    {/* TOP BAR */}

                    <div className="register-topbar">

                        <span className="register-step-label">
                            Step {step} of 3
                        </span>

                        <a href="/login">
                            Already have an account? Sign in
                        </a>

                    </div>


                    {/* PROGRESS */}

                    <div className="register-progress">

                        <div
                            className="register-progress-fill"
                            style={{
                                width: `${(step / 3) * 100}%`,
                            }}
                        />

                    </div>


                    {/* =================================
                        STEP 1
                    ================================= */}

                    {step === 1 && (

                        <form
                            className="register-form"
                            onSubmit={handleContinue}
                        >

                            <div className="register-header">

                                <h2>
                                    Name your business
                                </h2>

                                <p>
                                    This heads your dashboard and printed
                                    statements. We sign you in by email.
                                </p>

                            </div>


                            <div className="form-fields">


                                <label className="form-field">

                                    <span>
                                        Business name
                                    </span>

                                    <div className="input-wrapper">

                                        <input
                                            name="businessName"
                                            type="text"
                                            placeholder="Shree Traders"
                                            value={
                                                formData.businessName
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            autoComplete="organization"
                                        />

                                    </div>

                                </label>


                                <label className="form-field">

                                    <span>
                                        Email
                                    </span>

                                    <div className="input-wrapper">

                                        <input
                                            name="email"
                                            type="email"
                                            placeholder="you@business.in"
                                            value={
                                                formData.email
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            autoComplete="email"
                                        />

                                    </div>

                                </label>


                                {error && (
                                    <div className="form-error">
                                        {error}
                                    </div>
                                )}

                            </div>


                            <div className="register-actions">

                                <button type="submit">
                                    Continue
                                </button>

                            </div>

                        </form>

                    )}


                    {/* =================================
                        STEP 2
                    ================================= */}

                    {step === 2 && (

                        <form
                            className="register-form"
                            onSubmit={handleRegister}
                        >

                            <div className="register-header">

                                <h2>
                                    Secure your account
                                </h2>

                                <p>
                                    Eight characters minimum. All-numeric
                                    and common passwords are rejected.
                                </p>

                            </div>


                            <div className="form-fields">


                                <label className="form-field">

                                    <span>
                                        Password
                                    </span>

                                    <div className="input-wrapper">

                                        <input
                                            name="password"
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={
                                                formData.password
                                            }
                                            placeholder="At least 8 characters"
                                            onChange={
                                                handleChange
                                            }
                                            autoComplete="new-password"
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPassword(
                                                    !showPassword
                                                )
                                            }
                                        >
                                            {showPassword
                                                ? "Hide"
                                                : "Show"}
                                        </button>

                                    </div>

                                </label>


                                {formData.password.length > 0 && (

                                    <div className="password-strength">

                                        <div className="strength-bars">

                                            {[1, 2, 3, 4, 5].map(
                                                (bar) => (

                                                    <span
                                                        key={bar}
                                                        className={
                                                            bar <=
                                                            passwordStrength
                                                                ? "strength-bar active"
                                                                : "strength-bar"
                                                        }
                                                    />

                                                )
                                            )}

                                        </div>


                                        <span className="strength-label">

                                            {passwordStrength <= 1 &&
                                                "Weak"}

                                            {passwordStrength === 2 &&
                                                "Fair"}

                                            {passwordStrength === 3 &&
                                                "Good"}

                                            {passwordStrength === 4 &&
                                                "Strong"}

                                            {passwordStrength === 5 &&
                                                "Very strong"}

                                        </span>

                                    </div>

                                )}


                                <label className="form-field">

                                    <span>
                                        Confirm password
                                    </span>

                                    <div className="input-wrapper">

                                        <input
                                            name="confirmPassword"
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            placeholder="Re-type it"
                                            value={
                                                formData.confirmPassword
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            autoComplete="new-password"
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPassword(
                                                    !showPassword
                                                )
                                            }
                                        >
                                            {showPassword
                                                ? "Hide"
                                                : "Show"}
                                        </button>

                                    </div>

                                </label>


                                {error && (
                                    <div className="form-error">
                                        {error}
                                    </div>
                                )}

                            </div>


                            <div className="register-actions">

                                <button
                                    type="button"
                                    className="register-back-button"
                                    onClick={handleBack}
                                    disabled={loading}
                                >
                                    Back
                                </button>


                                <button
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading
                                        ? "Creating account..."
                                        : "Continue"}
                                </button>

                            </div>

                        </form>

                    )}


                    {/* =================================
                        STEP 3
                    ================================= */}

                    {step === 3 && (

                        <form
                            className="register-form"
                            onSubmit={handleVerify}
                        >

                            <div className="register-header">

                                <h2>
                                    Verify your email
                                </h2>

                                <p>
                                    We've sent a verification code to{" "}

                                    <strong>
                                        {formData.email}
                                    </strong>

                                </p>

                            </div>


                            {/* SIX OTP INPUTS */}

                            <div
                                className="otp-inputs"
                                role="group"
                                aria-label="Six-digit verification code"
                            >

                                {otp.map(
                                    (digit, index) => (

                                        <input
                                            key={index}
                                            ref={(element) => {
                                                otpRefs.current[index] =
                                                    element;
                                            }}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={1}
                                            value={digit}
                                            aria-label={`Digit ${
                                                index + 1
                                            } of 6`}
                                            onChange={(e) =>
                                                handleOtpChange(
                                                    index,
                                                    e.target.value
                                                )
                                            }
                                            onKeyDown={(e) =>
                                                handleOtpKeyDown(
                                                    index,
                                                    e
                                                )
                                            }
                                            onPaste={(e) =>
                                                handleOtpPaste(
                                                    index,
                                                    e
                                                )
                                            }
                                        />

                                    )
                                )}

                            </div>


                            {otpError && (

                                <div className="form-error">
                                    {otpError}
                                </div>

                            )}


                            {/* ACTIONS */}

                            <div className="otp-actions">

                                <button
                                    type="submit"
                                    className="otp-verify-button"
                                    disabled={verifying}
                                >
                                    {verifying
                                        ? "Verifying..."
                                        : "Verify and continue"}
                                </button>


                                <button
                                    type="button"
                                    className="otp-resend-button"
                                    onClick={handleResend}
                                    disabled={resending}
                                >
                                    {resending
                                        ? "Sending..."
                                        : "Resend code"}
                                </button>

                            </div>


                            {/* START AGAIN */}

                            <button
                                type="button"
                                className="otp-edit-email"
                                onClick={() => {

                                    setOtp([
                                        "",
                                        "",
                                        "",
                                        "",
                                        "",
                                        "",
                                    ]);

                                    setOtpError("");
                                    setError("");
                                    setStep(1);
                                }}
                            >
                                Wrong address? Start again
                            </button>

                        </form>

                    )}

                </section>

            </section>

        </main>
    );
}


export default Register;