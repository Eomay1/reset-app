import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function AccountPage() {
  const { user, signOut, entitlement, effectiveStatus } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSignOut = async () => {
    setSubmitting(true);
    setError("");
    try {
      await signOut();
      navigate("/start", { replace: true });
    } catch (signOutError) {
      setError(signOutError.message || "Unable to sign out. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card account-card">
        <p className="home-eyebrow">RESET account</p>
        <h1>Account</h1>
        <dl>
          <div><dt>Email</dt><dd>{user?.email}</dd></div>
          <div className="account-debug-id"><dt>Account ID</dt><dd>{user?.id}</dd></div>
          <div><dt>RESET access</dt><dd>{effectiveStatus?.replaceAll("_", " ")}</dd></div>
          {entitlement?.trialEndsAt && (
            <div><dt>Trial ends</dt><dd>{new Date(entitlement.trialEndsAt).toLocaleString()}</dd></div>
          )}
        </dl>
        {error && <p role="alert" className="auth-error">{error}</p>}
        <div className="account-actions">
          <Link to="/history">History</Link>
          <Link to="/app">Return to RESET</Link>
          <button type="button" onClick={handleSignOut} disabled={submitting}>{submitting ? "Signing out…" : "Sign out"}</button>
        </div>
      </section>
    </main>
  );
}
