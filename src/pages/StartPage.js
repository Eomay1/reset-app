import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function StartPage() {
  const { user, loading, signInWithOtp, verifyOtp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => sessionStorage.getItem("reset_auth_email") || "");
  const [token, setToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (location.pathname === "/auth/confirm" && email) setCodeSent(true);
  }, [email, location.pathname]);

  if (!loading && user) return <Navigate to="/app" replace />;

  const requestCode = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    setMessage("");
    try {
      await signInWithOtp(email.trim());
      sessionStorage.setItem("reset_auth_email", email.trim());
      setCodeSent(true);
      setMessage("We sent a six-digit sign-in code to your email.");
    } catch (error) {
      setFormError(error.message || "Unable to send a sign-in code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCode = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await verifyOtp(email.trim(), token.trim());
      sessionStorage.removeItem("reset_auth_email");
      navigate(location.state?.from || "/app", { replace: true });
    } catch (error) {
      setFormError(error.message || "That code is invalid or expired. Request a new code and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="home-eyebrow">Wellness &amp; recovery</p>
        <h1>RESET</h1>
        <h2>{codeSent ? "Enter your sign-in code" : "Sign in to continue"}</h2>
        <p>No password is needed. We’ll email you a one-time code.</p>

        {!codeSent ? (
          <form onSubmit={requestCode} className="auth-form">
            <label htmlFor="auth-email">Email address</label>
            <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Email me a code"}</button>
          </form>
        ) : (
          <form onSubmit={confirmCode} className="auth-form">
            <label htmlFor="auth-code">Six-digit code</label>
            <input id="auth-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))} />
            <button type="submit" disabled={submitting || token.length !== 6}>{submitting ? "Checking…" : "Continue to RESET"}</button>
            <button type="button" className="auth-secondary-button" disabled={submitting} onClick={requestCode}>Send a new code</button>
            <button type="button" className="auth-link-button" onClick={() => { setCodeSent(false); setToken(""); setMessage(""); setFormError(""); }}>Use a different email</button>
          </form>
        )}

        {message && <p role="status" className="auth-message">{message}</p>}
        {formError && <p role="alert" className="auth-error">{formError}</p>}
      </section>
    </main>
  );
}
