import { useCallback, useEffect, useRef, useState } from "react";
import { mergeResetHistory } from "./mergeResetHistory";
import { fetchUserSessions, insertUserSession } from "./sessionResultsRepository";
import {
  readUserHistory,
  updateUserSessionSyncStatus,
  upsertUserSession,
  writeUserHistory
} from "./resetHistoryStorage";

export default function useAuthenticatedResetHistory(userId) {
  const [history, setHistory] = useState({ userId: null, sessions: [] });
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const requestVersion = useRef(0);
  const activeUserId = useRef(userId);
  activeUserId.current = userId;

  useEffect(() => {
    const version = ++requestVersion.current;
    setHistory({ userId, sessions: [] });
    setError(null);
    if (!userId) {
      setLoading(false);
      return undefined;
    }

    const localSessions = readUserHistory(userId);
    setHistory({ userId, sessions: localSessions });
    setLoading(true);

    fetchUserSessions(userId).then((cloudRows) => {
      if (version !== requestVersion.current) return;
      const merged = mergeResetHistory(readUserHistory(userId), cloudRows);
      writeUserHistory(userId, merged);
      setHistory({ userId, sessions: merged });
      setLoading(false);
    }).catch((fetchError) => {
      if (version !== requestVersion.current) return;
      console.error("Unable to load authenticated RESET history:", fetchError);
      setError(fetchError);
      setLoading(false);
    });

    return () => {
      if (version === requestVersion.current) requestVersion.current += 1;
    };
  }, [userId]);

  const savePendingSession = useCallback((session) => {
    if (!userId) throw new Error("Authentication is required to save RESET history.");
    const updated = upsertUserSession(userId, { ...session, syncStatus: "pending" });
    setHistory({ userId, sessions: updated });
    return updated;
  }, [userId]);

  const syncSession = useCallback(async (session) => {
    if (!userId) throw new Error("Authentication is required to sync RESET history.");
    try {
      await insertUserSession(userId, session);
      const updated = updateUserSessionSyncStatus(userId, session.sessionId || session.id, "synced");
      if (activeUserId.current === userId) setHistory({ userId, sessions: updated });
      return "synced";
    } catch (syncError) {
      const updated = updateUserSessionSyncStatus(userId, session.sessionId || session.id, "failed");
      if (activeUserId.current === userId) setHistory({ userId, sessions: updated });
      throw syncError;
    }
  }, [userId]);

  const retrySession = useCallback(async (sessionId) => {
    const session = readUserHistory(userId).find(
      (item) => (item.sessionId || item.id) === sessionId
    );
    if (!session) return false;
    await syncSession(session);
    return true;
  }, [syncSession, userId]);

  const sessions = history.userId === userId ? history.sessions : [];
  return { sessions, loading, error, savePendingSession, syncSession, retrySession };
}
