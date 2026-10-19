import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase-admin.mjs';

export async function POST(request) {
  try {
    const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return NextResponse.json({ error: 'Sign in with a verified email first.' }, { status: 401 });
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('Supabase public credentials are not configured.');
    }
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !user?.email || !user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email verification is required.' }, { status: 403 });
    }
    if (user.user_metadata?.newsletter !== true) {
      return NextResponse.json({ error: 'Newsletter consent was not provided.' }, { status: 403 });
    }

    const { error } = await getSupabaseAdminClient()
      .from('newsletter_subscribers')
      .upsert({
        email: user.email.toLowerCase(),
        locale: user.user_metadata?.locale || 'de',
        topics: Array.isArray(user.user_metadata?.topics) ? user.user_metadata.topics : [],
        active: true,
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null,
      }, { onConflict: 'email' });
    if (error) throw error;

    return NextResponse.json({ success: true, subscribed: true });
  } catch (err) {
    console.error('Error handling newsletter:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
