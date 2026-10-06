import { NextResponse } from 'next/server';
import { fetchChart } from '@/lib/markets.mjs';

const RANGES = ['1d', '5d', '1mo', '6mo', '1y', '5y'];

// GET /api/quote?symbol=AAPL&range=1mo  -> any ticker Yahoo knows
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const symbol = (p.get('symbol') || '').trim().toUpperCase();
  const range = RANGES.includes(p.get('range')) ? p.get('range') : '1d';
  if (!/^[A-Z0-9.^=\-]{1,20}$/.test(symbol)) {
    return NextResponse.json({ error: 'invalid symbol' }, { status: 400 });
  }
  try {
    const data = await fetchChart(symbol, range);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
