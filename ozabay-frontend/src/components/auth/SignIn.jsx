import { useState } from "react";
import "./SignIn.css";

export default function SignIn({
  onSignIn,
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
    <>
      <p className="eyebrow">Your OzaBay</p>
      <h2>{recoveryMode ? <>Reset your <em>password.</em></> : <>Welcome <em>back.</em></>}</h2>
      {recoveryMode ? (
        <>
          <p className="signin-vendor-note">
            We’ll email a one-time code to your registered address. It expires after 10 minutes.
            Check your Gmail inbox and Spam folder.
          </p>
          <form className="order-form" onSubmit={handleRecoverySubmit}>
            <label>
              Email
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
                <label>
                  Reset code
                  <input
                    name="recoveryCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value)}
                    placeholder="6-digit code"
                  />
                </label>
                <label>
                  New password
                  <input
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 6 characters"
                  />
                </label>
              </>
            )}
            {error && <p role="alert">{error}</p>}
            {passwordHelp && <p role="status">{passwordHelp}</p>}
            <button className="hero-action" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait…"
                : recoveryStep === "email"
                  ? "Send reset code ↗"
                  : "Reset password ↗"}
            </button>
            {recoveryStep === "code" && (
              <button
                className="text-link signin-resend-code"
                type="button"
                onClick={handleResendCode}
                disabled={isSubmitting}
              >
                Send a new code
              </button>
            )}
          </form>
          <p>
            <button
              className="text-link"
              type="button"
              onClick={() => {
                setRecoveryMode(false);
                setError("");
                setPasswordHelp("");
              }}
            >
              Back to sign in
            </button>
          </p>
        </>
      ) : (
        <>
          <form className="order-form" onSubmit={handleSubmit}>
            <label>
              Email
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
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={6}
                required
                placeholder="Your password"
              />
            </label>
            <div className="signin-password-help">
              <button className="text-link" type="button" onClick={handleForgotPassword}>
                Forgot password?
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
            {passwordHelp && <p role="status">{passwordHelp}</p>}
            <button className="hero-action" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in ↗"}
            </button>
          </form>
          <p>
            New to OzaBay?{" "}
            <button className="text-link" type="button" onClick={onSignUp}>
              Create an account
            </button>
          </p>
          <p className="signin-vendor-note">
            Vendor accounts open the product studio after sign-in.
          </p>
        </>
      )}
    </>
  );
}
