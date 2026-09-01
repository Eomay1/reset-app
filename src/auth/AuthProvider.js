import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const authVersion = useRef(0);

  const ensureConsumerAccount = useCallback(async () => {
    const { data, error: accountError } = await supabase.rpc("ensure_consumer_account");
    if (accountError) throw accountError;
    return data;
  }, []);

  useEffect(() => {
    let active = true;

    const applySession = async (nextSession) => {
      const version = ++authVersion.current;
      setError(null);

      try {
        if (nextSession?.user) await ensureConsumerAccount();
        if (!active || version !== authVersion.current) return;
        setSession(nextSession ?? null);
      } catch (accountError) {
        if (!active || version !== authVersion.current) return;
        setSession(null);
        setError(accountError);
      } finally {
        if (active && version === authVersion.current) setLoading(false);
      }
    };

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
      listener.subscription.unsubscribe();
    };
  }, [ensureConsumerAccount]);

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
    await ensureConsumerAccount();
    setSession(data.session ?? null);
    return data;
  }, [ensureConsumerAccount]);

  const signOut = useCallback(async () => {
    authVersion.current += 1;
    setError(null);
    setSession(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError);
      throw signOutError;
    }
  }, []);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    session,
    loading,
    error,
    signInWithOtp,
    verifyOtp,
    signOut
  }), [error, loading, session, signInWithOtp, signOut, verifyOtp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
