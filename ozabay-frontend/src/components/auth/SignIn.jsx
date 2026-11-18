import { useState } from "react";
import GoogleAuthButton from "./GoogleAuthButton.jsx";
import "./SignIn.css";

export default function SignIn({
  onSignIn,
  onGoogleSignIn,
  onSignUp,
  onRequestPasswordReset,
  onResetPassword,
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [passwordHelp, setPasswordHelp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState("email");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setPasswordHelp("");
    setIsSubmitting(true);
    try {
      await onSignIn({
        email,
        password: event.currentTarget.elements.password.value,
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setRecoveryEmail(email);
    setRecoveryStep("email");
    setError("");
    setPasswordHelp("");
    setRecoveryMode(true);
  };

  const handleRecoverySubmit = async (event) => {
    event.preventDefault();
    setError("");
    setPasswordHelp("");
    setIsSubmitting(true);
    try {
      if (recoveryStep === "email") {
        const result = await onRequestPasswordReset(recoveryEmail);
        setRecoveryStep("code");
        setPasswordHelp(result.message);
      } else {
        const result = await onResetPassword({
          email: recoveryEmail,
          otp: recoveryCode.trim(),
          password: newPassword,
        });
        setRecoveryMode(false);
        setRecoveryStep("email");
        setRecoveryCode("");
        setNewPassword("");
        setEmail(recoveryEmail);
        setPasswordHelp(result.message);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setPasswordHelp("");
    setIsSubmitting(true);
    try {
      const result = await onRequestPasswordReset(recoveryEmail);
      setPasswordHelp(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signin">
      <div className="signin__header">
        <p className="signin__eyebrow">Your OzaBay</p>
        <h2 className="signin__title">
          {recoveryMode ? (
            <>
              Reset your <em>password</em>
            </>
          ) : (
            <>
              Welcome <em>back</em>
            </>
          )}
        </h2>
        <p className="signin__subtitle">
          {recoveryMode
            ? "Verify your email and choose a new password."
            : "Sign in to continue to your account, bag, and orders."}
        </p>
      </div>

      {recoveryMode ? (
        <>
          <div className="signin__notice">
            We’ll email a one-time code to your registered address. It expires in 10 minutes.
          </div>
          <form className="signin__form" onSubmit={handleRecoverySubmit}>
            <label className="signin__field">
              <span>Email address</span>
              <input
                name="recoveryEmail"
                type="email"
                autoComplete="email"
                required
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {recoveryStep === "code" && (
              <>
                <label className="signin__field">
                  <span>Verification code</span>
                  <input
                    name="recoveryCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={recoveryCode}
                    onChange={(event) =>
                      setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit code"
                    className="signin__otp"
                  />
                </label>
                <label className="signin__field">
                  <span>New password</span>
                  <div className="signin__password-wrap">
                    <input
                      name="newPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={6}
                      required
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="At least 6 characters"
                    />
                    <button
                      type="button"
                      className="signin__password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              </>
            )}
            {error && (
              <p className="signin__status signin__status--error" role="alert">
                {error}
              </p>
            )}
            {passwordHelp && (
              <p className="signin__status signin__status--ok" role="status">
                {passwordHelp}
              </p>
            )}
            <button className="signin__submit" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait…"
                : recoveryStep === "email"
                  ? "Send reset code"
                  : "Reset password"}
              {!isSubmitting && <span aria-hidden="true"> ↗</span>}
            </button>
            {recoveryStep === "code" && (
              <button
                className="signin__link-btn"
                type="button"
                onClick={handleResendCode}
                disabled={isSubmitting}
              >
                Send a new code
              </button>
            )}
          </form>
          <p className="signin__footer">
            <button
              className="signin__link-btn"
              type="button"
              onClick={() => {
                setRecoveryMode(false);
                setError("");
                setPasswordHelp("");
                setShowPassword(false);
              }}
            >
              ← Back to sign in
            </button>
          </p>
        </>
      ) : (
        <>
          <form className="signin__form" onSubmit={handleSubmit}>
            <label className="signin__field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="signin__field">
              <span>Password</span>
              <div className="signin__password-wrap">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  minLength={6}
                  required
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className="signin__password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <div className="signin__row">
              <button className="signin__link-btn" type="button" onClick={handleForgotPassword}>
                Forgot password?
              </button>
            </div>
            {error && (
              <p className="signin__status signin__status--error" role="alert">
                {error}
              </p>
            )}
            {passwordHelp && (
              <p className="signin__status signin__status--ok" role="status">
                {passwordHelp}
              </p>
            )}
            <button className="signin__submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
              {!isSubmitting && <span aria-hidden="true"> ↗</span>}
            </button>
          </form>
          <div className="signin__divider" aria-hidden="true">
            <span>or</span>
          </div>
          <GoogleAuthButton onAuthenticated={onGoogleSignIn} mode="signin" />
          <p className="signin__footer">
            New to OzaBay?{" "}
            <button className="signin__link-btn signin__link-btn--strong" type="button" onClick={onSignUp}>
              Create an account
            </button>
          </p>
          <p className="signin__vendor-note">Vendor accounts open the product studio after sign-in.</p>
        </>
      )}
    </div>
  );
}
