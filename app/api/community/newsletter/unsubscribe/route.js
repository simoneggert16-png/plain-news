import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabase-admin.mjs';

export const dynamic = 'force-dynamic';

function signature(email) {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Newsletter unsubscribe signing secret is not configured.');
  return crypto.createHmac('sha256', secret).update(email).digest('hex');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  const token = searchParams.get('token') || '';
  if (!email || !email.includes('@') || !/^[a-f0-9]{64}$/i.test(token)) {
    return new NextResponse('Ungültiger Abmeldelink.', { status: 400 });
  }

  const expected = Buffer.from(signature(email), 'hex');
  const received = Buffer.from(token, 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return new NextResponse('Ungültiger Abmeldelink.', { status: 400 });
  }

  const { error } = await getSupabaseAdminClient()
    .from('newsletter_subscribers')
    .update({ active: false, unsubscribed_at: new Date().toISOString() })
    .eq('email', email);
  if (error) {
    console.error('Newsletter unsubscribe failed:', error.message);
    return new NextResponse('Abmeldung fehlgeschlagen. Bitte später erneut versuchen.', { status: 500 });
  }

  return new NextResponse('Du hast dich erfolgreich vom PLAIN.-Newsletter abgemeldet.', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
