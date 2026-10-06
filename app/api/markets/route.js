import { NextResponse } from 'next/server';
import { WATCHLIST, TICKER_STRIP, fetchQuotes } from '@/lib/markets.mjs';

export const revalidate = 60;

// GET /api/markets            -> full watchlist grouped
// GET /api/markets?strip=1    -> small set for the header ticker
export async function GET(req) {
  const strip = new URL(req.url).searchParams.get('strip');
  const names = Object.fromEntries(Object.values(WATCHLIST).flat());

  if (strip) {
    const q = await fetchQuotes(TICKER_STRIP);
    return json(q.map((x) => slim(x, names)));
  }

  const groups = {};
  await Promise.all(
    Object.entries(WATCHLIST).map(async ([group, list]) => {
      const q = await fetchQuotes(list.map(([s]) => s));
      groups[group] = q.map((x) => slim(x, names));
    })
  );
  return json(groups);
}

function slim(x, names) {
  const { points, ...rest } = x;
  // Downsample sparkline to max ~40 points.
  const step = Math.max(1, Math.ceil((points?.length || 0) / 40));
  return { ...rest, label: names[x.symbol] || x.name, spark: (points || []).filter((_, i) => i % step === 0).map((p) => p[1]) };
}

function json(data) {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
