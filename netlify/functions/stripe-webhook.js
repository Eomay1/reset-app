const Stripe = require("stripe");
const { json, methodNotAllowed } = require("./lib/http");
const { createAdminClient, requiredEnvironment } = require("./lib/supabaseServer");
const { subscriptionFromEvent } = require("./lib/stripeSubscription");

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted"
]);

function rawRequestBody(event) {
  return event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "", "utf8");
}

function safeErrorMessage(error, env) {
  let message = typeof error?.message === "string" ? error.message : "Unknown processing error";
  for (const name of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (env[name]) message = message.split(env[name]).join("[redacted]");
  }
  return message
    .replace(/https?:\/\/\S+|\b[\w.+-]+@[\w.-]+\b/g, "[redacted]")
    .replace(/\b(?:sk|rk|pk|whsec|sb|cus|sub|evt|cs|price)_[\w-]+\b|\beyJ[\w.-]+\b|\b[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\b/gi, "[redacted]")
    .replace(/"[^"\r\n]*"|'[^'\r\n]*'/g, "[redacted]")
    .split(/[\r\n]/)[0].slice(0, 500);
}

function buildHandler(dependencies = {}) {
  return async function handler(event) {
    if (event.httpMethod !== "POST") return methodNotAllowed(["POST"]);

    const env = dependencies.env || process.env;
    let stripeEvent;
    let stage = "signature_verification";
    let databaseStatus;
    try {
      const stripe = dependencies.stripe || new Stripe(requiredEnvironment("STRIPE_SECRET_KEY", env));
      const signature = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
      if (!signature) return json(400, { error: "Missing Stripe signature." });
      stripeEvent = stripe.webhooks.constructEvent(
        rawRequestBody(event),
        signature,
        requiredEnvironment("STRIPE_WEBHOOK_SECRET", env)
      );

      if (!HANDLED_EVENTS.has(stripeEvent.type)) return json(200, { received: true });
      stage = "subscription_lookup";
      const subscription = await subscriptionFromEvent(stripe, stripeEvent);
      stage = "subscription_identifiers";
      if (!subscription?.customerId || !subscription.subscriptionId) {
        throw new Error("Stripe subscription identifiers are unavailable.");
      }

      stage = "database_client";
      const adminClient = dependencies.adminClient || createAdminClient(env);
      stage = "subscription_rpc";
      const { error, status } = await adminClient.rpc("process_stripe_subscription_event", {
        p_event_id: stripeEvent.id,
        p_event_type: stripeEvent.type,
        p_event_created_at: new Date(stripeEvent.created * 1000).toISOString(),
        p_user_id: subscription.userId,
        p_stripe_customer_id: subscription.customerId,
        p_stripe_subscription_id: subscription.subscriptionId,
        p_subscription_status: subscription.subscriptionStatus,
        p_stripe_price_id: subscription.priceId,
        p_current_period_end: subscription.currentPeriodEnd,
        p_cancel_at_period_end: subscription.cancelAtPeriodEnd
      });
      databaseStatus = status;
      if (error) throw error;
      return json(200, { received: true });
    } catch (error) {
      console.error("Stripe webhook processing failed", {
        stage,
        message: stage === "signature_verification" ? "Webhook signature verification or Stripe initialization failed" : safeErrorMessage(error, env),
        code: typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/i.test(error.code) ? error.code : null,
        status: [error?.statusCode, error?.status, databaseStatus].find((value) => Number.isInteger(value) && value >= 100 && value <= 599) || null
      });
      return json(400, { error: "Webhook processing failed." });
    }
  };
}

const handler = buildHandler();

module.exports = { HANDLED_EVENTS, buildHandler, handler, rawRequestBody };
