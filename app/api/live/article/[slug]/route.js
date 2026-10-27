import { NextResponse } from 'next/server';
import { getLiveForArticle } from '@/lib/liveStore.mjs';

export const dynamic = 'force-dynamic';

/**
 * Live state of the article that belongs to a ticker.
 * The article page renders the committed version and this endpoint supplies
 * the newest version plus the version history, so the page can update itself
 * without a redeploy.
 */
export async function GET(_request, { params }) {
  const { slug } = await params;
  const ticker = await getLiveForArticle(slug);
  if (!ticker || !ticker.article) {
    return NextResponse.json({ live: false }, { headers: { 'Cache-Control': 'public, s-maxage=30' } });
  }

  const article = ticker.article;
  const versions = (article.versions || []).slice(0, 20).map((v) => ({
    at: v.at,
    reason: v.reason || '',
    locales: { en: v.locales?.en || null, de: v.locales?.de || null },
  }));

  return NextResponse.json(
    {
      live: ticker.status === 'live',
      status: ticker.status,
      slug: article.slug || slug,
      updatedAt: article.updatedAt,
      tickerSlug: ticker.slug,
      stats: ticker.stats || article.stats || null,
      locales: { en: article.locales?.en || null, de: article.locales?.de || null },
      versions,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=20' } }
  );
}
