import {
  getUserHistoryKey,
  readUserHistory,
  updateUserSessionSyncStatus,
  upsertUserSession
} from "./resetHistoryStorage";

beforeEach(() => localStorage.clear());

test("isolates User A and User B history without touching legacy sessionLog", () => {
  localStorage.setItem("sessionLog", JSON.stringify([{ id: "legacy" }]));
  upsertUserSession("user-a", { sessionId: "a-1", syncStatus: "pending" });
  upsertUserSession("user-b", { sessionId: "b-1", syncStatus: "failed" });

  expect(readUserHistory("user-a").map((row) => row.sessionId)).toEqual(["a-1"]);
  expect(readUserHistory("user-b").map((row) => row.sessionId)).toEqual(["b-1"]);
  expect(JSON.parse(localStorage.getItem("sessionLog"))).toEqual([{ id: "legacy" }]);
  expect(getUserHistoryKey("user-a")).not.toBe(getUserHistoryKey("user-b"));
});

test("updates sync status by session ID and safely handles corrupt storage", () => {
  upsertUserSession("user-a", { id: "one", syncStatus: "pending" });
  updateUserSessionSyncStatus("user-a", "one", "synced");
  expect(readUserHistory("user-a")[0].syncStatus).toBe("synced");

  localStorage.setItem(getUserHistoryKey("broken"), "{bad json");
  expect(readUserHistory("broken")).toEqual([]);
});
