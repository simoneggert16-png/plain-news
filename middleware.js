import { NextResponse } from 'next/server';
import { LOCALE_CODES, DEFAULT_LOCALE } from './lib/config.mjs';

const CRAWLER_RE =
  /bot|crawler|spider|slurp|OAI-SearchBot|ChatGPT|GPTBot|Perplexity|Claude|Google-Extended|Applebot|Amazonbot|meta-externalagent|CCBot|cohere-ai|YouBot|Diffbot/i;

// Stricter than the locale-redirect check: these never count as human visits.
const TRACK_SKIP_UA_RE = new RegExp(
  `${CRAWLER_RE.source}|GoogleOther|Google-InspectionTool|AdsBot|Mediapartners|APIs-Google|FeedFetcher|HeadlessChrome|PhantomJS|python-requests|curl/|Wget`,
  'i',
);

function decodeHeader(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/* ------------------------------------------------------------------ */
/* Visitor logging (opt-in per env, never blocks a response)          */
/* ------------------------------------------------------------------ */

function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '';
}

function maskIp(ip) {
  if (!ip) return null;
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return parts.length >= 3 ? `${parts.slice(0, 3).join(':')}::` : null;
  }
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0` : null;
}

async function hashIp(ip) {
  const salt = process.env.VISIT_HASH_SALT || 'plain-news';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${salt}`));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function shouldTrack(req, pathname) {
  if (req.method !== 'GET') return false;
  if (pathname.includes('/admin')) return false;
  if (req.headers.get('next-router-prefetch') || req.headers.get('purpose') === 'prefetch') return false;
  if (req.headers.get('sec-purpose') === 'prefetch') return false;
  if (req.nextUrl.searchParams.has('_rsc')) return false;
  const accept = req.headers.get('accept') || '';
  if (!accept.includes('text/html')) return false;
  const ua = req.headers.get('user-agent') || '';
  if (!ua || TRACK_SKIP_UA_RE.test(ua)) return false;
  return true;
}

async function trackVisit(req, pathname) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || process.env.VISITS_ENABLED === '0') return;

  const ip = clientIp(req);
  if (!ip) return;

  const row = {
    ip_masked: maskIp(ip),
    ip_hash: await hashIp(ip),
    country: req.headers.get('x-vercel-ip-country') || null,
    region: decodeHeader(req.headers.get('x-vercel-ip-country-region')),
    city: decodeHeader(req.headers.get('x-vercel-ip-city')),
    path: pathname.slice(0, 300),
    referrer: (req.headers.get('referer') || '').slice(0, 300) || null,
    ua: (req.headers.get('user-agent') || '').slice(0, 300),
  };
  if (process.env.VISITS_FULL_IP === '1') row.ip = ip;

  const res = await fetch(`${url}/rest/v1/visits`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok && process.env.NODE_ENV !== 'production') {
    console.warn('[visits] insert failed', res.status, await res.text().catch(() => ''));
  }
}

/* ------------------------------------------------------------------ */
/* Admin gate                                                          */
/* ------------------------------------------------------------------ */

function adminAuthorized(req) {
  const user = process.env.VISITS_ADMIN_USER;
  const pass = process.env.VISITS_ADMIN_PASS;
  if (!user || !pass) return false;
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    return atob(header.slice(6)) === `${user}:${pass}`;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

export function middleware(req, event) {
  const { pathname } = req.nextUrl;

  // The visitor log has no login of its own, so it keeps the Basic-auth gate.
  // The investigations desk authorises through the Supabase session + ADMIN_EMAILS.
  if (pathname.includes('/admin') && !pathname.includes('/admin/investigations')) {
    if (!adminAuthorized(req)) {
      return new NextResponse('Auth required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="PLAIN. visits", charset="UTF-8"' },
      });
    }
    return NextResponse.next();
  }

  if (shouldTrack(req, pathname)) {
    const pending = trackVisit(req, pathname).catch(() => {});
    if (event && typeof event.waitUntil === 'function') event.waitUntil(pending);
  }

  const first = pathname.split('/')[1];
  if (LOCALE_CODES.includes(first)) return;

  const saved = req.cookies.get('lang')?.value;
  const accept = (req.headers.get('accept-language') || '')
    .split(',')
    .map((p) => p.split(';')[0].trim().slice(0, 2).toLowerCase());
  const locale = [saved, ...accept].find((l) => LOCALE_CODES.includes(l)) || DEFAULT_LOCALE;

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  // Crawlers often do not follow redirects. Serve them the English page
  // directly (HTTP 200) instead of a 307, while humans keep language redirects.
  const userAgent = req.headers.get('user-agent') || '';
  const isCrawler = CRAWLER_RE.test(userAgent);

  if (isCrawler) return NextResponse.rewrite(url);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next|favicon|icon|robots|sitemap|.*\\..*).*)'],
};
