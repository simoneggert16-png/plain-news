import { NextResponse } from 'next/server';
import { LOCALE_CODES, DEFAULT_LOCALE } from './lib/config.mjs';
import { isVisitsAdminAuthorized } from './lib/visitsAuth.mjs';

const LOCALES = LOCALE_CODES;

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
  const realIp = (req.headers.get('x-real-ip') || '').trim();
  if (realIp) return realIp;
  const vercelFwd = req.headers.get('x-vercel-forwarded-for');
  if (vercelFwd) return vercelFwd.split(',').pop().trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '';
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

function visitorHashSalt() {
  return (
    process.env.VISIT_HASH_SALT ||
    process.env.VISITOR_HASH_SALT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 24) ||
    'plain-news-v2-salt'
  );
}

async function hashIp(ip) {
  const fullIp = String(ip || '').trim();
  if (!fullIp) return null;
  const salt = visitorHashSalt();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${fullIp}|${salt}`));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function shouldTrack(req, decodedPath, isAdminRoute) {
  if (req.method !== 'GET') return false;
  if (isAdminRoute || decodedPath.includes('/admin')) return false;
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
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

export function middleware(req, event) {
  const { pathname } = req.nextUrl;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  if (decodedPath.includes('\0') || decodedPath.includes('\\')) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const rawSegs = decodedPath.split('/');
  if (rawSegs.some((s) => s === '..' || s === '.')) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const segs = rawSegs.filter(Boolean);
  const hasLocalePrefix = LOCALES.includes(segs[0]);
  const isAdminRoute = segs[0] === 'admin' || (hasLocalePrefix && segs[1] === 'admin');
  const adminSubSegs = segs[0] === 'admin'
    ? segs.slice(1)
    : (hasLocalePrefix && segs[1] === 'admin' ? segs.slice(2) : []);
  const isInvestigationsAdmin = isAdminRoute && adminSubSegs[0] === 'investigations';

  // The visitor log has no login of its own, so it keeps the Basic-auth gate.
  // The investigations desk authorises through the Supabase session + ADMIN_EMAILS.
  if (isAdminRoute && !isInvestigationsAdmin) {
    if (!isVisitsAdminAuthorized(req.headers.get('authorization'))) {
      return new NextResponse('Auth required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="PLAIN. visits", charset="UTF-8"' },
      });
    }
    if (!hasLocalePrefix) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = segs.length === 1 ? '/de/admin/visits' : `/de/${segs.join('/')}`;
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  if (shouldTrack(req, decodedPath, isAdminRoute)) {
    const pending = trackVisit(req, decodedPath).catch(() => {});
    if (event && typeof event.waitUntil === 'function') event.waitUntil(pending);
  }

  if (hasLocalePrefix) return;

  const saved = req.cookies.get('lang')?.value;
  const accept = (req.headers.get('accept-language') || '')
    .split(',')
    .map((p) => p.split(';')[0].trim().slice(0, 2).toLowerCase());
  const locale = [saved, ...accept].find((l) => LOCALES.includes(l)) || DEFAULT_LOCALE;

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
