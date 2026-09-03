export const ENTITLEMENT_STATUSES = Object.freeze({
  TRIAL: "trial",
  SUBSCRIBED: "subscribed",
  REVOKED: "revoked"
});

export const EFFECTIVE_STATUSES = Object.freeze({
  ACTIVE_TRIAL: "active_trial",
  TRIAL_EXPIRED: "trial_expired",
  ACTIVE_SUBSCRIPTION: "active_subscription",
  ACCESS_REVOKED: "access_revoked",
  UNAVAILABLE: "unavailable"
});

export const UNAVAILABLE_ENTITLEMENT = Object.freeze({
  userId: null,
  trialStartedAt: null,
  trialEndsAt: null,
  entitlementStatus: null,
  effectiveStatus: EFFECTIVE_STATUSES.UNAVAILABLE,
  hasAccess: false,
  serverNow: null
});

const validPairings = {
  [ENTITLEMENT_STATUSES.TRIAL]: new Set([
    EFFECTIVE_STATUSES.ACTIVE_TRIAL,
    EFFECTIVE_STATUSES.TRIAL_EXPIRED,
    EFFECTIVE_STATUSES.UNAVAILABLE
  ]),
  [ENTITLEMENT_STATUSES.SUBSCRIBED]: new Set([
    EFFECTIVE_STATUSES.ACTIVE_SUBSCRIPTION
  ]),
  [ENTITLEMENT_STATUSES.REVOKED]: new Set([
    EFFECTIVE_STATUSES.ACCESS_REVOKED
  ])
};

function isTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function normalizeEntitlementResponse(response) {
  const row = Array.isArray(response) ? response[0] : response;
  if (!row || typeof row !== "object") return { ...UNAVAILABLE_ENTITLEMENT };

  const entitlementStatus = row.entitlement_status;
  const effectiveStatus = row.effective_status;
  const hasAccess = row.has_access;
  const expectedAccess = effectiveStatus === EFFECTIVE_STATUSES.ACTIVE_TRIAL
    || effectiveStatus === EFFECTIVE_STATUSES.ACTIVE_SUBSCRIPTION;

  if (
    typeof row.user_id !== "string"
    || !validPairings[entitlementStatus]?.has(effectiveStatus)
    || typeof hasAccess !== "boolean"
    || hasAccess !== expectedAccess
    || !row.user_id.trim()
    || !isTimestamp(row.server_now)
  ) {
    return { ...UNAVAILABLE_ENTITLEMENT };
  }

  if (
    entitlementStatus === ENTITLEMENT_STATUSES.TRIAL
    && (!isTimestamp(row.trial_started_at) || !isTimestamp(row.trial_ends_at))
  ) {
    return { ...UNAVAILABLE_ENTITLEMENT };
  }

  return {
    userId: row.user_id,
    trialStartedAt: isTimestamp(row.trial_started_at) ? row.trial_started_at : null,
    trialEndsAt: isTimestamp(row.trial_ends_at) ? row.trial_ends_at : null,
    entitlementStatus,
    effectiveStatus,
    hasAccess,
    serverNow: row.server_now
  };
}
