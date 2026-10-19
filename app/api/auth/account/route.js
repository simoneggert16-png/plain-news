import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase-admin.mjs';

export async function DELETE(request) {
  try {
    const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!accessToken || !url || !anonKey) {
      return NextResponse.json({ error: 'Authenticated session is required.' }, { status: 401 });
    }

    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Authenticated session is invalid.' }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();
    const { error: subscriberError } = await admin
      .from('newsletter_subscribers')
      .delete()
      .eq('email', user.email.toLowerCase());
    if (subscriberError) throw subscriberError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account deletion failed:', error.message);
    return NextResponse.json({ error: 'Account deletion failed.' }, { status: 500 });
  }
}
