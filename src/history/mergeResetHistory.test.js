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
