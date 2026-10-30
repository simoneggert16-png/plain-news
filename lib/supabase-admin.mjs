import { createClient } from '@supabase/supabase-js';

// A request that never answers must not keep a bot run alive: the investigations
// job once sat 75 minutes on a single stalled call.
const fetchWithTimeout = (input, init = {}) =>
  fetch(input, { ...init, signal: init.signal || AbortSignal.timeout(15_000) });

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase server credentials are not configured.');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
  });
}
