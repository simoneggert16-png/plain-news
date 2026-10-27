import { NextResponse } from 'next/server';
import { getLiveTicker } from '@/lib/liveStore.mjs';

export const dynamic = 'force-dynamic';

/** One full ticker payload, polled by the ticker page every 20 seconds. */
export async function GET(_request, { params }) {
  const { slug } = await params;
  const ticker = await getLiveTicker(slug);
  if (!ticker) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json(ticker, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=20' },
  });
}
