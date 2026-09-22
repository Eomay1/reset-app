const { createClient } = require("@supabase/supabase-js");

function requiredEnvironment(name, env = process.env) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createAuthClient(env = process.env) {
  const url = requiredEnvironment("SUPABASE_URL", env);
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!publishableKey) {
    throw new Error("Missing required environment variable: SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function createAdminClient(env = process.env) {
  return createClient(
    requiredEnvironment("SUPABASE_URL", env),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY", env),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function bearerToken(headers = {}) {
  const header = headers.authorization || headers.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

async function requireAuthenticatedUser(event, authClient) {
  const token = bearerToken(event.headers);
  if (!token) return { user: null, error: "Authentication required." };

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: "Invalid or expired authentication." };
  return { user: data.user, error: null };
}

module.exports = {
  createAdminClient,
  createAuthClient,
  requireAuthenticatedUser,
  requiredEnvironment
};
