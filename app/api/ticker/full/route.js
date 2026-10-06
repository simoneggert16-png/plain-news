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
    const [kickerRes, sportschauRes, bbcSportRes] = await Promise.allSettled([
      parser.parseURL('https://newsfeed.kicker.de/news/aktuell'),
      parser.parseURL('https://www.sportschau.de/index~rss2.xml'),
      parser.parseURL('https://feeds.bbci.co.uk/sport/football/rss.xml'),
    ]);

    if (kickerRes.status === 'fulfilled' && kickerRes.value?.items) {
      kickerRes.value.items.slice(0, 10).forEach((item, idx) => {
        const isLive = /live|spiel|länderspiel|halbzeit|tor|führung|em|wm/i.test(item.title);
        items.push({
          id: `kicker-${idx}-${Date.parse(item.pubDate || '') || now}`,
          time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          type: 'sport',
          badge: isLive ? 'LIVE' : 'SPORT',
          title: item.title.replace(/^LIVE!\s*/i, '').trim(),
          detail: item.contentSnippet ? item.contentSnippet.slice(0, 180) : null,
          url: item.link,
          source: 'Kicker',
        });
      });
    }

    if (sportschauRes.status === 'fulfilled' && sportschauRes.value?.items) {
      sportschauRes.value.items.slice(0, 10).forEach((item, idx) => {
        const isLive = /live|spiel|länderspiel|halbzeit|tor|führung|em|wm/i.test(item.title);
        items.push({
          id: `sportschau-${idx}-${Date.parse(item.pubDate || '') || now}`,
          time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          type: 'sport',
          badge: isLive ? 'LIVE' : 'SPORT',
          title: item.title.replace(/^Jetzt live\s*[-–:]\s*/i, '').trim(),
          detail: item.contentSnippet ? item.contentSnippet.slice(0, 180) : null,
          url: item.link,
          source: 'Sportschau',
        });
      });
    }

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
  articles.forEach((a) => {
    const de = a.locales?.de;
    const en = a.locales?.en;
    items.push({
      id: `plain-${a.slug}`,
      time: a.publishedAt,
      type: a.category,
      badge: a.importance >= 4 ? 'EILMELDUNG' : a.category.toUpperCase(),
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
