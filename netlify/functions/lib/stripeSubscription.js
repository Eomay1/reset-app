const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function stripeId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

function subscriptionSnapshot(subscription) {
  if (!subscription || typeof subscription !== "object") {
    throw new Error("Stripe subscription data is unavailable.");
  }

  const firstItem = subscription.items?.data?.[0];
  return {
    userId: subscription.metadata?.supabase_user_id || null,
    customerId: stripeId(subscription.customer),
    subscriptionId: subscription.id || null,
    subscriptionStatus: subscription.status || null,
    priceId: firstItem?.price?.id || null,
    currentPeriodEnd: Number.isFinite(firstItem?.current_period_end ?? subscription.current_period_end)
      ? new Date((firstItem?.current_period_end ?? subscription.current_period_end) * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    hasPaidAccess: ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
  };
}

async function subscriptionFromEvent(stripe, event) {
  const object = event.data?.object;
  if (event.type === "checkout.session.completed") {
    const subscriptionId = stripeId(object?.subscription);
    if (!subscriptionId) throw new Error("Completed Checkout Session has no subscription.");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const snapshot = subscriptionSnapshot(subscription);
    return {
      ...snapshot,
      userId: snapshot.userId || object?.client_reference_id || object?.metadata?.supabase_user_id || null,
      customerId: snapshot.customerId || stripeId(object?.customer)
    };
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    return subscriptionSnapshot(object);
  }

  return null;
}

module.exports = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  subscriptionFromEvent,
  subscriptionSnapshot
};
