'use client';

import { createClient } from '@supabase/supabase-js';

let client;

export function getSupabaseBrowserClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase authentication is not configured.');
  }
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } }
    );
  }
  return client;
}
