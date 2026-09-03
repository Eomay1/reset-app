import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { EFFECTIVE_STATUSES } from "../entitlements/entitlementState";

export default function EntitlementRoute({ children }) {
  const {
    entitlementLoading,
    entitlementError,
    hasAccess,
    effectiveStatus,
    refreshEntitlement
  } = useAuth();

  if (entitlementLoading && !hasAccess) {
    return <main className="auth-screen"><p role="status">Checking your RESET access…</p></main>;
  }

  if (entitlementError || effectiveStatus === EFFECTIVE_STATUSES.UNAVAILABLE) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>Unable to check access</h1>
          <p role="alert">We couldn’t verify your RESET access. Your account is still signed in.</p>
          <button type="button" onClick={() => refreshEntitlement().catch(() => {})}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!hasAccess) return <Navigate to="/access-expired" replace />;
  return children;
}
