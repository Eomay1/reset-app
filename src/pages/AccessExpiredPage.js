import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  createCheckoutSession,
  redirectToCheckout,
  SUBSCRIPTION_PLANS
} from "../billing/checkoutRepository";

function formatTrialEnd(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export default function AccessExpiredPage() {
  const { entitlement, refreshEntitlement, session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkingPurchase, setCheckingPurchase] = useState(searchParams.get("checkout") === "success");
  const checkedPurchase = useRef(false);
  const trialEnd = formatTrialEnd(entitlement?.trialEndsAt);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success" || checkedPurchase.current) return;
    checkedPurchase.current = true;
    refreshEntitlement()
      .then((nextEntitlement) => {
        if (nextEntitlement?.hasAccess) navigate("/app", { replace: true });
      })
      .catch(() => setCheckoutError("Your payment was received, but access is still being confirmed. Try checking again shortly."))
      .finally(() => setCheckingPurchase(false));
  }, [navigate, refreshEntitlement, searchParams]);

  const handleCheckout = async (plan) => {
    setCheckoutPlan(plan);
    setCheckoutError("");
    try {
      const checkoutUrl = await createCheckoutSession(plan, session?.access_token);
      redirectToCheckout(checkoutUrl);
    } catch (error) {
      setCheckoutError(error.message || "Unable to start subscription checkout.");
      setCheckoutPlan(null);
    }
  };

  const checkAccess = async () => {
    setCheckingPurchase(true);
    setCheckoutError("");
    try {
      const nextEntitlement = await refreshEntitlement();
      if (nextEntitlement?.hasAccess) navigate("/app", { replace: true });
      else setCheckoutError("Your subscription is not active yet. Please try again shortly.");
    } catch (_error) {
      setCheckoutError("Unable to confirm your subscription right now. Please try again.");
    } finally {
      setCheckingPurchase(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card access-card">
        <p className="home-eyebrow">RESET access</p>
        <h1>Active RESET access has ended</h1>
        <p>Choose a subscription to continue using RESET. Your saved history and account remain available.</p>
        {trialEnd && <p>Your trial ended on <strong>{trialEnd}</strong>.</p>}
        {searchParams.get("checkout") === "cancelled" && (
          <p className="auth-message">Checkout was cancelled. You have not been charged.</p>
        )}
        {searchParams.get("checkout") === "success" && (
          <div className="checkout-status">
            <p className="auth-message" role="status">
              {checkingPurchase ? "Confirming your subscription…" : "Subscription confirmation may take a moment."}
            </p>
            {!checkingPurchase && (
              <button type="button" className="auth-secondary-button" onClick={checkAccess}>
                Check access
              </button>
            )}
          </div>
        )}
        <div className="subscription-options" aria-label="Subscription plans">
          <article className="subscription-option">
            <h2>Monthly</h2>
            <p className="subscription-price"><strong>CA$11.99</strong><span>/month</span></p>
            <button
              type="button"
              onClick={() => handleCheckout(SUBSCRIPTION_PLANS.MONTHLY)}
              disabled={Boolean(checkoutPlan)}
            >
              {checkoutPlan === SUBSCRIPTION_PLANS.MONTHLY ? "Opening checkout…" : "Subscribe monthly"}
            </button>
          </article>
          <article className="subscription-option subscription-option--featured">
            <p className="subscription-badge">Best value</p>
            <h2>Annual</h2>
            <p className="subscription-price"><strong>CA$99</strong><span>/year</span></p>
            <button
              type="button"
              onClick={() => handleCheckout(SUBSCRIPTION_PLANS.ANNUAL)}
              disabled={Boolean(checkoutPlan)}
            >
              {checkoutPlan === SUBSCRIPTION_PLANS.ANNUAL ? "Opening checkout…" : "Subscribe annually"}
            </button>
          </article>
        </div>
        {checkoutError && <p role="alert" className="auth-error">{checkoutError}</p>}
        <div className="account-actions">
          <Link to="/history">View History</Link>
          <Link to="/account">Account</Link>
        </div>
      </section>
    </main>
  );
}
