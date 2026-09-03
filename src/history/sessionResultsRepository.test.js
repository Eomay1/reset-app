import { supabase } from "../supabaseClient";
import {
  fetchUserSessions,
  insertUserSession,
  normalizeStressValue,
  toCloudPayload
} from "./sessionResultsRepository";

jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));

beforeEach(() => supabase.from.mockReset());

test("fetches only the authenticated user's ordered history", async () => {
  const range = jest.fn().mockResolvedValue({ data: [{ session_id: "one" }], error: null });
  const order = jest.fn(() => ({ range }));
  const eq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq }));
  supabase.from.mockReturnValue({ select });

  await expect(fetchUserSessions("user-a")).resolves.toEqual([{ session_id: "one" }]);
  expect(supabase.from).toHaveBeenCalledWith("session_results");
  expect(eq).toHaveBeenCalledWith("user_id", "user-a");
  expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  expect(range).toHaveBeenCalledWith(0, 999);
});

test("builds an owned payload and confirms the same owned ID after a duplicate", async () => {
  const insert = jest.fn().mockResolvedValue({ error: { code: "23505" } });
  const maybeSingle = jest.fn().mockResolvedValue({ data: { session_id: "same-id" }, error: null });
  const secondEq = jest.fn(() => ({ maybeSingle }));
  const firstEq = jest.fn(() => ({ eq: secondEq }));
  const select = jest.fn(() => ({ eq: firstEq }));
  supabase.from.mockReturnValue({ insert, select });
  const session = {
    sessionId: "same-id", beforeScore: 8, afterScore: 3,
    anxietyBefore: 7, anxietyAfter: 4, completedAt: "2026-09-02T00:00:00Z",
    deviceId: "device-one"
  };

  await expect(insertUserSession("user-a", session)).resolves.toBeUndefined();
  expect(insert).toHaveBeenCalledWith([expect.objectContaining({
    session_id: "same-id", user_id: "user-a", craving_before: 8, stress_after: 4
  })]);
  expect(firstEq).toHaveBeenCalledWith("user_id", "user-a");
  expect(secondEq).toHaveBeenCalledWith("session_id", "same-id");
  expect(toCloudPayload(session, "user-a").session_id).toBe("same-id");
});

test("does not accept an unconfirmed duplicate as a successful sync", async () => {
  const duplicate = { code: "23505" };
  const insert = jest.fn().mockResolvedValue({ error: duplicate });
  const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const select = jest.fn(() => ({
    eq: () => ({ eq: () => ({ maybeSingle }) })
  }));
  supabase.from.mockReturnValue({ insert, select });

  await expect(insertUserSession("user-a", { sessionId: "unknown" })).rejects.toBe(duplicate);
});

test("normalizes database-compatible stress values centrally", () => {
  expect(normalizeStressValue(1)).toBe(1);
  expect(normalizeStressValue(10)).toBe(10);
  expect(normalizeStressValue(null)).toBeNull();
  expect(normalizeStressValue(undefined)).toBeNull();
  expect(normalizeStressValue(0)).toBeNull();

  ["5", Number.NaN, 1.5, -1, 11].forEach((value) => {
    expect(() => normalizeStressValue(value)).toThrow(/integer from 1 to 10/);
  });
});

test("legacy zero stress retries with null fields and the original session ID", async () => {
  const insert = jest.fn().mockResolvedValue({ error: null });
  supabase.from.mockReturnValue({ insert });

  await insertUserSession("user-a", {
    sessionId: "original-session-id",
    anxietyBefore: 0,
    anxietyAfter: 0
  });

  expect(insert).toHaveBeenCalledWith([expect.objectContaining({
    session_id: "original-session-id",
    stress_before: null,
    stress_after: null,
    stress_level: null
  })]);
});

test("invalid stress fails before Supabase insert is called", async () => {
  const insert = jest.fn();
  supabase.from.mockReturnValue({ insert });

  await expect(insertUserSession("user-a", {
    sessionId: "invalid-stress",
    anxietyBefore: "5",
    anxietyAfter: 4
  })).rejects.toThrow(/stress_before/);
  expect(insert).not.toHaveBeenCalled();
});
