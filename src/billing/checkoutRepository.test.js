import { createCheckoutSession, SUBSCRIPTION_PLANS } from "./checkoutRepository";

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

test.each([SUBSCRIPTION_PLANS.MONTHLY, SUBSCRIPTION_PLANS.ANNUAL])(
  "sends only the symbolic %s plan with the Supabase access token",
  async (plan) => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ url: "https://checkout.stripe.com/test" }) });
    await expect(createCheckoutSession(plan, "access-token")).resolves.toBe("https://checkout.stripe.com/test");
    expect(fetch).toHaveBeenCalledWith("/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: { authorization: "Bearer access-token", "content-type": "application/json" },
      body: JSON.stringify({ plan })
    });
  }
);

test("rejects invalid client plan values before making a request", async () => {
  await expect(createCheckoutSession("price_untrusted", "access-token")).rejects.toThrow("valid subscription plan");
  expect(fetch).not.toHaveBeenCalled();
});

test("surfaces checkout endpoint errors", async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Authentication required." }) });
  await expect(createCheckoutSession("monthly", "bad-token")).rejects.toThrow("Authentication required");
});
