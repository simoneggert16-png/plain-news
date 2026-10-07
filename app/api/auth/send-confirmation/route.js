import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { sendConfirmationEmail } from '@/lib/email.mjs';
import { saveVerificationToken } from '@/lib/cloudStore.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, username, locale = 'de', topics = [] } = body || {};

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUser = (username && username.trim()) || cleanEmail.split('@')[0];
    const token = crypto.randomUUID();

    // Determine base URL from headers or fallback to plain-news.ch
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'www.plain-news.ch';
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const baseUrl = `${proto}://${host}`;
    const confirmUrl = `${baseUrl}/${locale}/confirm?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    // 1. Save token in cloud store
    await saveVerificationToken(token, {
      email: cleanEmail,
      username: cleanUser,
      locale,
      topics,
    });

    // 2. Dispatch email (SMTP / Resend / Instant fallback)
    const emailResult = await sendConfirmationEmail({
      email: cleanEmail,
      username: cleanUser,
      confirmUrl,
      locale,
      topics,
    });

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      username: cleanUser,
      token,
      confirmUrl,
      deliveryMethod: emailResult.method,
      htmlPreview: emailResult.html,
    });
  } catch (err) {
    console.error('send-confirmation error:', err);
    return NextResponse.json({ error: 'Failed to send confirmation email' }, { status: 500 });
  }
}
