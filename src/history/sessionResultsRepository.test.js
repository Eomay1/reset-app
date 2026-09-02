import { supabase } from "../supabaseClient";
import { fetchUserSessions, insertUserSession, toCloudPayload } from "./sessionResultsRepository";

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
