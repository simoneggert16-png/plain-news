import { NextResponse } from 'next/server';
import { getIndex } from '@/lib/content.mjs';
import { fetchTickerFeeds } from '@/lib/tickerFeeds.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 30; // 30s cache

let cache = null;
let lastFetch = 0;

const WINDOW_MS = Number(process.env.TICKER_WINDOW_HOURS || 48) * 3600 * 1000;
const MAX_ARTICLES = 4;
const MAX_NEWS = 8;
const MAX_SPORT = 3;
const MAX_POSITIVE = 1;
const MAX_LIVE = MAX_ARTICLES + MAX_NEWS + MAX_SPORT + MAX_POSITIVE;

// TopBar renders `label` + `text`; the ticker page renders `badge` + `title`.
const LABELS = {
  world: 'WELT',
  politics: 'POLITIK',
  business: 'WIRTSCHAFT',
  tech: 'TECH',
  science: 'WISSEN',
  culture: 'KULTUR',
  health: 'GESUNDHEIT',
  sport: 'SPORT',
};

const FILTER_TYPE = { science: 'tech', culture: 'world', health: 'world' };

function toLiveItem(item) {
  const type = FILTER_TYPE[item.type] || item.type;
  const label = item.positive
    ? 'GUTE NACHRICHTEN'
    : item.type === 'sport' && item.isLive
      ? 'LIVE / SPORT'
      : LABELS[item.type] || 'WELT';
  return { ...item, type, label, text: item.title };
}

const SALIENT = /election|runoff|presidential|wins|won|victory|resigns|ceasefire|invasion|earthquake|killed|dies|death toll|verdict|ruling|coup|referendum|wählt|stichwahl|siegt|gewinnt|Rücktritt|Erdbeben|Urteil|Gipfel/i;

/** Diversity-aware pick: no desk and no outlet may dominate the short wire. */
function pick(items, limit, { perDesk = 2, perOutlet = 1, seen = new Set() } = {}) {
  const out = [];
  const deskCount = {};
  const outletCount = {};
  for (const item of items) {
    if (out.length >= limit) break;
    if (seen.has(item.id)) continue;
    const desk = item.type || 'world';
    const outlet = item.source || '';
    if ((deskCount[desk] || 0) >= perDesk) continue;
    if (outlet && (outletCount[outlet] || 0) >= perOutlet) continue;
    deskCount[desk] = (deskCount[desk] || 0) + 1;
    if (outlet) outletCount[outlet] = (outletCount[outlet] || 0) + 1;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - lastFetch < 30000) {
    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  const tickerItems = [];
  const articles = await getIndex();
  const cutoff = now - WINDOW_MS;

  // 1. World / politics / business / tech wire — the part that was missing.
  //    A Brazilian election belongs here just as much as a Bundesliga result.
  try {
    const wire = await fetchTickerFeeds({ maxAgeHours: 30, perFeed: 6, now });
    const news = wire.filter((i) => i.type !== 'sport' && !i.positive);
    const sport = wire.filter((i) => i.type === 'sport');
    const positive = wire.filter((i) => i.positive);

    // A result like Brazil's election is minutes older than a transfer rumour
    // but far more important. Put genuinely salient stories first so they are
    // not crowded out by the newest item from whichever feed refreshed last.
    const salientSince = now - 14 * 3600e3;
    const salient = news.filter((i) => SALIENT.test(i.title) && Date.parse(i.time) >= salientSince);
    const orderedNews = [...salient, ...news];

    const seen = new Set();
    tickerItems.push(...pick(orderedNews, MAX_NEWS, { perDesk: 3, perOutlet: 1, seen }).map(toLiveItem));
    tickerItems.push(...pick(sport, MAX_SPORT, { perDesk: 3, perOutlet: 1, seen }).map(toLiveItem));
    tickerItems.push(...pick(positive, MAX_POSITIVE, { perDesk: 1, perOutlet: 1, seen }).map(toLiveItem));
  } catch (err) {
    console.error('Ticker wire fetch error:', err);
  }

  // 2. Latest published PLAIN. stories (EILMELDUNG only inside the 90 min window)
  const BREAKING_WINDOW_MS = 90 * 60 * 1000;
  articles
    .filter((a) => Number.isFinite(Date.parse(a.publishedAt || '')) && Date.parse(a.publishedAt) >= cutoff)
    .slice(0, MAX_ARTICLES)
    .forEach((a) => {
      const deTitle = a.locales?.de?.title || a.locales?.en?.title;
      if (!deTitle) return;
      const isRecent = a.publishedAt && (now - Date.parse(a.publishedAt) < BREAKING_WINDOW_MS);
      const isEilmeldung = a.importance >= 4 && isRecent;

      tickerItems.push({
        id: `plain-${a.slug}`,
        type: FILTER_TYPE[a.category] || a.category,
        label: isEilmeldung ? 'EILMELDUNG' : LABELS[a.category] || 'WELT',
        text: deTitle,
        title: deTitle,
        badge: isEilmeldung ? 'EILMELDUNG' : LABELS[a.category] || 'WELT',
        slug: a.slug,
        source: 'PLAIN.',
        time: a.publishedAt,
      });
    });

  tickerItems.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  cache = tickerItems.slice(0, MAX_LIVE);
  lastFetch = now;

  return NextResponse.json(cache, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
