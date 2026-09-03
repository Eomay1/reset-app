import { supabase } from "../supabaseClient";
import { fetchCurrentEntitlement } from "./entitlementRepository";

jest.mock("../supabaseClient", () => ({ supabase: { rpc: jest.fn() } }));

test("fetches entitlement without client parameters", async () => {
  supabase.rpc.mockResolvedValue({
    data: [{
      user_id: "user-a", trial_started_at: "2026-09-01T00:00:00Z", trial_ends_at: "2026-09-08T00:00:00Z",
      entitlement_status: "trial", effective_status: "active_trial",
      has_access: true, server_now: "2026-09-03T00:00:00Z"
    }],
    error: null
  });
  await expect(fetchCurrentEntitlement()).resolves.toEqual(expect.objectContaining({ hasAccess: true }));
  expect(supabase.rpc).toHaveBeenCalledWith("get_current_consumer_entitlement");
});

test("surfaces RPC errors instead of converting them to expiry", async () => {
  const error = new Error("network unavailable");
  supabase.rpc.mockResolvedValue({ data: null, error });
  await expect(fetchCurrentEntitlement()).rejects.toBe(error);
});
