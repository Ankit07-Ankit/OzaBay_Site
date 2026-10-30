import { useState } from "react";
import "./SignUp.css";

async function readResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Something went wrong. Please try again.");
  }
  return result;
}

export default function SignUp({ onSignUp, onSignIn, initialAccountType = "user" }) {
  const [accountType, setAccountType] = useState(initialAccountType);
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    accountType: initialAccountType,
  });
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setRegisterData((previous) => ({ ...previous, [name]: value }));
  };

  const handleAccountTypeChange = (event) => {
    const { value } = event.target;
    setAccountType(value);
    setRegisterData((previous) => ({ ...previous, accountType: value }));
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await readResponse(
        await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registerData),
        }),
      );
      setVerificationEmail(registerData.email.trim());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await readResponse(
        await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: verificationEmail,
            otp: verificationCode.trim(),
          }),
        }),
      );
      const loginResult = await readResponse(
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: verificationEmail,
            password: registerData.password,
          }),
        }),
      );
      onSignUp({ ...loginResult.user, accessToken: loginResult.accessToken });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verificationEmail) {
    return (
      <div className="signup">
        <p className="eyebrow">Your OzaBay</p>
        <h1 className="hero-title signup__title">Verify your email</h1>
        <p className="signup__intro">
          Enter the six-digit code sent to {verificationEmail}.
        </p>
        <form className="hero-form signup__form" onSubmit={handleVerifyEmail}>
          <label className="signup__field">
            Verification code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              placeholder="6-digit code"
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button
            type="submit"
            className="hero-action signup__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Verifying…" : "Verify email ↗"}
          </button>
        </form>
        <p className="signup__signin">
          Wrong email?{" "}
          <button
            className="text-link"
            type="button"
            onClick={() => {
              setVerificationEmail("");
              setVerificationCode("");
              setError("");
            }}
          >
            Back to sign up
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="signup">
      <p className="eyebrow">Your OzaBay</p>
      <h1 className="hero-title signup__title">
        Create your {accountType} account
      </h1>
      <p className="signup__intro">
        Choose how you’d like to be part of OzaBay.
      </p>
      <form className="hero-form signup__form" onSubmit={handleSignUp}>
        <fieldset className="signup__account-types">
          <legend>Account type</legend>
          <div className="signup__options">
            <label
              className={`signup__option ${accountType === "user" ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="accountType"
                value="user"
                checked={accountType === "user"}
                onChange={handleAccountTypeChange}
              />
              <span className="signup__radio" aria-hidden="true" />
              <span className="signup__option-copy">
                <strong>User account</strong>
                <small>Discover and save handmade pieces</small>
              </span>
            </label>
            <label
              className={`signup__option ${accountType === "vendor" ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="accountType"
                value="vendor"
                checked={accountType === "vendor"}
                onChange={handleAccountTypeChange}
              />
              <span className="signup__radio" aria-hidden="true" />
              <span className="signup__option-copy">
                <strong>Vendor account</strong>
                <small>Register products, media, prices and offers</small>
              </span>
            </label>
          </div>
        </fieldset>
        <label className="signup__field">
          Name
          <input
            onChange={handleInputChange}
            type="text"
            name="name"
            placeholder="Your name"
            value={registerData.name}
            minLength={3}
            maxLength={30}
            required
          />
        </label>
        <label className="signup__field">
          Email
          <input
            onChange={handleInputChange}
            type="email"
            name="email"
            placeholder="you@example.com"
            value={registerData.email}
            required
          />
        </label>
        <label className="signup__field">
          Password
          <input
            onChange={handleInputChange}
            type="password"
            name="password"
            placeholder="Create a password"
            value={registerData.password}
            minLength={6}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          type="submit"
          className="hero-action signup__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : `Create ${accountType} account ↗`}
        </button>
      </form>
      <p className="signup__signin">
        Already have an account?{" "}
        <button className="text-link" type="button" onClick={onSignIn}>
          Sign in
        </button>
      </p>
    </div>
  );
}
