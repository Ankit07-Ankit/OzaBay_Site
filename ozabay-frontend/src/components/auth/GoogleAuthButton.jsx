import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../../utils/api.js";
import "./GoogleAuthButton.css";

let googleScriptPromise;

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        googleScriptPromise = undefined;
        reject(new Error("Unable to load Google sign-in. Check your connection."));
      };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
};

export default function GoogleAuthButton({ onAuthenticated, mode = "signin" }) {
  const buttonContainer = useRef(null);
  const onAuthenticatedRef = useRef(onAuthenticated);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  onAuthenticatedRef.current = onAuthenticated;

  useEffect(() => {
    let active = true;
    const handleCredential = async (credential) => {
      setError("");
      setIsSubmitting(true);
      try {
        const response = await fetch(apiUrl("/api/auth/google"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ credential }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Unable to sign in with Google.");
        }
        onAuthenticatedRef.current({
          ...result.user,
          accessToken: result.accessToken,
        });
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setIsSubmitting(false);
      }
    };

    fetch(apiUrl("/api/auth/google/client-id"))
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.clientId) {
          throw new Error(
            result.message || "Google sign-in is not configured on the server.",
          );
        }
        return result.clientId;
      })
      .then((clientId) => loadGoogleIdentity().then(() => clientId))
      .then((clientId) => {
        if (!active) return;
        const googleIdentity = window.google?.accounts?.id;
        if (!googleIdentity) {
          throw new Error("Google sign-in could not be initialized.");
        }
        googleIdentity.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (credential) void handleCredential(credential);
            else setError("Google did not return a sign-in credential.");
          },
        });
        const width = Math.min(Math.max(buttonContainer.current?.clientWidth || 300, 240), 400);
        googleIdentity.renderButton(buttonContainer.current, {
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
          width,
        });
        setIsReady(true);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
      buttonContainer.current?.replaceChildren();
    };
  }, [mode]);

  return (
    <div className={`google-auth${isSubmitting ? " google-auth--busy" : ""}`}>
      {!isReady && (
        <button className="google-auth__placeholder" type="button" disabled>
          {error
            ? "Google sign-in unavailable"
            : mode === "signup"
              ? "Create account with Google"
              : "Sign in with Google"}
        </button>
      )}
      <div className="google-auth__button" ref={buttonContainer} />
      {isSubmitting && (
        <p className="google-auth__status" role="status">
          Signing in with Google…
        </p>
      )}
      {error && (
        <p className="google-auth__status google-auth__status--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
