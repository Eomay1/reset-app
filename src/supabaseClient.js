import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
// Keep the existing environment variable name during the staged rollout. This
// is the browser-safe Supabase publishable/anon key, never a service-role key.
const supabasePublishableKey =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
