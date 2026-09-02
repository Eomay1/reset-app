import { act, renderHook, waitFor } from "@testing-library/react";
import useAuthenticatedResetHistory from "./useAuthenticatedResetHistory";
import { readUserHistory, upsertUserSession } from "./resetHistoryStorage";
import { fetchUserSessions, insertUserSession } from "./sessionResultsRepository";

jest.mock("./sessionResultsRepository", () => ({
  fetchUserSessions: jest.fn(),
  insertUserSession: jest.fn()
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  localStorage.clear();
  fetchUserSessions.mockReset().mockResolvedValue([]);
  insertUserSession.mockReset().mockResolvedValue(undefined);
});

test("falls back to the current user's cache when cloud fetch fails", async () => {
  upsertUserSession("user-a", { sessionId: "local", syncStatus: "failed" });
  fetchUserSessions.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useAuthenticatedResetHistory("user-a"));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.sessions).toEqual([expect.objectContaining({ sessionId: "local" })]);
  expect(result.current.error.message).toBe("offline");
});

test("ignores a stale User A response after switching to User B", async () => {
  const userARequest = deferred();
  fetchUserSessions
    .mockReturnValueOnce(userARequest.promise)
    .mockResolvedValueOnce([{ session_id: "b-cloud", client_completed_at: "2026-09-02T00:00:00Z" }]);
  const { result, rerender } = renderHook(
    ({ userId }) => useAuthenticatedResetHistory(userId),
    { initialProps: { userId: "user-a" } }
  );

  rerender({ userId: "user-b" });
  await waitFor(() => expect(result.current.sessions[0]?.sessionId).toBe("b-cloud"));
  await act(async () => userARequest.resolve([
    { session_id: "a-cloud", client_completed_at: "2026-09-03T00:00:00Z" }
  ]));
  expect(result.current.sessions.map((row) => row.sessionId)).toEqual(["b-cloud"]);
});

test("writes pending locally before cloud resolves and retry reuses the UUID", async () => {
  const insertRequest = deferred();
  insertUserSession.mockReturnValueOnce(insertRequest.promise).mockResolvedValueOnce(undefined);
  const { result } = renderHook(() => useAuthenticatedResetHistory("user-a"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  const session = { sessionId: "same-uuid", beforeScore: 8, syncStatus: "pending" };

  act(() => result.current.savePendingSession(session));
  let syncPromise;
  act(() => { syncPromise = result.current.syncSession(session); });
  const rejectionExpectation = expect(syncPromise).rejects.toThrow("offline");
  expect(readUserHistory("user-a")[0].syncStatus).toBe("pending");
  expect(insertUserSession).toHaveBeenCalledWith("user-a", expect.objectContaining({ sessionId: "same-uuid" }));

  await act(async () => {
    insertRequest.reject(new Error("offline"));
    await rejectionExpectation;
  });
  expect(readUserHistory("user-a")[0].syncStatus).toBe("failed");
  await act(async () => result.current.retrySession("same-uuid"));
  expect(insertUserSession.mock.calls[0][1].sessionId).toBe(insertUserSession.mock.calls[1][1].sessionId);
  expect(readUserHistory("user-a")[0].syncStatus).toBe("synced");
});
