import { supabase } from "../supabaseClient";
import {
  fetchUserSessions,
  insertUserSession,
  normalizeStressValue,
  toCloudPayload
} from "./sessionResultsRepository";

jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }));

beforeEach(() => {
  supabase.from.mockReset();
  supabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: "user-a" }, access_token: "mock-token" } }, error: null });
});

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

test.each(['craving_reset', 'acupressure_reset', 'grounding_reset', undefined])('persists %s with owned ratings and legacy compatibility', async (type) => {
  const insert = jest.fn().mockResolvedValue({ error: null });
  supabase.from.mockReturnValue({ insert });
  await insertUserSession('user-a', { sessionId: 'id', interventionType: type, beforeScore: 8, afterScore: 2, anxietyBefore: 7, anxietyAfter: 3 });
  expect(insert).toHaveBeenCalledWith([expect.objectContaining({ intervention_type: type || 'craving_reset', user_id: 'user-a', craving_before: 8, craving_after: 2, stress_before: 7, stress_after: 3, stress_level: 3 })]);
});

test.each([
  [undefined, undefined, null, null],
  [null, null, null, null],
  [0, false, 0, false],
  [12.345, false, 12.345, false],
  [120, true, 120, true]
])('saves duration %s and completion %s without changing ratings or ownership', async (duration, completed, expectedDuration, expectedCompleted) => {
  const insert = jest.fn().mockResolvedValue({ error: null });
  supabase.from.mockReturnValue({ insert });
  await insertUserSession('user-a', { sessionId: 'metadata', interventionType: 'acupressure_reset', activeDurationSeconds: duration, guidedSequenceCompleted: completed, beforeScore: 7, afterScore: 3, anxietyBefore: 6, anxietyAfter: 2 });
  expect(insert).toHaveBeenCalledWith([expect.objectContaining({ user_id: 'user-a', session_id: 'metadata', intervention_type: 'acupressure_reset', craving_before: 7, craving_after: 3, stress_before: 6, stress_after: 2, active_duration_seconds: expectedDuration, guided_sequence_completed: expectedCompleted })]);
});

test('invalid metadata is rejected before any Supabase call', async () => {
  await expect(insertUserSession('user-a', { sessionId: 'bad', activeDurationSeconds: Infinity })).rejects.toThrow(/finite/);
  await expect(insertUserSession('user-a', { sessionId: 'bad', guidedSequenceCompleted: 'false' })).rejects.toThrow(/boolean/);
  expect(supabase.from).not.toHaveBeenCalled();
});

test('history explicitly requests both metadata fields with the existing ownership filter', async () => {
  const range = jest.fn().mockResolvedValue({ data: [], error: null });
  const eq = jest.fn(() => ({ order: () => ({ range }) }));
  const select = jest.fn(() => ({ eq }));
  supabase.from.mockReturnValue({ select });
  await fetchUserSessions('user-a');
  expect(select.mock.calls[0][0].split(',')).toEqual(expect.arrayContaining(['active_duration_seconds', 'guided_sequence_completed', 'intervention_type', 'stress_before', 'stress_after']));
  expect(eq).toHaveBeenCalledWith('user_id', 'user-a');
});

test.each([null, undefined, ''])('missing user %s cannot start authentication or insert calls', async (userId) => {
  await expect(insertUserSession(userId, { sessionId: 'blocked' })).rejects.toThrow(/Authentication/);
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
  expect(supabase.from).not.toHaveBeenCalled();
});

test.each([null, { user: { id: 'user-b' }, access_token: 'mock' }, { user: { id: 'user-a' } }])('missing or changed auth session blocks inserts', async (session) => {
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
  await expect(insertUserSession('user-a', { sessionId: 'blocked', ownerUserId: 'user-a' })).rejects.toThrow(/original user/);
  expect(supabase.from).not.toHaveBeenCalled();
});

test('a session cannot be reassigned even when the destination account is signed in', async () => {
  await expect(insertUserSession('user-a', { sessionId: 'blocked', ownerUserId: 'user-b' })).rejects.toThrow(/original user/);
  expect(supabase.from).not.toHaveBeenCalled();
});

test('failed authentication refresh never falls back to anonymous insert', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('refresh failed') });
  await expect(insertUserSession('user-a', { sessionId: 'blocked' })).rejects.toThrow('refresh failed');
  expect(supabase.from).not.toHaveBeenCalled();
});

test('a token that remains expired after getSession cannot be used for an insert', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' }, access_token: 'expired-mock', expires_at: 1 } }, error: null });
  await expect(insertUserSession('user-a', { sessionId: 'expired' })).rejects.toThrow(/expired/);
  expect(supabase.from).not.toHaveBeenCalled();
});
