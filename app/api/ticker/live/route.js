import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getIndex } from '@/lib/content.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 30; // 30s cache

const parser = new Parser({ timeout: 4000 });

let cache = null;
let lastFetch = 0;

export async function GET(request) {
  const now = Date.now();
  if (cache && now - lastFetch < 30000) {
    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  const tickerItems = [];
  const articles = getIndex().slice(0, 10);

  // 1. Fetch real-time football & international match feeds (Kicker & Sportschau)
  try {
    const [kickerFussball, sportschauFussball, kickerGeneral] = await Promise.allSettled([
      parser.parseURL('https://newsfeed.kicker.de/news/fussball'),
      parser.parseURL('https://www.sportschau.de/fussball/index~rss2.xml'),
      parser.parseURL('https://newsfeed.kicker.de/news/aktuell'),
    ]);

    const liveCandidates = [];

    const processItem = (item, sourceName) => {
      const title = item.title || '';
      const isLaenderspiel = /länderspiel|england|kroatien|spanien|tschechien|belgien|frankreich|italien|schweiz|deutschland|u\s*21|georgien|em|wm|nations league/i.test(title);
      const isLive = /live|halbzeit|endstand|führt|tor|spieltag/i.test(title) || isLaenderspiel;

      let label = 'SPORT';
      let badge = 'SPORT';
      if (isLaenderspiel) {
        label = 'LÄNDERSPIEL';
        badge = 'LIVE';
      } else if (isLive) {
        label = 'LIVE / SPORT';
        badge = 'LIVE';
      }

      liveCandidates.push({
        type: 'sport',
        label,
        text: title.replace(/^(?:LIVE!|Jetzt live\s*[-–:]\s*)/i, '').trim(),
        badge,
        url: item.link,
        source: sourceName,
        isPriority: isLaenderspiel || isLive,
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

    // Prioritize Länderspiele & live match results
    liveCandidates.sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0));
    tickerItems.push(...liveCandidates.slice(0, 5));
  } catch (err) {
    console.error('Ticker sports fetch error:', err);
  }

  // 2. Add published news from PLAIN. (Only brand new stories < 90 mins qualify for EILMELDUNG)
  const BREAKING_WINDOW_MS = 90 * 60 * 1000;
  articles.slice(0, 4).forEach((a) => {
    const deTitle = a.locales?.de?.title;
    if (deTitle) {
      const isRecent = a.publishedAt && (now - Date.parse(a.publishedAt) < BREAKING_WINDOW_MS);
      const isEilmeldung = a.importance >= 4 && isRecent;

      tickerItems.push({
        type: a.category,
        label: isEilmeldung ? 'EILMELDUNG' : a.category.toUpperCase(),
        text: deTitle,
        badge: isEilmeldung ? 'EIL' : 'AKTUELL',
        slug: a.slug,
      });
    }
  });

  if (tickerItems.length === 0) {
    tickerItems.push({
      type: 'sport',
      label: 'LÄNDERSPIELE',
      text: 'England siegt gegen Tschechien · Spanien dreht Spiel in Kroatien · Deutsche U21 löst EM-Ticket',
      badge: 'LIVE',
    });
  }

  cache = tickerItems;
  lastFetch = now;

  return NextResponse.json(tickerItems, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
