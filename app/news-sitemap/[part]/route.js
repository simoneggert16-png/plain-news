import { SITE, LOCALES, SOURCE_LOCALE } from '@/lib/config.mjs';
import { createNewsChildResponse, readNewsArticles } from '@/lib/news-sitemap.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { part } = await params;
  return createNewsChildResponse(readNewsArticles(), {
    site: SITE, locales: LOCALES, sourceLocale: SOURCE_LOCALE, now: Date.now(),
  }, request, part);
}
