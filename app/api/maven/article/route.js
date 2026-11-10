import { NextResponse } from 'next/server';
import { LOCALE_CODES, SITE, SOURCE_LOCALE } from '@/lib/config.mjs';
import { getArticle, localize } from '@/lib/content.mjs';
import { getLiveTicker } from '@/lib/liveStore.mjs';
import { liveLocalize, liveUpdates, updateLocalize } from '@/lib/live.mjs';
import { geolocateStory } from '@/lib/geo.mjs';

const PROD_ALLOWED_ORIGINS = new Set([
  'https://plain-maven.vercel.app',
  'https://www.plain-news.ch',
  'https://plain-news.ch',
]);

const DEV_ALLOWED_ORIGINS = new Set([
  ...PROD_ALLOWED_ORIGINS,
  'http://localhost:5173',
  'http://localhost:3000',
]);

function corsHeaders(request) {
  const origin = request?.headers?.get('origin') || '';
  const allowed = process.env.NODE_ENV !== 'production' ? DEV_ALLOWED_ORIGINS : PROD_ALLOWED_ORIGINS;
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
  if (origin && allowed.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export async function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request) {
  const cors = corsHeaders(request);
  const { searchParams } = new URL(request.url);
  const slug = String(searchParams.get('slug') || '').trim();
  const rawLocale = String(searchParams.get('locale') || 'de').toLowerCase();
  const locale = LOCALE_CODES.includes(rawLocale) ? rawLocale : 'de';

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ ok: false, error: 'Invalid slug' }, { status: 400, headers: cors });
  }

  const article = await getArticle(slug);
  if (article) {
    const loc = localize(article, locale);
    const enLoc = article.locales?.[SOURCE_LOCALE] || {};
    const geo = geolocateStory({
      slug: article.slug,
      title: loc.title,
      dek: loc.dek,
      facts: loc.facts || [],
      enTitle: enLoc.title || '',
      enDek: enLoc.dek || '',
      locale,
    });
    const paragraphs = loc.sections?.length
      ? loc.sections.flatMap((s) => [s.heading ? `## ${s.heading}` : null, ...(s.paragraphs || [])]).filter(Boolean)
      : (loc.body || []);

    return NextResponse.json(
      {
        ok: true,
        kind: article.form || 'dispatch',
        slug: article.slug,
        locale,
        url: `${SITE.url}/${locale}/a/${article.slug}`,
        path: `/${locale}/a/${article.slug}`,
        category: article.category || 'world',
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt || article.publishedAt,
        title: loc.title || '',
        dek: loc.dek || loc.standfirst || '',
        facts: loc.facts || [],
        body: paragraphs,
        context: loc.context || '',
        image: article.image || null,
        imageCredit: article.imageCredit || null,
        sources: (article.sources || []).map((s) => ({
          outlet: s.outlet,
          title: s.title,
          url: s.url,
          publishedAt: s.publishedAt || null,
        })),
        geo,
      },
      {
        status: 200,
        headers: {
          ...cors,
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
      }
    );
  }

  // Fallback: check if slug is a Live Ticker
  const ticker = await getLiveTicker(slug);
  if (ticker) {
    const loc = liveLocalize(ticker, locale);
    const enLoc = liveLocalize(ticker, SOURCE_LOCALE);
    const updates = liveUpdates(ticker).slice(0, 20);
    const formattedUpdates = updates.map((u) => {
      const uLoc = updateLocalize(u, locale);
      return {
        id: u.id,
        at: u.at,
        headline: uLoc.headline,
        body: uLoc.body,
        sources: u.sources || [],
      };
    });
    const geo = geolocateStory({
      slug: ticker.slug,
      title: loc.title,
      dek: loc.dek,
      facts: formattedUpdates.slice(0, 4).map((u) => u.headline),
      enTitle: enLoc.title,
      enDek: enLoc.dek,
      locale,
    });

    return NextResponse.json(
      {
        ok: true,
        kind: 'live',
        isLive: ticker.status === 'live',
        slug: ticker.slug,
        locale,
        url: `${SITE.url}/${locale}/live/${ticker.slug}`,
        path: `/${locale}/live/${ticker.slug}`,
        category: ticker.category || 'world',
        publishedAt: ticker.startedAt,
        updatedAt: ticker.updatedAt || ticker.startedAt,
        title: loc.title,
        dek: loc.dek,
        facts: formattedUpdates.slice(0, 5).map((u) => u.headline).filter(Boolean),
        body: formattedUpdates.map((u) => `${u.headline} — ${u.body}`),
        updates: formattedUpdates,
        sources: formattedUpdates.flatMap((u) => u.sources || []).slice(0, 12),
        geo,
      },
      {
        status: 200,
        headers: {
          ...cors,
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  }

  return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: cors });
}
