import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchCurrentEntitlement } from "../entitlements/entitlementRepository";
import { EFFECTIVE_STATUSES, UNAVAILABLE_ENTITLEMENT } from "../entitlements/entitlementState";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entitlement, setEntitlement] = useState({ ...UNAVAILABLE_ENTITLEMENT });
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState(null);
  const authVersion = useRef(0);
  const entitlementVersion = useRef(0);
  const sessionRef = useRef(null);

  const ensureConsumerAccount = useCallback(async () => {
    const { data, error: accountError } = await supabase.rpc("ensure_consumer_account");
    if (accountError) throw accountError;
    return data;
  }, []);

  const clearEntitlement = useCallback(() => {
    entitlementVersion.current += 1;
    setEntitlement({ ...UNAVAILABLE_ENTITLEMENT });
    setEntitlementLoading(false);
    setEntitlementError(null);
  }, []);

  const refreshEntitlement = useCallback(async () => {
    const expectedUserId = sessionRef.current?.user?.id;
    if (!expectedUserId) throw new Error("Authentication is required to check RESET access.");
    const version = ++entitlementVersion.current;
    setEntitlementLoading(true);
    setEntitlementError(null);
    try {
      const nextEntitlement = await fetchCurrentEntitlement();
      if (nextEntitlement.userId && nextEntitlement.userId !== expectedUserId) {
        throw new Error("Entitlement response did not match the authenticated account.");
      }
      if (version !== entitlementVersion.current || sessionRef.current?.user?.id !== expectedUserId) {
        return null;
      }
      setEntitlement(nextEntitlement);
      setEntitlementLoading(false);
      return nextEntitlement;
    } catch (entitlementFetchError) {
      if (version === entitlementVersion.current && sessionRef.current?.user?.id === expectedUserId) {
        setEntitlement({ ...UNAVAILABLE_ENTITLEMENT });
        setEntitlementError(entitlementFetchError);
        setEntitlementLoading(false);
      }
      throw entitlementFetchError;
    }
  }, []);

  const applySession = useCallback(async (nextSession) => {
    const version = ++authVersion.current;
    setError(null);

    if (!nextSession?.user) {
      sessionRef.current = null;
      setSession(null);
      setLoading(false);
      clearEntitlement();
      return;
    }

    const nextUserId = nextSession.user.id;
    if (sessionRef.current?.user?.id !== nextUserId) clearEntitlement();
    sessionRef.current = nextSession;
    setSession(nextSession);
    setLoading(false);
    setEntitlementLoading(true);
    setEntitlementError(null);

    try {
      await ensureConsumerAccount();
      if (version !== authVersion.current || sessionRef.current?.user?.id !== nextUserId) return;
      await refreshEntitlement();
    } catch (accountOrEntitlementError) {
      if (version !== authVersion.current || sessionRef.current?.user?.id !== nextUserId) return;
      setEntitlement({ ...UNAVAILABLE_ENTITLEMENT });
      setEntitlementError(accountOrEntitlementError);
      setEntitlementLoading(false);
    }
  }, [clearEntitlement, ensureConsumerAccount, refreshEntitlement]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError);
        setLoading(false);
        return;
      }
      applySession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      active = false;
      authVersion.current += 1;
      entitlementVersion.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [applySession, clearEntitlement]);

  const signInWithOtp = useCallback(async (email) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    });
    if (signInError) {
      setError(signInError);
      throw signInError;
    }
  }, []);

  const verifyOtp = useCallback(async (email, token) => {
    setError(null);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email"
    });
    if (verifyError) {
      setError(verifyError);
      throw verifyError;
    }
    await applySession(data.session ?? null);
    return data;
  }, [applySession]);

  const signOut = useCallback(async () => {
    authVersion.current += 1;
    setError(null);
    sessionRef.current = null;
    setSession(null);
    clearEntitlement();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError);
      throw signOutError;
    }
  }, [clearEntitlement]);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    session,
    loading,
    error,
    entitlement,
    entitlementLoading,
    entitlementError,
    hasAccess: entitlement.hasAccess,
    effectiveStatus: entitlement.effectiveStatus || EFFECTIVE_STATUSES.UNAVAILABLE,
    refreshEntitlement,
    signInWithOtp,
    verifyOtp,
    signOut
  }), [
    entitlement,
    entitlementError,
    entitlementLoading,
    error,
    loading,
    refreshEntitlement,
    session,
    signInWithOtp,
    signOut,
    verifyOtp
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
