export function getSessionId(session) {
  return session?.sessionId || session?.id || session?.session_id || null;
}

export function fromCloudSession(row) {
  const sessionId = row?.session_id;
  if (!sessionId) return null;
  const completedAt = row.client_completed_at || row.created_at || null;
  const beforeScore = row.craving_before;
  const afterScore = row.craving_after;
  const anxietyBefore = row.stress_before;
  const anxietyAfter = row.stress_after;
  return {
    id: sessionId,
    sessionId,
    date: completedAt ? new Date(completedAt).toLocaleString() : null,
    completedAt,
    createdAt: row.created_at || null,
    interventionType: row.intervention_type,
    beforeScore,
    afterScore,
    reduction: Number.isFinite(beforeScore) && Number.isFinite(afterScore)
      ? beforeScore - afterScore
      : null,
    mood: row.mood ?? null,
    stressLevel: row.stress_level,
    anxietyBefore,
    anxietyAfter,
    anxietyReduction: Number.isFinite(anxietyBefore) && Number.isFinite(anxietyAfter)
      ? anxietyBefore - anxietyAfter
      : null,
    deviceId: row.device_id,
    syncStatus: "synced"
  };
}

function timestamp(session) {
  const value = session?.completedAt || session?.createdAt;
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mergeResetHistory(localSessions, cloudRows) {
  const merged = new Map();

  (Array.isArray(localSessions) ? localSessions : []).forEach((session) => {
    const sessionId = getSessionId(session);
    if (!sessionId) return;
    merged.set(sessionId, { ...session, id: sessionId, sessionId });
  });

  (Array.isArray(cloudRows) ? cloudRows : []).forEach((row) => {
    const cloudSession = fromCloudSession(row);
    if (!cloudSession) return;
    const localSession = merged.get(cloudSession.sessionId);
    // Local-only metadata is retained; canonical database fields overwrite it.
    merged.set(cloudSession.sessionId, { ...localSession, ...cloudSession });
  });

  return [...merged.values()].sort((left, right) => {
    const timeDifference = timestamp(right) - timestamp(left);
    return timeDifference || getSessionId(left).localeCompare(getSessionId(right));
  });
}
