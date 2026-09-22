const { buildHandler } = require("./create-checkout-session");

const ENV = {
  APP_URL: "https://reset.example",
  STRIPE_MONTHLY_PRICE_ID: "price_monthly",
  STRIPE_ANNUAL_PRICE_ID: "price_annual"
};

function adminClient(account = {
  stripe_customer_id: null,
  entitlement_status: "trial",
  stripe_subscription_status: null
}) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: account, error: null });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  return { from: jest.fn(() => ({ select })) };
}

function request(plan, token = "valid-token") {
  return {
    httpMethod: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ plan })
  };
}

function dependencies(overrides = {}) {
  const create = jest.fn().mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/test" });
  return {
    env: ENV,
    authClient: {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com" } }, error: null }) }
    },
    adminClient: adminClient(),
    stripe: { checkout: { sessions: { create } } },
    create,
    ...overrides
  };
}

test.each([
  ["monthly", "price_monthly"],
  ["annual", "price_annual"]
])("creates a secure %s subscription Checkout Session", async (plan, expectedPrice) => {
  const deps = dependencies();
  const response = await buildHandler(deps)(request(plan));

  expect(response.statusCode).toBe(200);
  expect(JSON.parse(response.body)).toEqual({ url: "https://checkout.stripe.com/c/pay/test" });
  expect(deps.create).toHaveBeenCalledWith(expect.objectContaining({
    mode: "subscription",
    line_items: [{ price: expectedPrice, quantity: 1 }],
    client_reference_id: "user-1",
    success_url: "https://reset.example/access-expired?checkout=success",
    cancel_url: "https://reset.example/access-expired?checkout=cancelled",
    metadata: { supabase_user_id: "user-1", plan },
    subscription_data: { metadata: { supabase_user_id: "user-1", plan } }
  }));
});

test("rejects an invalid plan without contacting Stripe", async () => {
  const deps = dependencies();
  const response = await buildHandler(deps)(request("price_attacker_supplied"));
  expect(response.statusCode).toBe(400);
  expect(deps.create).not.toHaveBeenCalled();
});

test("rejects an unauthenticated checkout request", async () => {
  const deps = dependencies();
  const response = await buildHandler(deps)(request("monthly", null));
  expect(response.statusCode).toBe(401);
  expect(deps.create).not.toHaveBeenCalled();
});

test("reuses a stored Stripe Customer rather than trusting client input", async () => {
  const deps = dependencies({ adminClient: adminClient({
    stripe_customer_id: "cus_existing",
    entitlement_status: "trial",
    stripe_subscription_status: "canceled"
  }) });
  await buildHandler(deps)(request("monthly"));
  expect(deps.create).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_existing" }));
  expect(deps.create.mock.calls[0][0]).not.toHaveProperty("customer_email");
});

test.each([
  ["subscribed", 409],
  ["revoked", 403]
])("rejects server-side %s accounts", async (entitlementStatus, expectedStatus) => {
  const deps = dependencies({ adminClient: adminClient({
    stripe_customer_id: "cus_existing",
    entitlement_status: entitlementStatus,
    stripe_subscription_status: "active"
  }) });
  const response = await buildHandler(deps)(request("monthly"));
  expect(response.statusCode).toBe(expectedStatus);
  expect(deps.create).not.toHaveBeenCalled();
});
