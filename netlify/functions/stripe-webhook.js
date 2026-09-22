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

function buildHandler(dependencies = {}) {
  return async function handler(event) {
    if (event.httpMethod !== "POST") return methodNotAllowed(["POST"]);

    const env = dependencies.env || process.env;
    let stripeEvent;
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
      const subscription = await subscriptionFromEvent(stripe, stripeEvent);
      if (!subscription?.customerId || !subscription.subscriptionId) {
        throw new Error("Stripe subscription identifiers are unavailable.");
      }

      const adminClient = dependencies.adminClient || createAdminClient(env);
      const { error } = await adminClient.rpc("process_stripe_subscription_event", {
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
      if (error) throw error;
      return json(200, { received: true });
    } catch (error) {
      console.error("Stripe webhook processing failed", error);
      return json(400, { error: "Webhook processing failed." });
    }
  };
}

const handler = buildHandler();

module.exports = { HANDLED_EVENTS, buildHandler, handler, rawRequestBody };
