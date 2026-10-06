import { NextResponse } from 'next/server';
import { getIndex } from '@/lib/content.mjs';

export const revalidate = 30; // 30s cache

export async function GET(request) {
  try {
    const articles = getIndex().slice(0, 10);
    
    // Live updates ticker items combining sports results, breaking news & market moves
    const tickerItems = [
      { type: 'sport', label: 'SPORT-TICKER', text: 'Champions League & Premier League Live: Alle Spieltage synchronisiert', badge: 'LIVE' },
      { type: 'sport', label: 'RYDER CUP 2027', text: 'Jim Furyk kündigt US-Team-Underdog-Strategie für Adare Manor an', badge: 'SPORT' },
      { type: 'breaking', label: 'EILMELDUNG', text: articles[0]?.locales?.de?.title || 'Redaktion prüft neue Eilmeldungen im 10-Minuten-Takt', badge: 'NEWS' },
      { type: 'business', label: 'MÄRKTE', text: 'S&P 500, DAX und Rohstoff-Indizes im Live-Abgleich', badge: 'FINANZ' },
    ];

    // Add recent breaking stories dynamically
    articles.slice(0, 4).forEach((a) => {
      if (a.locales?.de?.title) {
        tickerItems.push({
          type: a.category,
          label: a.category.toUpperCase(),
          text: a.locales.de.title,
          badge: 'TICKER',
          slug: a.slug,
        });
      }
    });

    return NextResponse.json(tickerItems, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (e) {
    return NextResponse.json([], { status: 500 });
  }
}
