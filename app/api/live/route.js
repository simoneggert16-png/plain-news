import { NextResponse } from 'next/server';
import { LOCALE_CODES } from '@/lib/config.mjs';
import { listLiveSummaries } from '@/lib/liveStore.mjs';

export const dynamic = 'force-dynamic';

/** Active tickers for the banner and the /live overview. */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawLocale = String(searchParams.get('locale') || 'de').toLowerCase();
  const locale = LOCALE_CODES.includes(rawLocale) ? rawLocale : 'de';
  const status = searchParams.get('status') === 'ended' ? 'ended' : 'live';

  try {
    const { summaries, source } = await listLiveSummaries({ status, locale, limit: 25 });
    return NextResponse.json(
      { tickers: summaries, source, at: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } }
    );
  } catch (err) {
    console.error('Live tickers GET failed:', err?.message || err);
    return NextResponse.json(
      { tickers: [], error: 'Live tickers temporarily unavailable.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
