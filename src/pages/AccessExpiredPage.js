import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

function formatTrialEnd(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export default function AccessExpiredPage() {
  const { entitlement } = useAuth();
  const trialEnd = formatTrialEnd(entitlement?.trialEndsAt);

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="home-eyebrow">RESET access</p>
        <h1>Active RESET access has ended</h1>
        <p>You can still review your saved RESET history and manage your account.</p>
        {trialEnd && <p>Your trial ended on <strong>{trialEnd}</strong>.</p>}
        <div className="account-actions">
          <Link to="/history">View History</Link>
          <Link to="/account">Account</Link>
        </div>
      </section>
    </main>
  );
}
