import { NextResponse } from 'next/server';
import { listLiveSummaries } from '@/lib/liveStore.mjs';

export const dynamic = 'force-dynamic';

/** Active tickers for the banner and the /live overview. */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') || 'de';
  const status = searchParams.get('status') === 'ended' ? 'ended' : 'live';

  try {
    const { summaries, source } = await listLiveSummaries({ status, locale, limit: 25 });
    return NextResponse.json(
      { tickers: summaries, source, at: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } }
    );
  } catch (err) {
    return NextResponse.json({ tickers: [], error: err.message }, { status: 200 });
  }
}
