export const SUBSCRIPTION_PLANS = Object.freeze({
  MONTHLY: "monthly",
  ANNUAL: "annual"
});

const VALID_PLANS = new Set(Object.values(SUBSCRIPTION_PLANS));

export async function createCheckoutSession(plan, accessToken) {
  if (!VALID_PLANS.has(plan)) throw new Error("Choose a valid subscription plan.");
  if (!accessToken) throw new Error("Sign in before starting subscription checkout.");

  const response = await fetch("/.netlify/functions/create-checkout-session", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ plan })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Unable to start subscription checkout.");
  if (typeof body.url !== "string" || !body.url.startsWith("https://")) {
    throw new Error("Checkout returned an invalid redirect URL.");
  }
  return body.url;
}

export function redirectToCheckout(url) {
  window.location.assign(url);
}
