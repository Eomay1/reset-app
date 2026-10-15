import { mergeResetHistory } from "./mergeResetHistory";

const cloud = (overrides = {}) => ({
  session_id: "shared", craving_before: 8, craving_after: 3,
  stress_before: 7, stress_after: 4, stress_level: 4,
  mood: "Good", device_id: "cloud-device",
  client_completed_at: "2026-09-02T12:00:00.000Z",
  created_at: "2026-09-02T12:01:00.000Z",
  intervention_type: "craving_reset", user_id: "user-a", ...overrides
});

test("cloud is canonical for matching IDs while preserving local-only metadata", () => {
  const result = mergeResetHistory([
    { sessionId: "shared", beforeScore: 1, selectedAction: "Call sponsor", syncStatus: "failed" }
  ], [cloud()]);

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual(expect.objectContaining({
    sessionId: "shared", beforeScore: 8, syncStatus: "synced",
    selectedAction: "Call sponsor", reduction: 5
  }));
});

test("retains local-only pending and failed rows and dedupes cloud IDs", () => {
  const result = mergeResetHistory([
    { sessionId: "pending", syncStatus: "pending", completedAt: "2026-09-03T00:00:00Z" },
    { sessionId: "failed", syncStatus: "failed", completedAt: "2026-09-01T00:00:00Z" }
  ], [cloud(), cloud({ craving_after: 2 })]);

  expect(result).toHaveLength(3);
  expect(result.find((row) => row.sessionId === "pending").syncStatus).toBe("pending");
  expect(result.find((row) => row.sessionId === "failed").syncStatus).toBe("failed");
  expect(result.find((row) => row.sessionId === "shared").afterScore).toBe(2);
});

test('all intervention types round-trip with ratings while legacy and unknown records remain readable', () => {
  const types = ['craving_reset', 'acupressure_reset', 'grounding_reset', null, 'old-custom-type'];
  const rows = types.map((type, index) => cloud({ session_id: `id-${index}`, intervention_type: type }));
  const sessions = mergeResetHistory([], rows);
  expect(sessions).toHaveLength(5);
  for (const [index, type] of types.entries()) {
    expect(sessions.find((session) => session.id === `id-${index}`)).toMatchObject({ interventionType: type, beforeScore: 8, afterScore: 3, anxietyBefore: 7, anxietyAfter: 4 });
  }
});

test('local active time and partial protocol status survive cloud merge without backfilling historical sessions', () => {
  const merged = mergeResetHistory([
    { sessionId: 'partial', activeDurationSeconds: 12.5, guidedSequenceCompleted: false }
  ], [cloud({ session_id: 'partial', intervention_type: 'acupressure_reset' }), cloud({ session_id: 'legacy' })]);
  expect(merged.find(row => row.sessionId === 'partial')).toMatchObject({ activeDurationSeconds: 12.5, guidedSequenceCompleted: false });
  expect(merged.find(row => row.sessionId === 'legacy').activeDurationSeconds).toBeNull();
  expect(merged.find(row => row.sessionId === 'legacy').guidedSequenceCompleted).toBeNull();
});

test('a fresh device retrieves duration and false protocol completion entirely from cloud', () => {
  const rows = mergeResetHistory([], [cloud({ intervention_type: 'acupressure_reset', active_duration_seconds: 0, guided_sequence_completed: false })]);
  expect(rows[0]).toMatchObject({ activeDurationSeconds: 0, activeDurationSource: 'cloud', guidedSequenceCompleted: false, guidedSequenceSource: 'cloud', beforeScore: 8, afterScore: 3, anxietyBefore: 7, anxietyAfter: 4 });
});

test('old cloud rows with explicit null metadata remain unknown on a fresh device', () => {
  const [row] = mergeResetHistory([], [cloud({ active_duration_seconds: null, guided_sequence_completed: null })]);
  expect(row.activeDurationSeconds).toBeNull();
  expect(row.guidedSequenceCompleted).toBeNull();
  expect(row.activeDurationSource).toBeNull();
});
