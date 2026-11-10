import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabase-admin.mjs';

export const dynamic = 'force-dynamic';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function getSigningSecrets() {
  return [
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter(Boolean);
}

function verifyUnsubscribeToken(email, token) {
  if (!email || !email.includes('@') || email.length > 320 || !/^[a-f0-9]{64}$/i.test(token)) {
    return false;
  }
  const secrets = getSigningSecrets();
  if (!secrets.length) {
    throw new Error('Newsletter unsubscribe signing secret is not configured.');
  }
  const received = Buffer.from(token.toLowerCase(), 'hex');
  let valid = false;
  for (const secret of secrets) {
    const expected = crypto.createHmac('sha256', secret).update(email).digest();
    if (expected.length === received.length && crypto.timingSafeEqual(expected, received)) {
      valid = true;
    }
  }
  return valid;
}

function renderHtmlPage({ title, heading, message, form = '' }) {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:40px 16px;background:#f3f5f8;color:#17233b;font-family:Arial,Helvetica,sans-serif">
  <main style="max-width:480px;margin:0 auto;padding:32px 28px;background:#ffffff;border:1px solid #e5e8ef">
    <p style="margin:0 0 18px;font:800 18px/1 Arial,Helvetica,sans-serif;letter-spacing:2.5px">PLAIN<span style="color:#f4b544">.</span></p>
    <h1 style="margin:0 0 12px;font:700 22px/1.3 Arial,Helvetica,sans-serif">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 20px;color:#475467;font:15px/1.6 Arial,Helvetica,sans-serif">${escapeHtml(message)}</p>
    ${form}
  </main>
</body>
</html>`;
}

async function extractCredentials(request) {
  const { searchParams } = new URL(request.url);
  let email = (searchParams.get('email') || '').trim().toLowerCase();
  let token = (searchParams.get('token') || '').trim();

  if ((!email || !token) && request.method === 'POST') {
    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    try {
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        if (!email) email = String(formData.get('email') || '').trim().toLowerCase();
        if (!token) token = String(formData.get('token') || '').trim();
      } else {
        const rawBody = await request.text();
        if (rawBody) {
          const params = new URLSearchParams(rawBody);
          if (!email) email = (params.get('email') || '').trim().toLowerCase();
          if (!token) token = (params.get('token') || '').trim();
        }
      }
    } catch {
      // Ignore malformed request body if query params were missing
    }
  }

  return { email, token };
}

export async function GET(request) {
  try {
    const { email, token } = await extractCredentials(request);
    if (!verifyUnsubscribeToken(email, token)) {
      return new NextResponse('Ungültiger Abmeldelink.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
      });
    }

    const formHtml = `<form method="POST" action="/api/community/newsletter/unsubscribe">
      <input type="hidden" name="email" value="${escapeHtml(email)}">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <button type="submit" style="padding:11px 20px;background:#17233b;color:#ffffff;border:none;cursor:pointer;font:700 14px/1.2 Arial,Helvetica,sans-serif">
        Newsletter abbestellen
      </button>
    </form>`;

    const html = renderHtmlPage({
      title: 'PLAIN. — Newsletter abbestellen',
      heading: 'Newsletter abbestellen',
      message: `Möchtest du den täglichen PLAIN.-Newsletter für ${email} wirklich abbestellen?`,
      form: formHtml,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('Newsletter unsubscribe GET error:', err?.message || err);
    return new NextResponse('Abmeldung derzeit nicht möglich.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  }
}

export async function POST(request) {
  try {
    const { email, token } = await extractCredentials(request);
    if (!verifyUnsubscribeToken(email, token)) {
      return new NextResponse('Ungültiger Abmeldelink.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
      });
    }

    const { error } = await getSupabaseAdminClient()
      .from('newsletter_subscribers')
      .update({ active: false, unsubscribed_at: new Date().toISOString() })
      .eq('email', email);
    if (error) {
      console.error('Newsletter unsubscribe failed:', error.message);
      return new NextResponse('Abmeldung fehlgeschlagen. Bitte später erneut versuchen.', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
      });
    }

    const html = renderHtmlPage({
      title: 'PLAIN. — Abgemeldet',
      heading: 'Abmeldung bestätigt',
      message: 'Du hast dich erfolgreich vom PLAIN.-Newsletter abgemeldet.',
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('Newsletter unsubscribe POST error:', err?.message || err);
    return new NextResponse('Abmeldung fehlgeschlagen. Bitte später erneut versuchen.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  }
}
