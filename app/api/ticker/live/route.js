import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getIndex } from '@/lib/content.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 30; // 30s cache

const parser = new Parser({ timeout: 4000 });

let cache = null;
let lastFetch = 0;

const WINDOW_MS = Number(process.env.TICKER_WINDOW_HOURS || 48) * 3600 * 1000;
const MAX_LIVE = 5;
const MAX_ARTICLES = 4;

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

  // 1. Real-time football & international match feeds (Kicker & Sportschau)
  try {
    const [kickerFussball, sportschauFussball, kickerGeneral] = await Promise.allSettled([
      parser.parseURL('https://newsfeed.kicker.de/news/fussball'),
      parser.parseURL('https://www.sportschau.de/fussball/index~rss2.xml'),
      parser.parseURL('https://newsfeed.kicker.de/news/aktuell'),
    ]);

    const liveCandidates = [];

    const processItem = (item, sourceName) => {
      const title = (item.title || '').replace(/^(?:LIVE!|Jetzt live\s*[-–:]\s*)/i, '').trim();
      if (!title) return;

      const published = item.isoDate ? Date.parse(item.isoDate) : Date.parse(item.pubDate || '');
      // No timestamp → not a live item. Never fake "now": that pinned old
      // stories (e.g. a finished farewell match) to the top of the ticker.
      if (!Number.isFinite(published) || published < cutoff || published > now + 3600e3) return;

      const isLive = /live|halbzeit|endstand|führt|tor|spieltag/i.test(title);

      liveCandidates.push({
        type: 'sport',
        label: isLive ? 'LIVE / SPORT' : 'SPORT',
        text: title,
        badge: isLive ? 'LIVE' : 'SPORT',
        url: item.link,
        source: sourceName,
        time: new Date(published).toISOString(),
      });
    };

    if (kickerFussball.status === 'fulfilled' && kickerFussball.value?.items) {
      kickerFussball.value.items.slice(0, 6).forEach((i) => processItem(i, 'Kicker'));
    }

    if (sportschauFussball.status === 'fulfilled' && sportschauFussball.value?.items) {
      sportschauFussball.value.items.slice(0, 6).forEach((i) => processItem(i, 'Sportschau'));
    }

    if (kickerGeneral.status === 'fulfilled' && kickerGeneral.value?.items) {
      kickerGeneral.value.items.slice(0, 4).forEach((i) => processItem(i, 'Kicker'));
    }

    liveCandidates.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    tickerItems.push(...liveCandidates.slice(0, MAX_LIVE));
  } catch (err) {
    console.error('Ticker sports fetch error:', err);
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
        type: a.category,
        label: isEilmeldung ? 'EILMELDUNG' : a.category.toUpperCase(),
        text: deTitle,
        badge: isEilmeldung ? 'EIL' : 'AKTUELL',
        slug: a.slug,
        time: a.publishedAt,
      });
    });

  tickerItems.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  cache = tickerItems.slice(0, MAX_LIVE + MAX_ARTICLES);
  lastFetch = now;

  return NextResponse.json(cache, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
