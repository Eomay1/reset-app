import { supabase } from "../supabaseClient";

const SELECT_COLUMNS = [
  "session_id", "craving_before", "craving_after", "stress_before",
  "stress_after", "stress_level", "mood", "device_id",
  "client_completed_at", "created_at", "intervention_type", "user_id"
].join(",");

const PAGE_SIZE = 1000;

export function normalizeStressValue(value, fieldName = "stress") {
  if (value === null || value === undefined || value === 0) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    throw new TypeError(`${fieldName} must be null or an integer from 1 to 10.`);
  }
  return value;
}

export function toCloudPayload(session, userId) {
  const stressBefore = normalizeStressValue(session.anxietyBefore, "stress_before");
  const stressAfter = normalizeStressValue(session.anxietyAfter, "stress_after");
  return {
    session_id: session.sessionId || session.id,
    craving_before: session.beforeScore,
    craving_after: session.afterScore,
    stress_before: stressBefore,
    stress_after: stressAfter,
    stress_level: stressAfter,
    mood: session.mood || null,
    source: "pulsewell_mvp",
    device_id: session.deviceId,
    client_completed_at: session.completedAt,
    intervention_type: "craving_reset",
    user_id: userId
  };
}

export async function fetchUserSessions(userId) {
  const rows = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("session_results")
      .select(SELECT_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function insertUserSession(userId, session) {
  const { error } = await supabase
    .from("session_results")
    .insert([toCloudPayload(session, userId)]);
  if (!error) return;
  if (error.code !== "23505") throw error;

  const { data: existing, error: lookupError } = await supabase
    .from("session_results")
    .select("session_id")
    .eq("user_id", userId)
    .eq("session_id", session.sessionId || session.id)
    .maybeSingle();
  if (lookupError || !existing) throw lookupError || error;
}
