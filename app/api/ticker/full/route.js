import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getIndex } from '@/lib/content.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 15; // 15s cache

const parser = new Parser({ timeout: 5000 });

let cache = null;
let lastFetch = 0;

export async function GET(request) {
  const now = Date.now();
  if (cache && now - lastFetch < 15000) {
    return NextResponse.json(cache, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  }

  const items = [];
  const articles = getIndex();

  // 1. Fetch real-time sports matches and breaking ticker items (Kicker & Sportschau & BBC)
  try {
    const [kickerFussball, sportschauFussball, kickerGeneral, bbcSportRes] = await Promise.allSettled([
      parser.parseURL('https://newsfeed.kicker.de/news/fussball'),
      parser.parseURL('https://www.sportschau.de/fussball/index~rss2.xml'),
      parser.parseURL('https://newsfeed.kicker.de/news/aktuell'),
      parser.parseURL('https://feeds.bbci.co.uk/sport/football/rss.xml'),
    ]);

    const addItems = (res, sourceName) => {
      if (res.status !== 'fulfilled' || !res.value?.items) return;
      res.value.items.slice(0, 10).forEach((item, idx) => {
        const title = item.title || '';
        const isLaenderspiel = /länderspiel|england|kroatien|spanien|tschechien|belgien|frankreich|italien|schweiz|deutschland|u\s*21|georgien|em|wm|nations league/i.test(title);
        const isLive = /live|halbzeit|endstand|führt|tor|spieltag/i.test(title) || isLaenderspiel;

        let badge = 'SPORT';
        if (isLaenderspiel) badge = 'LÄNDERSPIEL';
        else if (isLive) badge = 'LIVE';

        items.push({
          id: `${sourceName.toLowerCase()}-${idx}-${Date.parse(item.pubDate || '') || now}`,
          time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          type: 'sport',
          badge,
          title: title.replace(/^(?:LIVE!|Jetzt live\s*[-–:]\s*)/i, '').trim(),
          detail: item.contentSnippet ? item.contentSnippet.slice(0, 180) : null,
          url: item.link,
          source: sourceName,
        });
      });
    };

    addItems(kickerFussball, 'Kicker');
    addItems(sportschauFussball, 'Sportschau');
    addItems(kickerGeneral, 'Kicker');

    if (bbcSportRes.status === 'fulfilled' && bbcSportRes.value?.items) {
      bbcSportRes.value.items.slice(0, 6).forEach((item, idx) => {
        items.push({
          id: `bbc-${idx}-${Date.parse(item.pubDate || '') || now}`,
          time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          type: 'sport',
          badge: 'FOOTBALL',
          title: item.title.trim(),
          detail: item.contentSnippet ? item.contentSnippet.slice(0, 180) : null,
          url: item.link,
          source: 'BBC Sport',
        });
      });
    }
  } catch (err) {
    console.error('Ticker fetch error:', err);
  }

  // 2. Add published PLAIN. articles as ticker entries
  const BREAKING_WINDOW_MS = 90 * 60 * 1000;
  articles.forEach((a) => {
    const de = a.locales?.de;
    const en = a.locales?.en;
    const isRecent = a.publishedAt && (now - Date.parse(a.publishedAt) < BREAKING_WINDOW_MS);
    const isEilmeldung = a.importance >= 4 && isRecent;

    items.push({
      id: `plain-${a.slug}`,
      time: a.publishedAt,
      type: a.category,
      badge: isEilmeldung ? 'EILMELDUNG' : a.category.toUpperCase(),
      title: de?.title || en?.title || a.slug,
      detail: de?.dek || en?.dek || null,
      slug: a.slug,
      source: 'PLAIN.',
      importance: a.importance,
    });
  });

  // Sort strictly by timestamp descending
  items.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));

  cache = items;
  lastFetch = now;

  return NextResponse.json(items, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
  });
}
