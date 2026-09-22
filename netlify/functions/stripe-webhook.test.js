const { buildHandler } = require("./stripe-webhook");

const ENV = { STRIPE_WEBHOOK_SECRET: "whsec_test" };

function stripeEvent(type, object, overrides = {}) {
  return {
    id: `evt_${type}`,
    type,
    created: 1789000000,
    data: { object },
    ...overrides
  };
}

function subscription(overrides = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    current_period_end: 1791000000,
    cancel_at_period_end: false,
    metadata: { supabase_user_id: "11111111-1111-1111-1111-111111111111" },
    items: { data: [{ price: { id: "price_monthly" }, current_period_end: 1791000000 }] },
    ...overrides
  };
}

function dependencies(event, retrievedSubscription = null) {
  const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
  return {
    env: ENV,
    stripe: {
      webhooks: { constructEvent: jest.fn(() => event) },
      subscriptions: { retrieve: jest.fn().mockResolvedValue(retrievedSubscription) }
    },
    adminClient: { rpc },
    rpc
  };
}

const request = {
  httpMethod: "POST",
  headers: { "stripe-signature": "valid-signature" },
  body: "raw-webhook-body"
};

test("activates entitlement from a completed subscription Checkout", async () => {
  const completed = stripeEvent("checkout.session.completed", {
    subscription: "sub_123",
    customer: "cus_123",
    client_reference_id: "11111111-1111-1111-1111-111111111111",
    metadata: {}
  });
  const deps = dependencies(completed, subscription());
  const response = await buildHandler(deps)(request);

  expect(response.statusCode).toBe(200);
  expect(deps.stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
  expect(deps.rpc).toHaveBeenCalledWith("process_stripe_subscription_event", expect.objectContaining({
    p_event_id: completed.id,
    p_event_type: "checkout.session.completed",
    p_user_id: "11111111-1111-1111-1111-111111111111",
    p_stripe_customer_id: "cus_123",
    p_stripe_subscription_id: "sub_123",
    p_subscription_status: "active"
  }));
});

test.each([
  ["customer.subscription.updated", "past_due"],
  ["customer.subscription.deleted", "canceled"]
])("passes inactive %s state to the transactional entitlement RPC", async (type, status) => {
  const event = stripeEvent(type, subscription({ status, cancel_at_period_end: type.endsWith("updated") }));
  const deps = dependencies(event);
  const response = await buildHandler(deps)(request);

  expect(response.statusCode).toBe(200);
  expect(deps.rpc).toHaveBeenCalledWith("process_stripe_subscription_event", expect.objectContaining({
    p_event_type: type,
    p_subscription_status: status
  }));
});

test("retains paid access while a cancellation is pending and Stripe status is active", async () => {
  const event = stripeEvent("customer.subscription.updated", subscription({ cancel_at_period_end: true }));
  const deps = dependencies(event);
  await buildHandler(deps)(request);
  expect(deps.rpc).toHaveBeenCalledWith("process_stripe_subscription_event", expect.objectContaining({
    p_subscription_status: "active",
    p_cancel_at_period_end: true
  }));
});

test("rejects an invalid Stripe signature before any database write", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const deps = dependencies(stripeEvent("customer.subscription.updated", subscription()));
  deps.stripe.webhooks.constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
  const response = await buildHandler(deps)(request);
  expect(response.statusCode).toBe(400);
  expect(deps.rpc).not.toHaveBeenCalled();
  console.error.mockRestore();
});
