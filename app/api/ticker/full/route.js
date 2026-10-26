import { NextResponse } from 'next/server';
import { getIndex } from '@/lib/content.mjs';
import { fetchTickerFeeds } from '@/lib/tickerFeeds.mjs';
import { rankArticles, isTopStory } from '@/lib/storyRank.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 20; // 20s cache

let cache = null;
let lastFetch = 0;

// A ticker is a live wire, not an archive. Anything older than the window is
// dropped, and undated feed items are dropped instead of being stamped with
// "now" (that bug pinned old stories to the top of the ticker forever).
const WINDOW_MS = Number(process.env.TICKER_WINDOW_HOURS || 48) * 3600 * 1000;
const MAX_ITEMS = Number(process.env.TICKER_MAX_ITEMS || 150);
const MAX_PER_OUTLET = 18;
// Without quotas a busy news morning pushes every result off the wire; the
// sport filter on /ticker would then be empty.
const SPORT_QUOTA = 40;
const POSITIVE_QUOTA = 15;
const ARTICLE_QUOTA = 10;

const FILTER_TYPE = { science: 'tech', culture: 'world', health: 'world' };

const normalizeTitle = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u00e4\u00f6\u00fc\u00df]/g, '')
    .slice(0, 40);

export async function GET() {
  const now = Date.now();
  if (cache && now - lastFetch < 20000) {
    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
    });
  }

  const seenNorm = new Set();
  const articles = await getIndex();
  const cutoff = now - WINDOW_MS;

  // 1. World / politics / business / tech / science + sport + constructive news
  const wire = [];
  try {
    const fetched = await fetchTickerFeeds({
      maxAgeHours: Number(process.env.TICKER_WINDOW_HOURS || 48),
      perFeed: 8,
      now,
    });

    const perOutlet = {};
    for (const item of fetched) {
      const norm = normalizeTitle(item.title);
      if (!norm || seenNorm.has(norm)) continue;

      perOutlet[item.source] = (perOutlet[item.source] || 0) + 1;
      if (perOutlet[item.source] > MAX_PER_OUTLET) continue;
      seenNorm.add(norm);

      wire.push({
        ...item,
        type: FILTER_TYPE[item.type] || item.type,
        positive: item.positive || undefined,
      });
    }
  } catch (err) {
    console.error('Ticker wire fetch error:', err);
  }

  // 2. Published PLAIN. editorial articles (same live window). Include the
  //    highest-impact stories even when they are hours old: the ticker had no
  //    way to surface an election result once a gondola rescue came in.
  const plainItems = [];
  const BREAKING_WINDOW_MS = 90 * 60 * 1000;
  const editorialWindow = articles.filter(
    (a) => Number.isFinite(Date.parse(a.publishedAt || '')) && Date.parse(a.publishedAt) >= cutoff,
  );
  const editorialCandidates = [];
  for (const a of [...rankArticles(editorialWindow).slice(0, 6), ...editorialWindow.slice(0, 6)]) {
    if (!editorialCandidates.some((x) => x.slug === a.slug)) editorialCandidates.push(a);
  }
  editorialCandidates.forEach((a) => {
      const de = a.locales?.de;
      const en = a.locales?.en;
      const title = de?.title || en?.title || a.slug;
      const norm = normalizeTitle(title);
      if (seenNorm.has(norm)) return;
      seenNorm.add(norm);

      const isRecent = a.publishedAt && now - Date.parse(a.publishedAt) < BREAKING_WINDOW_MS;
      const isEilmeldung = a.importance >= 4 && isRecent;

      let sportType = 'football';
      if (a.category === 'sport') {
        const t = title.toLowerCase();
        if (/tennis|djokovic|zverev|sinner|atp|wta/i.test(t)) sportType = 'tennis';
        else if (/nfl|super bowl|quarterback/i.test(t)) sportType = 'nfl';
        else if (/f1|formel|verstappen|hamilton|ferrari|grand prix/i.test(t)) sportType = 'f1';
        else if (/nba|basketball|lakers|celtics/i.test(t)) sportType = 'basketball';
        else if (/eishockey|nhl/i.test(t)) sportType = 'eishockey';
        else if (/golf|ryder cup/i.test(t)) sportType = 'golf';
      }

      plainItems.push({
        id: `plain-${a.slug}`,
        time: a.publishedAt,
        type: FILTER_TYPE[a.category] || a.category,
        sportType: a.category === 'sport' ? sportType : null,
        badge: isEilmeldung
          ? 'EILMELDUNG'
          : a.category === 'sport'
            ? sportType.toUpperCase()
            : a.category.toUpperCase(),
        title,
        detail: de?.dek || en?.dek || null,
        slug: a.slug,
        source: 'PLAIN.',
        importance: a.importance,
        important: isTopStory(a) || (a.importance || 0) >= 4,
      });
    });

  // 3. Quotas keep every filter useful, then the whole wire is sorted by time.
  //    Without desk shares the world feed floods everything and /ticker shows
  //    an empty business filter.
  const positive = wire.filter((i) => i.positive).slice(0, POSITIVE_QUOTA);
  const sport = wire.filter((i) => i.type === 'sport').slice(0, SPORT_QUOTA);
  const plain = plainItems.slice(0, ARTICLE_QUOTA);
  const newsQuota = Math.max(0, MAX_ITEMS - positive.length - sport.length - plain.length);

  const byDesk = {};
  for (const item of wire) {
    if (item.positive || item.type === 'sport') continue;
    (byDesk[item.type] ||= []).push(item);
  }
  const SHARES = [
    ['world', 0.5],
    ['politics', 0.24],
    ['business', 0.14],
    ['tech', 0.08],
    ['science', 0.04],
  ];
  const news = [];
  for (const [desk, share] of SHARES) {
    const take = Math.round(newsQuota * share);
    news.push(...(byDesk[desk] || []).slice(0, take));
  }
  // Fill any remainder with the newest stories left over.
  if (news.length < newsQuota) {
    const chosen = new Set(news.map((i) => i.id));
    for (const item of wire) {
      if (news.length >= newsQuota) break;
      if (chosen.has(item.id) || item.positive || item.type === 'sport') continue;
      news.push(item);
    }
  }

  const items = [...news, ...sport, ...positive, ...plain];
  items.sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || String(a.id).localeCompare(String(b.id)));

  cache = items.slice(0, MAX_ITEMS);
  lastFetch = now;

  return NextResponse.json(cache, {
    headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
  });
}
