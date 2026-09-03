import {
  EFFECTIVE_STATUSES,
  normalizeEntitlementResponse
} from "./entitlementState";

const response = (overrides = {}) => ({
  user_id: "user-a",
  trial_started_at: "2026-09-01T00:00:00Z",
  trial_ends_at: "2026-09-08T00:00:00Z",
  entitlement_status: "trial",
  effective_status: "active_trial",
  has_access: true,
  server_now: "2026-09-03T00:00:00Z",
  ...overrides
});

test("normalizes server-authorized trial and subscription states", () => {
  expect(normalizeEntitlementResponse([response()])).toEqual(expect.objectContaining({
    userId: "user-a", effectiveStatus: "active_trial", hasAccess: true
  }));
  expect(normalizeEntitlementResponse(response({
    entitlement_status: "subscribed",
    effective_status: "active_subscription",
    has_access: true,
    trial_started_at: null,
    trial_ends_at: null
  }))).toEqual(expect.objectContaining({ effectiveStatus: "active_subscription", hasAccess: true }));
});

test("treats missing, malformed, or contradictory data as unavailable", () => {
  [
    null,
    [],
    response({ has_access: false }),
    response({ effective_status: "made_up" }),
    response({ server_now: "not-a-timestamp" })
  ]
    .forEach((value) => expect(normalizeEntitlementResponse(value)).toEqual(expect.objectContaining({
      effectiveStatus: EFFECTIVE_STATUSES.UNAVAILABLE,
      hasAccess: false
    })));
});
