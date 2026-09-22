const Stripe = require("stripe");
const { json, methodNotAllowed } = require("./lib/http");
const {
  createAdminClient,
  createAuthClient,
  requireAuthenticatedUser,
  requiredEnvironment
} = require("./lib/supabaseServer");

const PLAN_ENVIRONMENT_KEYS = Object.freeze({
  monthly: "STRIPE_MONTHLY_PRICE_ID",
  annual: "STRIPE_ANNUAL_PRICE_ID"
});

function checkoutReturnUrl(env) {
  const rawUrl = env.APP_URL || env.URL;
  if (!rawUrl) throw new Error("Missing required environment variable: APP_URL");
  const url = new URL(rawUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error("APP_URL must be an HTTP(S) URL.");
  return url.origin;
}

function parsePlan(event) {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_error) {
    return null;
  }
  return typeof body.plan === "string" ? body.plan : null;
}

function buildHandler(dependencies = {}) {
  return async function handler(event) {
    if (event.httpMethod !== "POST") return methodNotAllowed(["POST"]);

    const env = dependencies.env || process.env;
    const plan = parsePlan(event);
    const priceEnvironmentKey = PLAN_ENVIRONMENT_KEYS[plan];
    if (!priceEnvironmentKey) return json(400, { error: "Invalid subscription plan." });

    try {
      const authClient = dependencies.authClient || createAuthClient(env);
      const { user, error: authenticationError } = await requireAuthenticatedUser(event, authClient);
      if (authenticationError) return json(401, { error: authenticationError });

      const adminClient = dependencies.adminClient || createAdminClient(env);
      const { data: account, error: accountError } = await adminClient
        .from("consumer_accounts")
        .select("stripe_customer_id, entitlement_status, stripe_subscription_status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) return json(409, { error: "Consumer account is not initialized." });
      if (account.entitlement_status === "revoked") {
        return json(403, { error: "This account is not eligible for subscription checkout." });
      }
      if (account.entitlement_status === "subscribed") {
        return json(409, { error: "This account already has an active subscription." });
      }

      const stripe = dependencies.stripe || new Stripe(requiredEnvironment("STRIPE_SECRET_KEY", env));
      const siteUrl = checkoutReturnUrl(env);
      const sessionParameters = {
        mode: "subscription",
        line_items: [{ price: requiredEnvironment(priceEnvironmentKey, env), quantity: 1 }],
        client_reference_id: user.id,
        success_url: `${siteUrl}/access-expired?checkout=success`,
        cancel_url: `${siteUrl}/access-expired?checkout=cancelled`,
        metadata: { supabase_user_id: user.id, plan },
        subscription_data: { metadata: { supabase_user_id: user.id, plan } }
      };

      if (account?.stripe_customer_id) sessionParameters.customer = account.stripe_customer_id;
      else if (user.email) sessionParameters.customer_email = user.email;

      const checkoutSession = await stripe.checkout.sessions.create(sessionParameters);
      if (!checkoutSession.url) throw new Error("Stripe did not return a Checkout URL.");
      return json(200, { url: checkoutSession.url });
    } catch (error) {
      console.error("Unable to create Stripe Checkout Session", error);
      return json(500, { error: "Unable to start subscription checkout." });
    }
  };
}

const handler = buildHandler();

module.exports = { PLAN_ENVIRONMENT_KEYS, buildHandler, handler };
