import { useCallback, useEffect, useRef, useState } from "react";
import PageShell from "../../components/PageShell/PageShell";
import Navbar from "../../components/Navbar/Navbar";
import {
  getAuthUser,
  changePassword,
  requestPasswordReset,
  verifyPasswordResetCode,
  confirmPasswordReset,
  logout,
} from "../../api/auth";
import { getBusiness, updateBusinessName } from "../../api/business";
import { initials, monthYear } from "../../lib/format";
import SettingsRail from "./components/SettingsRail";
import BusinessNameCard from "./components/BusinessNameCard";
import PasswordCard from "./components/PasswordCard";
import SignOutSection from "./components/SignOutSection";
import "./Settings.css";

/*
 * The settings page.
 *
 * Same architecture as the dealers page: the page owns every piece of
 * state and makes every API call; the cards are presentational and
 * report actions back through the handlers below. The state machine is
 * the design's, one-for-one:
 *
 *   - business card  : draft vs saved name, save/cancel, live note
 *   - password card  : mode "password" | "code"; in code mode the
 *                      new/confirm fields stay locked until the code
 *                      verifies; a done banner on success
 *   - sign out       : confirm modal -> logout -> /login
 *
 * Bootstrap is two GETs on mount (the signed-in user, the business) --
 * the design is the source of truth for everything the cards show.
 */

// The design's "too common" list, verbatim.
const COMMON_PASSWORDS = [
  "password",
  "password1",
  "12345678",
  "qwerty123",
  "letmein",
  "ledgerflow",
  "business1",
  "abc12345",
];

// The design's tiers: <8 short, common list easy, 3+ classes & 12+
// strong, 2 classes good, else middling.
function passwordStrength(value) {
  if (!value) {
    return {
      score: 0,
      label: "Pick something you'll remember — 8 characters or more.",
    };
  }
  if (value.length < 8) {
    return {
      score: 1,
      label: "A bit short — 8 characters or more, please.",
      bad: true,
    };
  }
  if (COMMON_PASSWORDS.includes(value.toLowerCase())) {
    return {
      score: 1,
      label: "That one's too easy to guess. Try something else.",
      bad: true,
    };
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) =>
    r.test(value)
  ).length;
  if (classes >= 3 && value.length >= 12) {
    return { score: 4, label: "Strong — nice one." };
  }
  if (classes >= 2) {
    return {
      score: 3,
      label: "Good. A few more characters would make it stronger.",
    };
  }
  return { score: 2, label: "This will do. Longer is safer." };
}

// DRF field errors arrive as string-or-array; read the first.
function firstError(fieldErrors) {
  if (!fieldErrors) {
    return "";
  }
  return Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
}

// The design's confirm dialog (sign-out + code-ask), local to the page:
// scrim click / Escape / cancel all close it, focus moves in on open and
// returns on close, Tab is trapped.
function ConfirmModal({ which, email, busy, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const returnFocusTo = useRef(null);
  const isSignOut = which === "signout";

  useEffect(() => {
    returnFocusTo.current = document.activeElement;

    const node = dialogRef.current;
    const button = node?.querySelector("button:not([disabled])");
    if (button) {
      button.focus();
    }

    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const items = Array.from(
        dialogRef.current.querySelectorAll(
          "button:not([disabled]), a[href]"
        )
      );
      if (!items.length) {
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const back = returnFocusTo.current;
      if (back && back.focus) {
        back.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="settings-modal">
      <button
        type="button"
        className="settings-modal__scrim"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        ref={dialogRef}
        className="settings-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <p id="settings-modal-title" className="settings-modal__title">
          {isSignOut ? "Sign out of LedgerFlow?" : "Send a code to your email?"}
        </p>
        <p className="settings-modal__body">
          {isSignOut
            ? "You'll need your email and password to get back in."
            : `We'll email a 6-digit code to ${email}. Can you open that inbox right now?`}
        </p>
        <div className="settings-modal__actions">
          <button
            type="button"
            className={`settings-modal__confirm ${
              busy ? "is-busy" : ""
            } ${busy ? "is-disabled" : ""}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {isSignOut
              ? busy
                ? "Signing out…"
                : "Yes, sign out"
              : "Yes, send it"}
          </button>
          <button
            type="button"
            className="settings-modal__cancel"
            onClick={onClose}
          >
            {isSignOut ? "Stay signed in" : "Not now"}
          </button>
        </div>
        {!isSignOut && (
          <p className="settings-modal__help">
            No longer use that inbox?{" "}
            <a href="mailto:support@ledgerflow.app">Write to support</a>.
          </p>
        )}
      </div>
    </div>
  );
}

function Settings() {
  /* ---- bootstrap data: null = still loading ---- */
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  /* ---- business card ---- */
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameTick, setNameTick] = useState(0); // pop parity
  const [nameShake, setNameShake] = useState(0);

  /* ---- password card ---- */
  const [mode, setMode] = useState("password"); // "password" | "code"
  const [current, setCurrent] = useState("");
  const [curError, setCurError] = useState("");
  const [curShake, setCurShake] = useState(0);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confError, setConfError] = useState("");
  const [confShake, setConfShake] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  /* ---- code mode ---- */
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpShake, setOtpShake] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  /* ---- modals / sign out ---- */
  const [modal, setModal] = useState(null); // null | "signout" | "codeAsk"
  const [signingOut, setSigningOut] = useState(false);

  const otpInputRef = useRef(null);
  const nextInputRef = useRef(null);

  /*
   * The bootstrap: the signed-in user (email) and the business (name,
   * created_at for "Member since"). A 401 bounces to /login on its own
   * inside apiRequest; anything else shows a recovery card.
   */
  useEffect(() => {
    let active = true;

    Promise.all([getAuthUser(), getBusiness()])
      .then(([account, ownBusiness]) => {
        if (!active) {
          return;
        }
        setUser(account);
        setBusiness(ownBusiness);
        setNameDraft(ownBusiness.name || "");
      })
      .catch((error) => {
        console.error("Settings bootstrap failed:", error);
        if (active) {
          setLoadFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  /* The 60s resend gate, the ForgotPassword page's pattern. */
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

  /* ============================ derivations ============================ */

  const email = user?.email || "";
  const savedName = business?.name || "";
  const since = monthYear(business?.created_at);
  const letters = initials(business?.name);

  const trimmedName = nameDraft.trim();
  const nameBlank = !trimmedName;
  const nameDirty = trimmedName !== savedName;

  const codeMode = mode === "code";
  const locked = codeMode && !otpVerified; // new/confirm wait for the code
  const strength = passwordStrength(next);
  const identityOk = codeMode ? otpVerified : !!current.trim();
  const ready = identityOk && next.length > 0 && confirm.length > 0;

  /* ============================ business card ============================ */

  function handleNameChange(event) {
    setNameDraft(event.target.value.slice(0, 100));
    if (nameError) {
      setNameError("");
    }
  }

  async function handleSaveName(event) {
    event.preventDefault();

    if (savingName) {
      return;
    }

    const draft = nameDraft.trim();

    if (!draft) {
      setNameShake((count) => count + 1);
      return;
    }

    setSavingName(true);
    setNameError("");

    try {
      const saved = await updateBusinessName(draft);
      setBusiness((own) =>
        own ? { ...own, name: saved.name } : saved
      );
      setNameDraft(draft);
      // The rail's name pops off its parity (the design's tick counter).
      setNameTick((count) => count + 1);
    } catch (error) {
      console.error("Business name save failed:", error);
      setNameError("Couldn't save the name. Try again.");
      setNameShake((count) => count + 1);
    } finally {
      setSavingName(false);
    }
  }

  function handleRevertName() {
    setNameDraft(savedName);
    setNameError("");
  }

  /* ============================ password card ============================ */

  function handleForgot() {
    setModal("codeAsk");
  }

  // Stable on purpose: the modal's focus effect keys off this, and a
  // re-identity would tear down and re-arm the focus trap on every
  // parent render (the cooldown tick would make focus twitch).
  const closeModal = useCallback(() => {
    setModal(null);
    setSigningOut(false);
  }, []);

  async function handleSendCode(resend) {
    setMode("code");
    setModal(null);
    setOtp("");
    setOtpVerified(false);
    setOtpError("");
    setCurrent("");
    setCurError("");

    setOtpSending(true);

    try {
      await requestPasswordReset(email);
      // The backend silently no-ops resends inside its 60s window, so the
      // page keeps its own clock and shows the countdown instead.
      setCooldown(60);
    } catch (error) {
      console.error("Reset code request failed:", error);
      setOtpError("Couldn't send the code. Try again.");
      setOtpShake((count) => count + 1);
    } finally {
      setOtpSending(false);

      if (!resend) {
        setTimeout(() => otpInputRef.current?.focus(), 0);
      }
    }
  }

  /* `code` takes priority over the state on purpose: the auto-verify
     fires from a requestAnimationFrame whose closure predates the
     setOtp that triggered it (a paste drops all six digits at once), so
     the freshly typed value is passed in instead of read from state. */
  async function verifyCode(codeArg) {
    if (otpVerifying || otpVerified) {
      return;
    }

    const code = codeArg ?? otp;

    if (code.length !== 6) {
      setOtpError("Enter all six digits.");
      setOtpShake((count) => count + 1);
      return;
    }

    setOtpVerifying(true);
    setOtpError("");

    try {
      await verifyPasswordResetCode({ email, code });
      setOtpVerified(true);
      setTimeout(() => nextInputRef.current?.focus(), 0);
    } catch (error) {
      const message =
        firstError(error?.data?.code) ||
        "That code didn't work. Check it and try again.";
      setOtpError(message);
      setOtpShake((count) => count + 1);
    } finally {
      setOtpVerifying(false);
    }
  }

  function handleCancelCodeMode() {
    setMode("password");
    setOtp("");
    setOtpVerified(false);
    setOtpError("");
  }

  /* Maps the API's field errors onto the card's messages. The two modes
     fail differently: password mode reports old_password / new_password1;
     code mode can additionally report code (expired between verify and
     submit) -- that re-locks the card. */
  function handlePasswordError(error) {
    console.error("Password update failed:", error);
    const data = error?.data;

    if (data?.old_password) {
      setCurError(firstError(data.old_password) || "That current password isn't right.");
      setCurShake((count) => count + 1);
    }
    if (data?.new_password1) {
      setConfError(firstError(data.new_password1));
      setConfShake((count) => count + 1);
    } else if (data?.new_password2) {
      setConfError(firstError(data.new_password2));
      setConfShake((count) => count + 1);
    } else if (data?.code) {
      setOtpVerified(false);
      setOtpError(firstError(data.code));
      setOtpShake((count) => count + 1);
    } else if (data?.non_field_errors) {
      setConfError(firstError(data.non_field_errors));
      setConfShake((count) => count + 1);
    } else {
      setConfError("Something went wrong. Try again.");
      setConfShake((count) => count + 1);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (pwSaving) {
      return;
    }

    if (codeMode && !otpVerified) {
      setOtpError("Verify the code first.");
      setOtpShake((count) => count + 1);
      return;
    }

    if (!codeMode && !current.trim()) {
      setCurError("We need your current password first.");
      setCurShake((count) => count + 1);
      return;
    }

    if (strength.score <= 1) {
      setConfError(strength.label);
      setConfShake((count) => count + 1);
      return;
    }

    if (confirm !== next) {
      setConfError("These two don't match yet.");
      setConfShake((count) => count + 1);
      return;
    }

    setPwSaving(true);
    setConfError("");
    setCurError("");

    try {
      if (codeMode) {
        // The confirm is the consuming gate; verify left the code live.
        await confirmPasswordReset({
          email,
          code: otp,
          new_password1: next,
          new_password2: confirm,
        });
      } else {
        await changePassword({
          old_password: current,
          new_password1: next,
          new_password2: confirm,
        });
      }

      // The session survives the change (LOGOUT_ON_PASSWORD_CHANGE is
      // off), which is what the design's done banner relies on.
      setPwDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setReveal(false);
      setMode("password");
      setOtp("");
      setOtpVerified(false);
      setOtpError("");
    } catch (error) {
      handlePasswordError(error);
    } finally {
      setPwSaving(false);
    }
  }

  /* ============================ sign out ============================ */

  function handleAskSignOut() {
    setModal("signout");
  }

  async function handleSignOut() {
    setSigningOut(true);

    try {
      await logout();
    } catch (error) {
      // A token that is already dead is, for our purposes, signed out;
      // the redirect below is the goal either way.
      console.error("Sign out failed:", error);
    }

    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }

  /* ============================ render ============================ */

  const loading = !loadFailed && (user === null || business === null);

  return (
    <PageShell>
      <Navbar businessName={business?.name || ""} />

      <h1 className="settings__visually-hidden">Settings</h1>

      <div className="settings__shell">
        <SettingsRail
          initials={letters}
          name={business ? business.name : "—"}
          email={user ? email || "—" : "—"}
          since={business ? since : ""}
          nameTick={nameTick}
        />

        <main className="settings__main">
          <header className="settings__header">
            <h2 className="settings__title">Settings</h2>
            <p>Each section saves on its own.</p>
          </header>

          {loadFailed && (
            <div className="settings__load-failed">
              <p>Couldn't load your settings.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !loadFailed && (
            <>
              <BusinessNameCard
                value={nameDraft}
                blank={nameBlank}
                note={
                  nameBlank
                    ? "Add a name so we know what to call your business."
                    : nameError
                      ? nameError
                      : savingName
                        ? "Saving…"
                        : nameDirty
                          ? "You have unsaved changes."
                          : "All saved."
                }
                noteError={!!nameError}
                count={nameDraft.length > 80 ? `${nameDraft.length} of 100` : ""}
                countWarn={nameDraft.length > 94}
                saveCta={
                  savingName ? "Saving…" : nameDirty ? "Save changes" : "Saved"
                }
                saveDisabled={savingName || !nameDirty || nameBlank}
                saving={savingName}
                revertDisabled={!nameDirty || savingName}
                shake={nameShake}
                onValueChange={handleNameChange}
                onSubmit={handleSaveName}
                onRevert={handleRevertName}
              />

              <PasswordCard
                email={email}
                mode={mode}
                current={current}
                curError={curError}
                curShake={curShake}
                onCurrentChange={(event) => {
                  setCurrent(event.target.value);
                  if (curError) {
                    setCurError("");
                  }
                }}
                next={next}
                onNewChange={(event) => {
                  setNext(event.target.value);
                  if (confError) {
                    setConfError("");
                  }
                  if (pwDone) {
                    setPwDone(false);
                  }
                }}
                nextInputRef={nextInputRef}
                confirm={confirm}
                onConfirmChange={(event) => {
                  setConfirm(event.target.value);
                  if (confError) {
                    setConfError("");
                  }
                  if (pwDone) {
                    setPwDone(false);
                  }
                }}
                confError={confError}
                confShake={confShake}
                reveal={reveal}
                onToggleReveal={() => setReveal((shown) => !shown)}
                locked={locked}
                strengthScore={strength.score}
                strengthLabel={strength.label}
                strengthBad={!!strength.bad}
                submitCta={pwSaving ? "Updating…" : "Update password"}
                submitDisabled={pwSaving || !ready}
                saving={pwSaving}
                done={pwDone}
                onDoneDismiss={() => setPwDone(false)}
                onForgot={handleForgot}
                onSubmitForm={handlePasswordSubmit}
                otp={otp}
                onOtpChange={(event) => {
                  const value = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6);
                  setOtp(value);
                  if (otpError) {
                    setOtpError("");
                  }
                  if (value.length === 6) {
                    requestAnimationFrame(() => verifyCode(value));
                  }
                }}
                otpInputRef={otpInputRef}
                otpVerified={otpVerified}
                otpSending={otpSending}
                otpVerifying={otpVerifying}
                otpError={otpError}
                otpShake={otpShake}
                onVerify={() => verifyCode()}
                onResend={() => handleSendCode(true)}
                cooldown={cooldown}
                onCancelCodeMode={handleCancelCodeMode}
              />

              <SignOutSection onAsk={handleAskSignOut} />
            </>
          )}

          {loading && (
            <div className="settings__loading">
              <span className="settings__loading-dot" aria-hidden="true" />
              Loading your settings…
            </div>
          )}
        </main>
      </div>

      {modal === "signout" && (
        <ConfirmModal
          which="signout"
          busy={signingOut}
          onConfirm={handleSignOut}
          onClose={closeModal}
        />
      )}

      {modal === "codeAsk" && (
        <ConfirmModal
          which="codeAsk"
          email={email}
          busy={false}
          onConfirm={() => handleSendCode(false)}
          onClose={closeModal}
        />
      )}
    </PageShell>
  );
}

export default Settings;
