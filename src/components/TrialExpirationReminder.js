import { useEffect, useMemo, useState } from "react";
import { EFFECTIVE_STATUSES, ENTITLEMENT_STATUSES } from "../entitlements/entitlementState";

const HOUR = 60 * 60 * 1000;

export function trialTimeRemaining(entitlement, now) {
  if (!entitlement?.hasAccess
    || entitlement.entitlementStatus !== ENTITLEMENT_STATUSES.TRIAL
    || entitlement.effectiveStatus !== EFFECTIVE_STATUSES.ACTIVE_TRIAL) return null;

  const remaining = Date.parse(entitlement.trialEndsAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 48 * HOUR) return null;
  if (remaining === 48 * HOUR) return "2 days";
  if (remaining === 24 * HOUR) return "1 day";
  if (remaining < HOUR) return "less than 1 hour";
  const hours = Math.ceil(remaining / HOUR);
  return remaining % HOUR === 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : `less than ${hours} hours`;
}

export default function TrialExpirationReminder({ entitlement, serverClock }) {
  // Advance the existing server timestamp with elapsed time, avoiding device clock skew.
  const fallbackClock = useMemo(() => ({
    serverNow: Date.parse(entitlement?.serverNow),
    started: performance.now()
  }), [entitlement]);
  const clock = serverClock || fallbackClock;
  const [tick, setTick] = useState(() => performance.now());

  useEffect(() => {
    const update = () => setTick(performance.now());
    const timer = setInterval(update, 1000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [clock]);

  const remaining = trialTimeRemaining(entitlement, clock.serverNow + Math.max(0, tick - clock.started));
  if (!remaining) return null;

  return (
    <aside className="home-trial-reminder" aria-label="Trial reminder">
      <strong>Your RESET trial ends soon</strong>
      <p>Your free trial ends in {remaining}. Continue enjoying RESET with a monthly or annual subscription.</p>
    </aside>
  );
}
