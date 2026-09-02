export const RESET_HISTORY_STORAGE_PREFIX = "pulsewell:reset-history:v2:user:";

export function getUserHistoryKey(userId) {
  if (!userId) throw new Error("A user ID is required for authenticated RESET history.");
  return `${RESET_HISTORY_STORAGE_PREFIX}${userId}`;
}

export function readUserHistory(userId) {
  if (!userId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(getUserHistoryKey(userId)) || "null");
    const sessions = Array.isArray(parsed) ? parsed : parsed?.sessions;
    return Array.isArray(sessions) ? sessions : [];
  } catch (error) {
    console.error("Unable to read authenticated RESET history:", error);
    return [];
  }
}

export function writeUserHistory(userId, sessions) {
  localStorage.setItem(
    getUserHistoryKey(userId),
    JSON.stringify({ version: 2, sessions: Array.isArray(sessions) ? sessions : [] })
  );
}

export function upsertUserSession(userId, session) {
  const sessionId = session?.sessionId || session?.id;
  if (!sessionId) throw new Error("A session ID is required to save RESET history.");
  const existing = readUserHistory(userId);
  const updated = [
    ...existing.filter((item) => (item.sessionId || item.id) !== sessionId),
    { ...session, id: sessionId, sessionId }
  ];
  writeUserHistory(userId, updated);
  return updated;
}

export function updateUserSessionSyncStatus(userId, sessionId, syncStatus) {
  const updated = readUserHistory(userId).map((session) =>
    (session.sessionId || session.id) === sessionId
      ? { ...session, syncStatus }
      : session
  );
  writeUserHistory(userId, updated);
  return updated;
}
