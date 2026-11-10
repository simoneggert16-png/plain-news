import { NextResponse } from 'next/server';
import { LOCALE_CODES, SITE, SOURCE_LOCALE } from '@/lib/config.mjs';
import { getIndex, localize } from '@/lib/content.mjs';
import { listLiveTickers } from '@/lib/liveStore.mjs';
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
  const { searchParams } = new URL(request.url);
  const rawLocale = String(searchParams.get('locale') || 'de').toLowerCase();
  const locale = LOCALE_CODES.includes(rawLocale) ? rawLocale : 'de';
  const maxItems = Math.max(20, Math.min(350, Number(searchParams.get('limit')) || 240));

  const [listing, fullSnapshot, liveResult] = await Promise.all([
    getIndex(locale).catch(() => []),
    getIndex().catch(() => []),
    listLiveTickers({ status: 'live', limit: 25 }).catch(() => ({ tickers: [] })),
  ]);

  const fullBySlug = new Map((fullSnapshot || []).map((a) => [a.slug, a]));
  const items = [];
  const seenSlugs = new Set();

  // 1. Active Live Tickers (highest priority tactical flashpoints)
  for (const ticker of liveResult?.tickers || []) {
    if (!ticker?.slug) continue;
    const loc = liveLocalize(ticker, locale);
    const enLoc = liveLocalize(ticker, SOURCE_LOCALE);
    const updates = liveUpdates(ticker).slice(0, 4);
    const updateFacts = updates
      .map((u) => updateLocalize(u, locale).headline)
      .filter(Boolean);
    const geo = geolocateStory({
      slug: ticker.slug,
      title: loc.title,
      dek: loc.dek,
      facts: updateFacts,
      enTitle: enLoc.title,
      enDek: enLoc.dek,
      locale,
    });
    if (!geo) continue;

    const targetSlug = ticker.articleSlug || ticker.slug;
    seenSlugs.add(ticker.slug);
    if (ticker.articleSlug) seenSlugs.add(ticker.articleSlug);

    items.push({
      id: `live:${ticker.slug}`,
      kind: 'live',
      isLive: true,
      slug: ticker.slug,
      articleSlug: ticker.articleSlug || null,
      url: `${SITE.url}/${locale}/live/${ticker.slug}`,
      path: `/${locale}/live/${ticker.slug}`,
      locale,
      title: loc.title,
      dek: loc.dek,
      facts: updateFacts,
      category: ticker.category || 'world',
      importance: Math.max(5, Number(ticker.importance) || 5),
      publishedAt: ticker.startedAt || ticker.updatedAt || new Date().toISOString(),
      updatedAt: ticker.updatedAt || ticker.startedAt || new Date().toISOString(),
      sourceCount: Math.max(2, updates.reduce((acc, u) => acc + (u.sources?.length || 0), 0)),
      image: null,
      ...geo,
    });
    if (targetSlug) seenSlugs.add(targetSlug);
  }

  // 2. Verified Newsroom Articles, Longreads & Investigations
  const mergedArticles = listing?.length ? listing : fullSnapshot || [];
  for (const entry of mergedArticles) {
    if (!entry?.slug || seenSlugs.has(entry.slug)) continue;
    const rich = fullBySlug.get(entry.slug) || entry;
    const loc = localize(entry, locale);
    const richLoc = localize(rich, locale);
    const enLoc = rich.locales?.[SOURCE_LOCALE] || entry.locales?.[SOURCE_LOCALE] || {};

    const title = loc.title || richLoc.title || enLoc.title || '';
    const dek = loc.dek || richLoc.dek || loc.standfirst || enLoc.dek || '';
    const facts = Array.isArray(richLoc.facts) ? richLoc.facts.slice(0, 5) : [];
    if (!title) continue;

    const geo = geolocateStory({
      slug: entry.slug,
      title,
      dek,
      facts,
      enTitle: enLoc.title || '',
      enDek: enLoc.dek || '',
      locale,
    });
    if (!geo) continue;

    seenSlugs.add(entry.slug);
    const form = entry.form || rich.form || 'dispatch';
    const kind = form === 'investigation' ? 'investigation' : form === 'longform' ? 'longform' : 'dispatch';

    items.push({
      id: `art:${entry.slug}`,
      kind,
      isLive: Boolean(entry.live || rich.live),
      slug: entry.slug,
      articleSlug: entry.slug,
      url: `${SITE.url}/${locale}/a/${entry.slug}`,
      path: `/${locale}/a/${entry.slug}`,
      locale,
      title,
      dek,
      facts,
      category: entry.category || rich.category || 'world',
      importance: Number(entry.importance || rich.importance || 3),
      publishedAt: entry.publishedAt || rich.publishedAt,
      updatedAt: entry.updatedAt || rich.updatedAt || entry.publishedAt,
      sourceCount: Number(entry.sourceCount || rich.sourceCount || rich.sources?.length || 2),
      image: entry.image || rich.image || null,
      ...geo,
    });

    if (items.length >= maxItems) break;
  }

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      locale,
      count: items.length,
      totalScanned: mergedArticles.length,
      attribution: {
        newsroom: 'PLAIN. Independent Newsroom (plain-news.ch)',
        engine: "God's Eye View by Bilawal Sidhu (MIT License)",
        engineUrl: 'https://github.com/bilawalsidhu/gods-eye-view',
      },
      items,
    },
    {
      status: 200,
      headers: {
        ...corsHeaders(request),
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600',
      },
    }
  );
}
