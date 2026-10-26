import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getIndex } from '@/lib/content.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 20; // 20s cache

const parser = new Parser({ timeout: 4500 });

let cache = null;
let lastFetch = 0;

// A ticker is a live wire, not an archive. Anything older than the window is
// dropped, and undated feed items are dropped instead of being stamped with
// "now" (that bug pinned old stories to the top of the ticker forever).
const WINDOW_MS = Number(process.env.TICKER_WINDOW_HOURS || 48) * 3600 * 1000;
const MAX_ITEMS = Number(process.env.TICKER_MAX_ITEMS || 150);

export async function GET() {
  const now = Date.now();
  if (cache && now - lastFetch < 20000) {
    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
    });
  }

  const items = [];
  const seenNorm = new Set();
  const articles = await getIndex();
  const cutoff = now - WINDOW_MS;

  const normalizeTitle = (str) => (str || '').toLowerCase().replace(/[^a-z0-9äöü]/g, '').slice(0, 35);

  // 1. Fetch Real-Time Multi-Sport Feeds across Top 10 Sports Worldwide
  try {
    const sportFeedPromises = [
      // Fußball
      { sportType: 'football', source: 'Kicker', url: 'https://newsfeed.kicker.de/news/fussball' },
      { sportType: 'football', source: 'Sportschau', url: 'https://www.sportschau.de/fussball/index~rss2.xml' },
      { sportType: 'football', source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
      // Tennis
      { sportType: 'tennis', source: 'Sportschau', url: 'https://www.sportschau.de/tennis/index~rss2.xml' },
      { sportType: 'tennis', source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml' },
      // Formel 1 / Motorsport
      { sportType: 'f1', source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml' },
      { sportType: 'f1', source: 'Sportschau', url: 'https://www.sportschau.de/motorsport/index~rss2.xml' },
      // Basketball / NBA
      { sportType: 'basketball', source: 'Sportschau', url: 'https://www.sportschau.de/basketball/index~rss2.xml' },
      // American Football / NFL
      { sportType: 'nfl', source: 'Sportschau', url: 'https://www.sportschau.de/american-football/index~rss2.xml' },
      // Eishockey / NHL
      { sportType: 'eishockey', source: 'Sportschau', url: 'https://www.sportschau.de/eishockey/index~rss2.xml' },
      // Radsport / Cycling
      { sportType: 'cycling', source: 'Sportschau', url: 'https://www.sportschau.de/radsport/index~rss2.xml' },
      // Golf
      { sportType: 'golf', source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/golf/rss.xml' },
      // Cricket
      { sportType: 'cricket', source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml' },
    ];

    const results = await Promise.allSettled(sportFeedPromises.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      return { ...f, items: feed.items || [] };
    }));

    results.forEach((res) => {
      if (res.status !== 'fulfilled' || !res.value?.items) return;
      const { sportType, source, items: feedItems } = res.value;

      feedItems.slice(0, 8).forEach((item, idx) => {
        const rawTitle = item.title || '';
        const norm = normalizeTitle(rawTitle);
        if (!norm || seenNorm.has(norm)) return;

        const published = item.isoDate ? Date.parse(item.isoDate) : Date.parse(item.pubDate || '');
        if (!Number.isFinite(published) || published < cutoff || published > now + 3600e3) return;
        seenNorm.add(norm);

        const cleanTitle = rawTitle.replace(/^(?:LIVE!|Jetzt live\s*[-–:]\s*)/i, '').trim();
        const isLive = /live|halbzeit|endstand|führt|tor|spieltag|remis/i.test(cleanTitle);

        let badge = sportType.toUpperCase();
        if (sportType === 'football') badge = isLive ? 'LIVE' : 'FUSSBALL';
        else if (sportType === 'f1') badge = 'FORMEL 1';
        else if (sportType === 'eishockey') badge = 'EISHOCKEY';
        else if (sportType === 'basketball') badge = 'BASKETBALL';
        else if (sportType === 'nfl') badge = 'NFL';
        else if (sportType === 'tennis') badge = 'TENNIS';
        else if (sportType === 'cycling') badge = 'RADSPORT';
        else if (sportType === 'golf') badge = 'GOLF';
        else if (sportType === 'cricket') badge = 'CRICKET';

        items.push({
          id: `${source.toLowerCase()}-${sportType}-${idx}-${published}`,
          time: new Date(published).toISOString(),
          type: 'sport',
          sportType,
          badge,
          isLive,
          title: cleanTitle,
          detail: item.contentSnippet ? item.contentSnippet.slice(0, 160) : null,
          url: item.link,
          source,
        });
      });
    });
  } catch (err) {
    console.error('Multi-sport ticker fetch error:', err);
  }

  // 2. Add published PLAIN. editorial articles into ticker (same live window)
  const BREAKING_WINDOW_MS = 90 * 60 * 1000;
  articles
    .filter((a) => Number.isFinite(Date.parse(a.publishedAt || '')) && Date.parse(a.publishedAt) >= cutoff)
    .slice(0, 100)
    .forEach((a) => {
      const de = a.locales?.de;
      const en = a.locales?.en;
      const title = de?.title || en?.title || a.slug;
      const norm = normalizeTitle(title);
      if (seenNorm.has(norm)) return;
      seenNorm.add(norm);

      const isRecent = a.publishedAt && (now - Date.parse(a.publishedAt) < BREAKING_WINDOW_MS);
      const isEilmeldung = a.importance >= 4 && isRecent;

      let sportType = 'football';
      if (a.category === 'sport') {
        const t = title.toLowerCase();
        if (/tennis|djokovic|zverev|sinner|atp|wta/i.test(t)) sportType = 'tennis';
        else if (/nfl|football|super bowl|eagles|quarterback/i.test(t)) sportType = 'nfl';
        else if (/f1|formel|verstappen|hamilton|ferrari|grand prix/i.test(t)) sportType = 'f1';
        else if (/nba|basketball|lakers|celtics/i.test(t)) sportType = 'basketball';
        else if (/eishockey|nhl/i.test(t)) sportType = 'eishockey';
        else if (/golf|ryder cup/i.test(t)) sportType = 'golf';
      }

      items.push({
        id: `plain-${a.slug}`,
        time: a.publishedAt,
        type: a.category,
        sportType: a.category === 'sport' ? sportType : null,
        badge: isEilmeldung ? 'EILMELDUNG' : (a.category === 'sport' ? (sportType ? sportType.toUpperCase() : 'SPORT') : a.category.toUpperCase()),
        title,
        detail: de?.dek || en?.dek || null,
        slug: a.slug,
        source: 'PLAIN.',
        importance: a.importance,
      });
    });

  // Sort strictly by timestamp descending, then cut to the live window size.
  items.sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || String(a.id).localeCompare(String(b.id)));

  cache = items.slice(0, MAX_ITEMS);
  lastFetch = now;

  return NextResponse.json(cache, {
    headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
  });
}
