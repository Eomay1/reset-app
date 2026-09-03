import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import useAuthenticatedResetHistory from "../history/useAuthenticatedResetHistory";

export default function HistoryPage() {
  const { user } = useAuth();
  const { sessions, loading, error } = useAuthenticatedResetHistory(user?.id ?? null);

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="home-eyebrow">Your RESET history</p>
        <h1>History</h1>
        {loading && <p role="status">Loading your RESET history…</p>}
        {error && <p role="alert">Cloud history is unavailable. Showing saved history from this device.</p>}
        {!loading && sessions.length === 0 && <p>No completed RESET sessions yet.</p>}
        {sessions.length > 0 && (
          <ol className="history-list">
            {sessions.map((session) => (
              <li key={session.sessionId || session.id}>
                <strong>{session.date || session.completedAt || "Completed RESET"}</strong>
                <span>Craving: {session.beforeScore ?? "—"} → {session.afterScore ?? "—"}</span>
                <span>Anxiety: {session.anxietyBefore ?? "—"} → {session.anxietyAfter ?? "—"}</span>
                {session.syncStatus !== "synced" && <small>Cloud sync: {session.syncStatus}</small>}
              </li>
            ))}
          </ol>
        )}
        <div className="account-actions">
          <Link to="/account">Account</Link>
          <Link to="/app">Return to RESET</Link>
        </div>
      </section>
    </main>
  );
}
