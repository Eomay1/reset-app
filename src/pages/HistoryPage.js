import { interventionLabel } from "../interventions/interventionTypes";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import useAuthenticatedResetHistory from "../history/useAuthenticatedResetHistory";

export default function HistoryPage() {
  const { user } = useAuth();
  const { sessions, loading, error, retrySession } = useAuthenticatedResetHistory(user?.id ?? null);
  const [retrying, setRetrying] = useState(null);
  const [retryError, setRetryError] = useState(null);
  const retry = async (sessionId) => {
    setRetrying(sessionId);
    setRetryError(null);
    try {
      await retrySession(sessionId);
    } catch (error) {
      setRetryError("Unable to save. Sign in again as the original user and retry. Your measurements remain on this device.");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="home-eyebrow">Your RESET history</p>
        <h1>History</h1>
        {loading && <p role="status">Loading your RESET history…</p>}
        {error && <p role="alert">Cloud history is unavailable. Showing saved history from this device.</p>}
        {retryError && <p role="alert">{retryError}</p>}
        {!loading && sessions.length === 0 && <p>No completed RESET sessions yet.</p>}
        {sessions.length > 0 && (
          <ol className="history-list">
            {sessions.map((session) => (
              <li key={session.sessionId || session.id}>
                <strong>{session.date || session.completedAt || "Completed RESET"}</strong>
                <span>{interventionLabel(session.interventionType)}</span>
                <span>Craving: {session.beforeScore ?? "—"} → {session.afterScore ?? "—"}</span>
                <span>Anxiety: {session.anxietyBefore ?? "—"} → {session.anxietyAfter ?? "—"}</span>
                {Number.isFinite(session.activeDurationSeconds) && <small>Active exercise time: {session.activeDurationSeconds} seconds ({session.activeDurationSource === "cloud" ? "synced" : "this device only"})</small>}
                {typeof session.guidedSequenceCompleted === "boolean" && <small>{session.guidedSequenceCompleted ? "Full guided sequence completed" : "Finished before the full guided sequence"} ({session.guidedSequenceSource === "cloud" ? "synced" : "this device only"})</small>}
                {session.syncStatus !== "synced" && <small>Cloud sync: {session.syncStatus}</small>}
                {["pending", "failed"].includes(session.syncStatus) && <button disabled={retrying !== null} onClick={() => retry(session.sessionId || session.id)}>{retrying === (session.sessionId || session.id) ? "Saving…" : "Retry save"}</button>}
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
