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

  // 1. Fetch real-time live sports items (Kicker & Sportschau)
  try {
    const [kickerRes, sportschauRes] = await Promise.allSettled([
      parser.parseURL('https://newsfeed.kicker.de/news/aktuell'),
      parser.parseURL('https://www.sportschau.de/index~rss2.xml'),
    ]);

    const liveCandidates = [];

    if (kickerRes.status === 'fulfilled' && kickerRes.value?.items) {
      for (const item of kickerRes.value.items.slice(0, 6)) {
        const isLive = /live|spiel|länderspiel|halbzeit|tor|führung|em|wm/i.test(item.title);
        liveCandidates.push({
          type: 'sport',
          label: isLive ? 'LIVE / SPORT' : 'SPORT',
          text: item.title.replace(/^LIVE!\s*/i, '').trim(),
          badge: isLive ? 'LIVE' : 'SPORT',
          url: item.link,
        });
      }
    }

    if (sportschauRes.status === 'fulfilled' && sportschauRes.value?.items) {
      for (const item of sportschauRes.value.items.slice(0, 6)) {
        const isLive = /live|spiel|länderspiel|halbzeit|tor|führung|em|wm/i.test(item.title);
        liveCandidates.push({
          type: 'sport',
          label: isLive ? 'LIVE-TICKER' : 'SPORT',
          text: item.title.replace(/^Jetzt live\s*[-–:]\s*/i, '').trim(),
          badge: isLive ? 'LIVE' : 'SPORT',
          url: item.link,
        });
      }
    }

    // Prioritize actual live matches first
    liveCandidates.sort((a, b) => (b.badge === 'LIVE' ? 1 : 0) - (a.badge === 'LIVE' ? 1 : 0));
    tickerItems.push(...liveCandidates.slice(0, 4));
  } catch (err) {
    console.error('Ticker sports fetch error:', err);
  }

  // 2. Add breaking & important published news from PLAIN.
  articles.slice(0, 4).forEach((a) => {
    const deTitle = a.locales?.de?.title;
    if (deTitle) {
      tickerItems.push({
        type: a.category,
        label: a.importance >= 4 ? 'EILMELDUNG' : a.category.toUpperCase(),
        text: deTitle,
        badge: a.importance >= 4 ? 'EIL' : 'NEWS',
        slug: a.slug,
      });
    }
  });

  // Fallback if empty
  if (tickerItems.length === 0) {
    tickerItems.push({
      type: 'sport',
      label: 'SPORT-LIVE',
      text: 'Länderspiele & Spieltage synchronisieren live',
      badge: 'LIVE',
    });
  }

  cache = tickerItems;
  lastFetch = now;

  return NextResponse.json(tickerItems, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
